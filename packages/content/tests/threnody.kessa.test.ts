import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';

/**
 * Kessa — Vorthi Hearth war-widow at the memorial wall.
 *
 * Enrichment package B: no mechanics, no ending consequence. She exists to
 * humanise the memorial and give the player a warm, personal account of
 * Iren Vass before Khaleth's gated geopolitical version unlocks. These
 * tests just lock in the authored shape so future edits don't quietly
 * strip her voice.
 */
describe('Kessa — memorial widow', () => {
  const w = buildThrenody();

  function findByName(name: string): number | undefined {
    for (let i = 0; i < 10_000; i++) {
      if (w.get(i, 'name')?.value === name) return i;
    }
    return undefined;
  }

  const kessaId = findByName('Kessa');

  it('exists as a Vorthi NPC in a grieving register with default trust 45', () => {
    expect(kessaId).toBeDefined();
    const npc = w.get(kessaId!, 'npc')!;
    expect(npc.species).toBe('vorthi');
    expect(npc.mood).toBe('grieving');
    expect(npc.trust).toBe(45);
    expect(w.get(kessaId!, 'species')?.id).toBe('vorthi');
  });

  it('carries the expected topic set (personal, not political)', () => {
    const facts = w.get(kessaId!, 'knows')?.facts ?? {};
    for (const key of [
      'kessa-herself',
      'deneth',
      'the-memorial',
      'naming-rite',
      'iren-vass',
      'the-negotiations',
    ]) {
      expect(facts, `Kessa should hold topic "${key}"`).toHaveProperty(key);
    }
  });

  it('offers no plot-critical evidence — her Iren-Vass account is personal, not accusatory', () => {
    const facts = w.get(kessaId!, 'knows')?.facts ?? {};
    const iren = facts['iren-vass']?.text ?? '';
    expect(iren).toMatch(/kind|person|remember/i);
    // Must not leak the Khaleth/Tasen faction argument.
    expect(iren).not.toMatch(/war-crest|extremist|cell/i);
  });

  it('reacts to the tags that matter at a memorial', () => {
    const notes = w.get(kessaId!, 'tagReactions')?.notes ?? {};
    for (const tag of [
      'sacred',
      'vorthi',
      'memorial',
      'evidence',
      'credential',
      'mundane',
    ]) {
      expect(notes, `tagReaction for "${tag}"`).toHaveProperty(tag);
      expect(notes[tag].length, `tagReaction "${tag}" not empty`).toBeGreaterThan(0);
    }
  });

  it('softens for sacred offerings and closes down for evidence', () => {
    const notes = w.get(kessaId!, 'tagReactions')?.notes ?? {};
    expect(notes['sacred']).toMatch(/soften|name|deneth|rite/i);
    expect(notes['evidence']).toMatch(/close|leverage|away/i);
  });

  it('is woven into the world: Khaleth and Threnody both know her', () => {
    const khaleth = w.get(findByName('Khaleth')!, 'knows')?.facts ?? {};
    const threnody = w.get(findByName('station terminal')!, 'knows')?.facts ?? {};
    expect(khaleth).toHaveProperty('kessa');
    expect(threnody).toHaveProperty('kessa');
  });
});
