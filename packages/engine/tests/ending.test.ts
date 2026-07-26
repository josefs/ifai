import { describe, it, expect } from 'vitest';
import { World } from '../src/index.js';

/**
 * `memorialWall` and `endingState` are pure-data components used by the
 * arc-step-8 climax rules. These tests cover the round-trip — actual
 * behaviour (clock trigger, ending selection) is tested under the rules
 * that read these components.
 */
describe('components: ending', () => {
  it('memorialWall marker round-trips on a room', () => {
    const w = new World();
    const wall = w.newEntity({
      room: {},
      name: { value: 'memorial wall' },
      container: { contents: [] },
      memorialWall: {},
    });
    expect(w.get(wall, 'memorialWall')).toBeDefined();
  });

  it('endingState stores presented items, sessionOpened, and resolved', () => {
    const w = new World();
    const clockEnt = w.newEntity({
      clock: { minutes: 0, openingSessionAt: 180 },
      endingState: { presentedAtWall: [], sessionOpened: false },
    });
    const before = w.get(clockEnt, 'endingState');
    expect(before).toBeDefined();
    expect(before!.presentedAtWall).toEqual([]);
    expect(before!.sessionOpened).toBe(false);
    expect(before!.resolved).toBeUndefined();

    w.add(clockEnt, 'endingState', {
      presentedAtWall: [1 as any, 2 as any],
      sessionOpened: true,
      resolved: 'vorthi-truth',
    });
    const after = w.get(clockEnt, 'endingState')!;
    expect(after.presentedAtWall).toEqual([1, 2]);
    expect(after.sessionOpened).toBe(true);
    expect(after.resolved).toBe('vorthi-truth');
  });

  it('endingState coexists with clock on the same entity', () => {
    const w = new World();
    const clockEnt = w.newEntity({
      clock: { minutes: 45, openingSessionAt: 180 },
      endingState: { presentedAtWall: [], sessionOpened: false },
    });
    expect(w.get(clockEnt, 'clock')!.minutes).toBe(45);
    expect(w.get(clockEnt, 'endingState')!.sessionOpened).toBe(false);
  });
});
