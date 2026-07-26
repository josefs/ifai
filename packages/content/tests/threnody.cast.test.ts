import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';
import { roomOf } from '@ifai/engine';

describe('buildThrenody — Contested Casualty cast', () => {
  const w = buildThrenody();

  function findByName(name: string): number | undefined {
    for (let i = 0; i < 10_000; i++) {
      const n = w.get(i, 'name');
      if (n?.value === name) return i;
    }
    return undefined;
  }

  it('places Mira, Khaleth, Tasen, and Saen in the neutral lounge', () => {
    const lounge = findByName('neutral lounge');
    expect(lounge).toBeDefined();
    for (const npcName of ['Mira', 'Khaleth', 'Tasen', 'Saen-of-Three-Notes']) {
      const id = findByName(npcName);
      expect(id, `${npcName} should exist`).toBeDefined();
      expect(roomOf(w, id!), `${npcName} should be in the lounge`).toBe(lounge);
    }
  });

  it('places Aslin Keer on the observation balcony', () => {
    const balcony = findByName('observation balcony');
    const aslin = findByName('Aslin Keer');
    expect(balcony).toBeDefined();
    expect(aslin).toBeDefined();
    expect(roomOf(w, aslin!)).toBe(balcony);
  });

  it('every new NPC has persona, knows, and dialogueMemory wired', () => {
    for (const name of ['Khaleth', 'Tasen', 'Saen-of-Three-Notes', 'Aslin Keer']) {
      const id = findByName(name)!;
      const npc = w.get(id, 'npc');
      expect(npc?.persona, `${name} persona`).toBeTruthy();
      expect(w.get(id, 'knows')?.facts, `${name} knows`).toBeTruthy();
      expect(w.get(id, 'dialogueMemory')).toBeDefined();
    }
  });

  it('every NPC with an Iren account uses the expected stable topic id', () => {
    const holders = [
      { name: 'Mira',                  key: 'iren-vass'       },
      { name: 'Khaleth',               key: 'iren-vass'       },
      { name: 'Tasen',                 key: 'iren-vass'       },
      { name: 'Aslin Keer',            key: 'iren-vass'       },
      { name: 'Saen-of-Three-Notes',   key: 'truth-medic-present' },
      { name: 'station terminal',      key: 'iren-vass-record' },
    ];
    for (const h of holders) {
      const id = findByName(h.name)!;
      const facts = w.get(id, 'knows')?.facts ?? {};
      expect(Object.keys(facts), `${h.name} should hold ${h.key}`).toContain(h.key);
    }
  });

  it('Mira foreshadows Aslin and the contested casualty', () => {
    const id = findByName('Mira')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['iren-vass']).toBeDefined();
    expect(facts['aslin-keer']).toBeDefined();
    expect(facts['aslin-keer-truth']).toBeDefined();
  });

  it('Threnody knows the memorial wall and holds the casualty record', () => {
    const id = findByName('station terminal')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['the-memorial-wall']).toBeDefined();
    expect(facts['iren-vass-record']).toBeDefined();
    expect(facts['aslin-keer-record']).toBeDefined();
  });
});
