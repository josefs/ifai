import { describe, it, expect } from 'vitest';
import { World } from '../src/index.js';

/**
 * `tags` and `tagReactions` are pure data components. These tests
 * verify they round-trip through the world's component store and
 * coexist with other components on the same entity.
 */
describe('components: tags', () => {
  it('stores and retrieves tag values on an item', () => {
    const w = new World();
    const coin = w.newEntity({
      name: { value: "Iren's coin" },
      portable: {},
      tags: { values: ['vorthi', 'memorial', 'evidence'] },
    });
    const tags = w.get(coin, 'tags');
    expect(tags).toBeDefined();
    expect(tags!.values).toEqual(['vorthi', 'memorial', 'evidence']);
  });

  it('stores tags on a room', () => {
    const w = new World();
    const memorialWall = w.newEntity({
      room: {},
      name: { value: 'memorial wall' },
      container: { contents: [] },
      tags: { values: ['memorial', 'sacred'] },
    });
    expect(w.get(memorialWall, 'tags')!.values).toContain('memorial');
  });

  it('returns undefined for entities without tags', () => {
    const w = new World();
    const plain = w.newEntity({ name: { value: 'lamp' } });
    expect(w.get(plain, 'tags')).toBeUndefined();
  });
});

describe('components: tagReactions', () => {
  it('stores tone notes keyed by tag on an NPC', () => {
    const w = new World();
    const mira = w.newEntity({
      name: { value: 'Mira' },
      npc: { persona: 'human ambassador', species: 'human', mood: 'tense', trust: 50 },
      tagReactions: {
        notes: {
          'vorthi':   'Careful, formal. Will not mistranslate.',
          'memorial': 'Subdued, exact. Will not joke.',
          'evidence': 'Sharp focus, weighs implications.',
        },
      },
    });
    const reactions = w.get(mira, 'tagReactions');
    expect(reactions).toBeDefined();
    expect(reactions!.notes['vorthi']).toMatch(/formal/);
    expect(Object.keys(reactions!.notes)).toHaveLength(3);
  });

  it('coexists with other NPC components', () => {
    const w = new World();
    const npc = w.newEntity({
      name: { value: 'Khaleth' },
      npc: { persona: 'vorthi envoy', species: 'vorthi', mood: 'grave', trust: 40 },
      knows: { facts: { 'iren-vass': { text: 'Iren-Vass fell at Auber-Six.' } } },
      tagReactions: { notes: { 'memorial': 'lowers head' } },
    });
    expect(w.get(npc, 'npc')).toBeDefined();
    expect(w.get(npc, 'knows')).toBeDefined();
    expect(w.get(npc, 'tagReactions')!.notes['memorial']).toBe('lowers head');
  });
});
