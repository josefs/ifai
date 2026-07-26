import { describe, it, expect } from 'vitest';
import { World, moveInto, perceive } from '@ifai/engine';
import { FallbackParser } from '../src/parser-fallback.js';

/**
 * Tiny world: cabin with a datapad and a badge in it; player starts
 * inside. Used to exercise coordinated-object input through the
 * fallback parser ("take the datapad and the badge").
 */
function makeWorld() {
  const w = new World();
  const cabin = w.newEntity({
    room: {}, name: { value: 'cabin' },
    description: { text: 'A cabin.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const datapad = w.newEntity({
    name: { value: 'datapad' }, portable: {},
    description: { text: 'A datapad.' },
  });
  const badge = w.newEntity({
    name: { value: 'badge' }, portable: {},
    description: { text: 'A badge.' },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, datapad, cabin);
  moveInto(w, badge,   cabin);
  moveInto(w, player,  cabin);
  return { w, cabin, datapad, badge, player };
}

describe('FallbackParser: chains', () => {
  it('parses "pick up the datapad and the badge" in left-to-right order', async () => {
    const { w, datapad, badge } = makeWorld();
    const parser = new FallbackParser();
    const result = await parser.parse(
      'pick up the datapad and the badge',
      perceive(w),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions).toEqual([
      { kind: 'take', target: datapad },
      { kind: 'take', target: badge },
    ]);
  });

  it('handles "take A, B" with shared verb', async () => {
    const { w, datapad, badge } = makeWorld();
    const parser = new FallbackParser();
    const result = await parser.parse(
      'take the datapad, the badge',
      perceive(w),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions.map(a => a.kind)).toEqual(['take', 'take']);
    expect((result.actions[0] as { target: number }).target).toBe(datapad);
    expect((result.actions[1] as { target: number }).target).toBe(badge);
  });

  it('keeps explicit verb on second clause when given', async () => {
    const { w, datapad, badge } = makeWorld();
    const parser = new FallbackParser();
    const result = await parser.parse(
      'take the datapad and examine the badge',
      perceive(w),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions).toEqual([
      { kind: 'take',    target: datapad },
      { kind: 'examine', target: badge },
    ]);
  });

  it('reports the failing clause when shared-verb retry also fails', async () => {
    const { w } = makeWorld();
    const parser = new FallbackParser();
    const result = await parser.parse(
      'take the datapad and the moon',
      perceive(w),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/moon/);
  });
});
