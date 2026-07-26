import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';

/**
 * Session-open trigger:
 *   - `wait`/`move`/etc. that tick the clock past `openingSessionAt`
 *     fire a single `sessionOpened` event and flip `endingState.sessionOpened`.
 *   - `attendSession` fast-forwards the clock and fires `sessionOpened`
 *     in the same outcome.
 *   - The event is emitted exactly once; later ticks do not re-emit.
 */
function makeWorld(opts: { startMinutes?: number; opening?: number } = {}) {
  const w = new World();
  const room = w.newEntity({
    room: {}, name: { value: 'somewhere' }, description: { text: '' },
    container: { contents: [] }, ambientLit: { lit: true },
  });
  const elsewhere = w.newEntity({
    room: {}, name: { value: 'next door' }, description: { text: '' },
    container: { contents: [] }, ambientLit: { lit: true },
  });
  w.add(room, 'exits', { exits: [{ dir: 'spinward', destination: elsewhere }] } as any);
  const clockEnt = w.newEntity({
    clock: { minutes: opts.startMinutes ?? 0, openingSessionAt: opts.opening ?? 180 },
    endingState: { presentedAtWall: [], sessionOpened: false },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] }, knows: { facts: {} },
  });
  moveInto(w, player, room);
  return { w, clockEnt, player };
}

describe('sessionOpened trigger', () => {
  it('does not fire while the clock is below the threshold', () => {
    const { w } = makeWorld({ startMinutes: 0, opening: 180 });
    const out = apply(w, { kind: 'wait' });
    expect(out.events.some(e => e.kind === 'sessionOpened')).toBe(false);
  });

  it('fires exactly once when wait crosses the threshold', () => {
    const { w, clockEnt } = makeWorld({ startMinutes: 175, opening: 180 });
    const out = apply(w, { kind: 'wait' }); // wait costs 10 → 185
    expect(out.events.filter(e => e.kind === 'sessionOpened')).toHaveLength(1);
    expect(w.get(clockEnt, 'endingState')!.sessionOpened).toBe(true);
    // Subsequent ticks must not re-emit.
    const out2 = apply(w, { kind: 'wait' });
    expect(out2.events.some(e => e.kind === 'sessionOpened')).toBe(false);
  });

  it('attendSession fast-forwards the clock and fires sessionOpened', () => {
    const { w, clockEnt } = makeWorld({ startMinutes: 10, opening: 180 });
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.some(e => e.kind === 'sessionOpened')).toBe(true);
    expect(w.get(clockEnt, 'clock')!.minutes).toBe(180);
    expect(w.get(clockEnt, 'endingState')!.sessionOpened).toBe(true);
  });

  it('attendSession is idempotent after the session has opened', () => {
    const { w } = makeWorld({ startMinutes: 200, opening: 180 });
    // First call opens the session.
    apply(w, { kind: 'attendSession' });
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.some(e => e.kind === 'sessionOpened')).toBe(false);
  });

  it('attendSession fails cleanly when there is no clock', () => {
    const w = new World();
    const room = w.newEntity({
      room: {}, name: { value: 'r' }, description: { text: '' },
      container: { contents: [] }, ambientLit: { lit: true },
    });
    const player = w.newEntity({
      player: {}, name: { value: 'you' },
      container: { contents: [] }, knows: { facts: {} },
    });
    moveInto(w, player, room);
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.some(e => e.kind === 'failed')).toBe(true);
  });
});
