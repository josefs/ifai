import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';

describe('buildThrenody — Contested Casualty rooms', () => {
  const w = buildThrenody();

  function findByName(name: string): number | undefined {
    for (let i = 0; i < 10_000; i++) {
      const n = w.get(i, 'name');
      if (n?.value === name) return i;
    }
    return undefined;
  }

  function exitsOf(id: number): Record<string, number> {
    return (w.get(id, 'exits')?.to ?? {}) as Record<string, number>;
  }

  it('adds the memorial wall and methane chamber as rooms with descriptions', () => {
    for (const name of ['memorial wall', 'methane chamber']) {
      const id = findByName(name);
      expect(id, `${name} should exist`).toBeDefined();
      expect(w.get(id!, 'room'), `${name} should be a room`).toBeDefined();
      expect(w.get(id!, 'description')?.text, `${name} description`).toBeTruthy();
      expect(w.get(id!, 'ambientLit')?.lit, `${name} should be lit`).toBe(true);
    }
  });

  it('connects the memorial wall outward of the corridor (with inward return)', () => {
    const corridor = findByName('corridor')!;
    const memorial = findByName('memorial wall')!;
    expect(exitsOf(corridor).outward).toBe(memorial);
    expect(exitsOf(memorial).inward).toBe(corridor);
  });

  it('connects the methane chamber inward of the lounge (with outward return)', () => {
    const lounge  = findByName('neutral lounge')!;
    const methane = findByName('methane chamber')!;
    expect(exitsOf(lounge).inward).toBe(methane);
    expect(exitsOf(methane).outward).toBe(lounge);
  });

  it('does not disturb the existing corridor hub exits', () => {
    const corridor = findByName('corridor')!;
    const quarters = findByName('aide quarters')!;
    const lounge   = findByName('neutral lounge')!;
    const balcony  = findByName('observation balcony')!;
    const ex = exitsOf(corridor);
    expect(ex.in).toBe(quarters);
    expect(ex.spinward).toBe(lounge);
    expect(ex.up).toBe(balcony);
  });

  it('every room has at least three scenery entities', () => {
    // Scenery makes room prose parseable — "look at the window",
    // "examine the deck". Every room in the slice should carry a
    // handful so the parser has something to bind ambient references
    // to instead of degrading to a whole-room `look`.
    const roomNames = [
      'aide quarters', 'corridor', 'neutral lounge',
      'observation balcony', 'memorial wall', 'methane chamber',
    ];
    for (const roomName of roomNames) {
      const roomId = findByName(roomName)!;
      const contents = w.get(roomId, 'container')?.contents ?? [];
      const scenery = contents.filter(id => w.has(id, 'scenery'));
      expect(scenery.length,
        `${roomName} should have >= 3 scenery entities, has ${scenery.length}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('scenery entities are not portable', () => {
    // Scenery is fixed room fiction: a window bolted flush to the
    // bulkhead, a memorial wall's script. It should never be
    // `take`-able.
    for (let i = 0; i < 10_000; i++) {
      if (!w.has(i, 'scenery')) continue;
      const name = w.get(i, 'name')?.value ?? `entity-${i}`;
      expect(w.has(i, 'portable'), `${name} is scenery and must not be portable`).toBe(false);
    }
  });
});
