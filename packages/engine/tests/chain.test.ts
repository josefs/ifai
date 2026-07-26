import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { applyAll } from '../src/apply.js';
import type { Action } from '../src/actions.js';

/**
 * Build a tiny two-room world for testing action chains.
 *
 *   cabin  --(out)-->  lounge   (lounge has --(in)--> cabin back)
 *   datapad starts in cabin (portable)
 *   player starts in cabin
 */
function makeWorld() {
  const w = new World();
  const cabin = w.newEntity({
    room: {}, name: { value: 'cabin' },
    description: { text: 'A cabin.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const lounge = w.newEntity({
    room: {}, name: { value: 'lounge' },
    description: { text: 'A lounge.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  // exits
  w.add(cabin,  'exits', { to: { out: lounge } });
  w.add(lounge, 'exits', { to: { in:  cabin  } });

  const datapad = w.newEntity({
    name: { value: 'datapad' }, portable: {},
    description: { text: 'A datapad.' },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, datapad, cabin);
  moveInto(w, player, cabin);
  return { w, cabin, lounge, datapad, player };
}

describe('applyAll: action chains', () => {
  it('runs an empty list to no outcomes', async () => {
    const { w } = makeWorld();
    const { outcomes } = await applyAll(w, []);
    expect(outcomes).toEqual([]);
  });

  it('runs all actions when each succeeds', async () => {
    const { w, datapad } = makeWorld();
    const actions: Action[] = [
      { kind: 'take', target: datapad },
      { kind: 'move', dir: 'out' },
      { kind: 'look' },
    ];
    const { outcomes } = await applyAll(w, actions);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.map(o => o.status)).toEqual(['ok', 'ok', 'ok']);
    // Each ok outcome carries its own non-empty events list.
    for (const o of outcomes) expect(o.events.length).toBeGreaterThan(0);
  });

  it('stops on first failure and marks remaining as skipped', async () => {
    const { w, datapad } = makeWorld();
    // Second action targets a nonexistent direction; later actions must
    // be skipped even though they are individually valid.
    const actions: Action[] = [
      { kind: 'take', target: datapad },
      { kind: 'move', dir: 'spinward' }, // cabin has no spinward exit -> fails
      { kind: 'look' },
      { kind: 'inventory' },
    ];
    const { outcomes } = await applyAll(w, actions);
    expect(outcomes.map(o => o.status)).toEqual([
      'ok', 'failed', 'skipped', 'skipped',
    ]);
    // Skipped outcomes have empty events arrays.
    expect(outcomes[2]!.events).toEqual([]);
    expect(outcomes[3]!.events).toEqual([]);
    // The failed outcome carries the failed event so the UI can describe it.
    expect(outcomes[1]!.events.some(e => e.kind === 'failed')).toBe(true);
  });

  it('threads world state across actions (later sees earlier mutation)', async () => {
    const { w, datapad, lounge } = makeWorld();
    // Take the datapad then move; after the chain, the player must be in
    // the lounge AND still holding the datapad.
    const { outcomes } = await applyAll(w, [
      { kind: 'take', target: datapad },
      { kind: 'move', dir: 'out' },
    ]);
    expect(outcomes.every(o => o.status === 'ok')).toBe(true);
    // datapad's location holder is the player (still held after move).
    const datapadLoc = w.get(datapad, 'location');
    const player = w.player();
    expect(datapadLoc?.holderId).toBe(player);
    // player is now inside the lounge.
    const playerLoc = w.get(player, 'location');
    expect(playerLoc?.holderId).toBe(lounge);
  });
});
