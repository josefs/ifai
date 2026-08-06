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

  it("Aslin has follow-up topics for every noun his Iren-Vass fact volunteers", () => {
    // Principle: any concrete noun a character names in one fact
    // should itself be a topic they can be asked about. Aslin's
    // Iren-Vass fact volunteers "flash drive", "clinic", "our people",
    // "the official version" and "the recording"; each has its own
    // entry so a follow-up ("ask aslin about the drive") lands.
    const id = findByName('Aslin Keer')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    for (const key of ['the-drive', 'the-clinic', 'our-people', 'the-official-version', 'the-recording']) {
      expect(facts[key], `Aslin should hold ${key}`).toBeDefined();
      expect(facts[key]!.text.length, `${key} text should be substantive`).toBeGreaterThan(80);
    }
    // And the natural phrasing the player is most likely to try must
    // resolve — this is the exact case that surfaced the bug.
    const drive = facts['the-drive']!;
    expect(drive.aliases ?? []).toEqual(expect.arrayContaining(['the drive', 'flash drive']));
    const clinic = facts['the-clinic']!;
    expect(clinic.aliases ?? []).toEqual(expect.arrayContaining(['the clinic', 'clinic']));
  });

  it("every NPC whose canonical fact names 'the clinic' can be asked about it", () => {
    // Broader audit: Iren Vass died at 'a Vorthi clinic' — Mira,
    // Khaleth, Tasen, Aslin, and Threnody all reference it. Each must
    // carry a `the-clinic` topic so the player can follow up wherever
    // the reference surfaces first.
    for (const name of ['Mira', 'Khaleth', 'Tasen', 'Aslin Keer', 'station terminal']) {
      const id = findByName(name)!;
      const facts = w.get(id, 'knows')?.facts ?? {};
      expect(facts['the-clinic'], `${name} should hold 'the-clinic'`).toBeDefined();
      expect(facts['the-clinic']!.aliases ?? [], `${name} 'the-clinic' aliases`)
        .toEqual(expect.arrayContaining(['the clinic']));
    }
  });

  it("Mira, Aslin, and Threnody all carry a 'the-reach' topic", () => {
    // The Reach — the human confederation Aslin reports to — is
    // named in each of their accounts. All three should be askable.
    for (const name of ['Mira', 'Aslin Keer', 'station terminal']) {
      const id = findByName(name)!;
      const facts = w.get(id, 'knows')?.facts ?? {};
      expect(facts['the-reach'], `${name} should hold 'the-reach'`).toBeDefined();
    }
  });

  it("Mira and Kessa carry a 'the-border' topic", () => {
    // Both name 'the border' in their accounts; both need to be
    // askable about it, from their own perspectives.
    for (const name of ['Mira', 'Kessa']) {
      const id = findByName(name)!;
      const facts = w.get(id, 'knows')?.facts ?? {};
      expect(facts['the-border'], `${name} should hold 'the-border'`).toBeDefined();
    }
  });

  it("Mira carries 'the-hearth' and 'war-crest' faction topics", () => {
    const id = findByName('Mira')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['the-hearth']).toBeDefined();
    expect(facts['war-crest']).toBeDefined();
  });

  it("Khaleth carries 'war-crest-cell' and 'the-record' follow-ups", () => {
    const id = findByName('Khaleth')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['war-crest-cell']).toBeDefined();
    expect(facts['the-record']).toBeDefined();
  });

  it("Tasen carries 'intelligence-officers' and 'the-file' follow-ups", () => {
    const id = findByName('Tasen')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['intelligence-officers']).toBeDefined();
    expect(facts['the-file']).toBeDefined();
    // Player is likely to type 'the drive' after talking to Aslin;
    // Tasen's the-file must alias it so the two accounts can be
    // compared without the player having to remember the terminology.
    expect(facts['the-file']!.aliases ?? [])
      .toEqual(expect.arrayContaining(['the drive']));
  });

  it("Kessa carries 'brother-in-law' and 'the-long-watch' follow-ups", () => {
    const id = findByName('Kessa')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['brother-in-law']).toBeDefined();
    expect(facts['the-long-watch']).toBeDefined();
  });

  it("Threnody carries 'cause-of-death' as a distinct topic from the record", () => {
    // The AI's iren-vass-record fact says "Cause of death: pending" —
    // a natural player follow-up. It should have its own topic so
    // asking directly doesn't collapse into the credentialed record.
    const id = findByName('station terminal')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['cause-of-death']).toBeDefined();
  });

  it("Mira, Threnody, and Kessa all carry 'the-last-engagement' with consistent naming", () => {
    // Second-order audit: the newly-added topics referenced 'the last
    // engagement' / 'the border action' — the previous war this
    // station was built out of. Three characters know it, from three
    // different angles: Mira strategically, Threnody procedurally,
    // Kessa personally (Deneth died in it). All three must be askable.
    for (const name of ['Mira', 'station terminal', 'Kessa']) {
      const id = findByName(name)!;
      const facts = w.get(id, 'knows')?.facts ?? {};
      const engagement = facts['the-last-engagement'];
      expect(engagement, `${name} should hold 'the-last-engagement'`).toBeDefined();
      // Common aliases so the player can use any of the natural
      // phrasings each character used earlier.
      expect(engagement!.aliases ?? [], `${name} the-last-engagement aliases`)
        .toEqual(expect.arrayContaining(['the border action', 'the last war']));
    }
  });

  it("Mira's opening-session aliases 'opening theatre' (introduced by night-session)", () => {
    // Mira's night-session fact mentions 'opening theatre' as a
    // synonym; if a player uses that phrase, it should land on the
    // opening-session topic.
    const id = findByName('Mira')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    expect(facts['opening-session']!.aliases ?? [])
      .toEqual(expect.arrayContaining(['opening theatre']));
  });

  it('Threnody knows every named guest and the plot objects the player will hear about', () => {
    // Full Chekhov's-noun audit of the station AI. Because Threnody is
    // the omniscient-ish narrator-adjacent character, players will ask
    // her about any name they've encountered. She should have a
    // procedural, understated answer for each — and for plot objects
    // she doesn't hold, an honest "I have no record" in her voice.
    const id = findByName('station terminal')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    const expected = [
      // Delegates.
      'mira-vane', 'khaleth', 'tasen', 'saen-of-three-notes',
      // Vorthi factions and the collapse she refuses.
      'the-hearth', 'war-crest', 'the-vorthi',
      // Geography and the widow's partner.
      'the-border', 'deneth',
      // Plot objects she does not physically hold.
      'the-drive', 'the-recording',
      // Procedure and gates.
      'credentials', 'maintenance-corridor', 'opening-session',
    ];
    for (const key of expected) {
      expect(facts[key], `Threnody should hold '${key}'`).toBeDefined();
      expect(facts[key]!.text.length, `${key} text should be substantive`)
        .toBeGreaterThan(80);
    }
    // Terminology alignment with the other characters — a player who
    // learned a phrase from one NPC should be able to use it on
    // Threnody without having to guess her preferred noun.
    expect(facts['the-drive']!.aliases ?? [])
      .toEqual(expect.arrayContaining(['the drive', 'flash drive', 'the file']));
    expect(facts['the-vorthi']!.aliases ?? [])
      .toEqual(expect.arrayContaining(['vorthi']));
    expect(facts['saen-of-three-notes']!.aliases ?? [])
      .toEqual(expect.arrayContaining(['saen', 'the silica envoy']));
  });

  it('every principal NPC holds `the-hearth` and `war-crest` faction topics', () => {
    // Second-order Chekhov: Hearth and War-Crest are the two Vorthi
    // bodies at the heart of the case; every character with a stake
    // in it names them. Each must be askable about both, from their
    // own angle. Saen is excluded (silica envoy, binary-search
    // persona forbids elaboration).
    for (const name of ['Mira', 'Khaleth', 'Tasen', 'Aslin Keer', 'station terminal', 'Kessa']) {
      const id = findByName(name)!;
      const facts = w.get(id, 'knows')?.facts ?? {};
      expect(facts['the-hearth'], `${name} should hold 'the-hearth'`).toBeDefined();
      expect(facts['war-crest'], `${name} should hold 'war-crest'`).toBeDefined();
      expect(facts['the-hearth']!.aliases ?? [], `${name} the-hearth aliases`)
        .toEqual(expect.arrayContaining(['hearth']));
      expect(facts['war-crest']!.aliases ?? [], `${name} war-crest aliases`)
        .toEqual(expect.arrayContaining(['war crest']));
    }
  });

  it("Threnody's `deneth` topic aligns with Kessa's canon (Hearth, not War-Crest)", () => {
    // Kessa's `deneth` fact says "He wore Hearth grey"; Threnody's
    // faction attribution must not contradict this. Regression guard.
    const id = findByName('station terminal')!;
    const facts = w.get(id, 'knows')?.facts ?? {};
    const deneth = facts['deneth']!;
    expect(deneth.text.toLowerCase()).toContain('hearth');
    expect(deneth.text.toLowerCase()).not.toContain('war-crest');
  });
});
