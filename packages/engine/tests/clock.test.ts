import { describe, it, expect } from 'vitest';
import { World, moveInto, getClock, tickClock } from '../src/world.js';
import { apply, applyAll } from '../src/apply.js';
import { perceive } from '../src/perception.js';

function makeWorld(opts: { withClock?: boolean; openingAt?: number } = {}) {
  const w = new World();
  const lobby = w.newEntity({
    room: {}, name: { value: 'lobby' },
    description: { text: 'A lobby.' },
    container: { contents: [] }, ambientLit: { lit: true },
  });
  const corridor = w.newEntity({
    room: {}, name: { value: 'corridor' },
    description: { text: 'A corridor.' },
    container: { contents: [] }, ambientLit: { lit: true },
  });
  w.add(lobby, 'exits', { to: { spinward: corridor } });
  w.add(corridor, 'exits', { to: { antispinward: lobby } });
  const datapad = w.newEntity({
    name: { value: 'datapad' }, portable: {},
    description: { text: 'A scratched datapad.' },
  });
  moveInto(w, datapad, lobby);
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, player, lobby);
  if (opts.withClock !== false) {
    w.newEntity({ clock: { minutes: 0, openingSessionAt: opts.openingAt ?? 60 } });
  }
  return { w, lobby, corridor, datapad, player };
}

describe('clock — engine ticks', () => {
  it('move advances the clock by 5 minutes', () => {
    const { w } = makeWorld();
    apply(w, { kind: 'move', dir: 'spinward' });
    expect(getClock(w)?.minutes).toBe(5);
  });

  it('look does not advance the clock', () => {
    const { w } = makeWorld();
    apply(w, { kind: 'look' });
    expect(getClock(w)?.minutes).toBe(0);
  });

  it('examine and inventory do not advance the clock', () => {
    const { w, datapad } = makeWorld();
    apply(w, { kind: 'examine', target: datapad });
    apply(w, { kind: 'inventory' });
    expect(getClock(w)?.minutes).toBe(0);
  });

  it('failed move does not advance the clock (no_exit at lobby has no antispinward)', () => {
    const { w } = makeWorld();
    const r = apply(w, { kind: 'move', dir: 'antispinward' });
    expect(r.events.some(e => e.kind === 'failed')).toBe(true);
    expect(getClock(w)?.minutes).toBe(0);
  });

  it('wait advances the clock by 10 minutes', () => {
    const { w } = makeWorld();
    apply(w, { kind: 'wait' });
    expect(getClock(w)?.minutes).toBe(10);
  });

  it('take and drop each advance the clock by 1 minute', () => {
    const { w, datapad } = makeWorld();
    apply(w, { kind: 'take',  target: datapad });
    apply(w, { kind: 'drop',  target: datapad });
    expect(getClock(w)?.minutes).toBe(2);
  });

  it('a chained move + look advances by 5, not 10', () => {
    const { w } = makeWorld();
    return applyAll(w, [
      { kind: 'move', dir: 'spinward' },
      { kind: 'look' },
    ]).then(() => {
      expect(getClock(w)?.minutes).toBe(5);
    });
  });

  it('engine helpers no-op when the world has no clock', () => {
    const { w } = makeWorld({ withClock: false });
    apply(w, { kind: 'move', dir: 'spinward' });
    expect(getClock(w)).toBeUndefined();
    expect(() => tickClock(w, 5)).not.toThrow();
  });

  it('getClock throws when more than one clock entity exists', () => {
    const { w } = makeWorld();
    w.newEntity({ clock: { minutes: 0, openingSessionAt: 999 } });
    expect(() => getClock(w)).toThrow(/at most one clock/);
  });
});

describe('clock — perception', () => {
  it('exposes minutes, openingSessionAt, minutesUntilSession, sessionStarted', () => {
    const { w } = makeWorld({ openingAt: 30 });
    let p = perceive(w);
    expect(p.gameTime).toEqual({
      minutes: 0, openingSessionAt: 30, minutesUntilSession: 30, sessionStarted: false,
    });
    apply(w, { kind: 'move', dir: 'spinward' });
    p = perceive(w);
    expect(p.gameTime).toMatchObject({ minutes: 5, minutesUntilSession: 25, sessionStarted: false });
  });

  it('clamps minutesUntilSession to 0 once the deadline passes; minutes stays monotonic', () => {
    const { w } = makeWorld({ openingAt: 5 });
    apply(w, { kind: 'move', dir: 'spinward' });   // 5
    apply(w, { kind: 'move', dir: 'antispinward' }); // 10 — overshoot
    const p = perceive(w);
    expect(p.gameTime).toEqual({
      minutes: 10, openingSessionAt: 5, minutesUntilSession: 0, sessionStarted: true,
    });
  });

  it('omits gameTime when the world has no clock', () => {
    const { w } = makeWorld({ withClock: false });
    expect(perceive(w).gameTime).toBeUndefined();
  });
});

describe('clock — converse + respondAsNpc accounting', () => {
  function makeNpcWorld() {
    const w = new World();
    const lounge = w.newEntity({
      room: {}, name: { value: 'lounge' },
      description: { text: 'A lounge.' },
      container: { contents: [] }, ambientLit: { lit: true },
    });
    const npc = w.newEntity({
      name: { value: 'mira' },
      description: { text: 'Mira.' },
      npc: { persona: 'p', species: 'human', mood: 'guarded', trust: 50 },
      species: { id: 'human' },
      knows: { facts: { 'topic-a': { text: 'A is true.' } } },
      dialogueMemory: { entries: [] },
    });
    moveInto(w, npc, lounge);
    const player = w.newEntity({
      player: {}, name: { value: 'you' },
      container: { contents: [] }, knows: { facts: {} },
    });
    moveInto(w, player, lounge);
    w.newEntity({ clock: { minutes: 0, openingSessionAt: 60 } });
    return { w, npc, player };
  }

  it('converse charges 2 minutes; respondAsNpc does not double-charge', async () => {
    const { w, npc, player } = makeNpcWorld();
    await applyAll(w, [
      { kind: 'converse', mode: 'ask', target: npc, topicPhrase: 'topic-a' },
    ], {
      // The CLI's afterEach hook funnels agent output through respondAsNpc.
      // Simulate that here to ensure respondAsNpc has a 0 cost.
      afterEach: async (world, outcome) => {
        if (outcome.events.some(e => e.kind === 'addressed')) {
          const r = apply(world, {
            kind: 'respondAsNpc', speaker: npc, audience: player,
            payload: { speech: 'A is true.' },
          });
          return r.events;
        }
        return [];
      },
    });
    expect(getClock(w)?.minutes).toBe(2);
  });
});
