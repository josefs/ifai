import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';
import type { Event } from '../src/events.js';

/**
 * Behaviour of `present X to memorial wall`:
 *   - check allows a room target when it carries `memorialWall`
 *   - carry-out moves the item into the room (no NPC dialogue-memory push)
 *   - after-rule appends the item id to endingState.presentedAtWall
 *     and emits `presentedAtMemorial`
 *   - duplicate presentations of the same item do not double-record
 */
function makeWorld() {
  const w = new World();
  const wall = w.newEntity({
    room: {}, name: { value: 'memorial wall' },
    description: { text: '' },
    container: { contents: [] }, ambientLit: { lit: true },
    memorialWall: {},
  });
  const coin = w.newEntity({
    name: { value: "Iren's coin" }, description: { text: '' },
    portable: {},
  });
  const fragment = w.newEntity({
    name: { value: 'chime-fragment' }, description: { text: '' },
    portable: {},
  });
  const clockEnt = w.newEntity({
    clock: { minutes: 0, openingSessionAt: 180 },
    endingState: { presentedAtWall: [], sessionOpened: false },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] }, knows: { facts: {} },
  });
  moveInto(w, player, wall);
  moveInto(w, coin, player);
  moveInto(w, fragment, player);
  return { w, wall, coin, fragment, clockEnt, player };
}

describe('present to memorial wall', () => {
  it('appends presented item and emits presentedAtMemorial', () => {
    const { w, wall, coin, clockEnt } = makeWorld();
    const out = apply(w, { kind: 'present', target: coin, to: wall });
    expect(out.events.some(e => e.kind === 'presented')).toBe(true);
    expect(out.events.some(e => e.kind === 'presentedAtMemorial')).toBe(true);
    const state = w.get(clockEnt, 'endingState')!;
    expect(state.presentedAtWall).toEqual([coin]);
  });

  it('dedups repeated presentations of the same item', () => {
    const { w, wall, coin, clockEnt } = makeWorld();
    apply(w, { kind: 'present', target: coin, to: wall });
    // Put it back in player's hands and re-present.
    const player = w.player();
    moveInto(w, coin, player);
    apply(w, { kind: 'present', target: coin, to: wall });
    expect(w.get(clockEnt, 'endingState')!.presentedAtWall).toEqual([coin]);
  });

  it('accumulates multiple distinct items in presentation order', () => {
    const { w, wall, coin, fragment, clockEnt } = makeWorld();
    apply(w, { kind: 'present', target: coin, to: wall });
    apply(w, { kind: 'present', target: fragment, to: wall });
    expect(w.get(clockEnt, 'endingState')!.presentedAtWall).toEqual([coin, fragment]);
  });

  it('fails if the player is not in the memorial wall room', () => {
    const w = new World();
    const wall = w.newEntity({
      room: {}, name: { value: 'memorial wall' }, description: { text: '' },
      container: { contents: [] }, ambientLit: { lit: true },
      memorialWall: {},
    });
    const corridor = w.newEntity({
      room: {}, name: { value: 'corridor' }, description: { text: '' },
      container: { contents: [] }, ambientLit: { lit: true },
    });
    const coin = w.newEntity({
      name: { value: 'coin' }, description: { text: '' }, portable: {},
    });
    w.newEntity({
      clock: { minutes: 0, openingSessionAt: 180 },
      endingState: { presentedAtWall: [], sessionOpened: false },
    });
    const player = w.newEntity({
      player: {}, name: { value: 'you' },
      container: { contents: [] }, knows: { facts: {} },
    });
    moveInto(w, player, corridor);
    moveInto(w, coin, player);
    const out = apply(w, { kind: 'present', target: coin, to: wall });
    const failed = out.events.find(e => e.kind === 'failed') as Extract<Event, { kind: 'failed' }>;
    expect(failed.reason).toBe('not_here');
  });
});
