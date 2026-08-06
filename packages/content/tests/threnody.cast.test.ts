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

  it('places Kessa at the memorial wall', () => {
    const memorial = findByName('memorial wall');
    const kessa = findByName('Kessa');
    expect(memorial).toBeDefined();
    expect(kessa).toBeDefined();
    expect(roomOf(w, kessa!)).toBe(memorial);
  });

  it('every new NPC has persona, knows, and dialogueMemory wired', () => {
    for (const name of ['Khaleth', 'Tasen', 'Saen-of-Three-Notes', 'Aslin Keer', 'Kessa']) {
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
      { name: 'Kessa',                 key: 'iren-vass'       },
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

  it('Mira is proactive and carries a first-encounter briefing', () => {
    const id = findByName('Mira')!;
    expect(w.get(id, 'proactive')?.greetOnEntry).toBe(true);
    const briefing = w.get(id, 'knows')?.facts['briefing'];
    expect(briefing).toBeDefined();
    // The briefing must name the mission-critical concretes so a new
    // player can act on it without further hand-holding.
    expect(briefing!.text).toMatch(/iren/i);
    expect(briefing!.text).toMatch(/khaleth/i);
    expect(briefing!.text).toMatch(/three hours|opening session/i);
  });

  it('Mira has a substantive seating-chart topic covering positions and tactical read', () => {
    const id = findByName('Mira')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    const chart = facts['seating-chart'];
    expect(chart, 'Mira should carry a `seating-chart` fact').toBeDefined();
    // Names the three delegations by their principals so the answer is
    // usable, not generic.
    expect(chart!.text).toMatch(/khaleth/i);
    expect(chart!.text).toMatch(/tasen/i);
    expect(chart!.text).toMatch(/saen/i);
    // The fourth chair / observer / Aslin hook is the point of the fact.
    expect(chart!.text).toMatch(/observer|fourth/i);
    expect(chart!.text).toMatch(/aslin/i);
    // Aliases cover natural phrasings the player is likely to try.
    const aliases = chart!.aliases ?? [];
    expect(aliases).toContain('the seating chart');
    expect(aliases).toContain('the datapad');
  });

  it('no Mira fact aliases "the briefing" other than the mission briefing itself', () => {
    // Guard against a specific past collision: `the-datapad` used to
    // alias 'the briefing', shadowing the actual mission-brief topic.
    const id = findByName('Mira')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    for (const [key, f] of Object.entries(facts)) {
      if (key === 'briefing') continue;
      expect(
        f.aliases ?? [],
        `${key} must not alias 'the briefing' (collides with mission brief)`,
      ).not.toContain('the briefing');
    }
  });

  it('Threnody knows the memorial wall and holds the casualty record', () => {
    const id = findByName('station terminal')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['the-memorial-wall']).toBeDefined();
    expect(facts['iren-vass-record']).toBeDefined();
    expect(facts['aslin-keer-record']).toBeDefined();
  });
});
