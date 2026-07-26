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
});
