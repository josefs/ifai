import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';

/**
 * Verifies the tag-system content slice on threnody.ts:
 *   - items / rooms carry the intended `tags` values
 *   - the three slice NPCs (Mira, Khaleth, Threnody) carry tagReactions
 *   - every tag used on an entity appears in at least one slice-NPC's
 *     reactions (authoring-discipline check; protects against dead tags).
 */
describe('buildThrenody — tag system content slice', () => {
  const w = buildThrenody();

  function findByName(name: string): number {
    for (let i = 0; i < 10_000; i++) {
      const n = w.get(i, 'name');
      if (n?.value === name) return i;
    }
    throw new Error(`entity ${name} not found`);
  }

  const itemTags: Array<{ name: string; tags: string[] }> = [
    { name: 'credentials badge',     tags: ['credential', 'human-delegation'] },
    { name: 'datapad',               tags: ['mundane', 'human-delegation'] },
    { name: 'cup of tea',            tags: ['mundane', 'human-delegation'] },
    { name: "Iren's coin",           tags: ['vorthi', 'memorial', 'sacred'] },
    { name: 'breath-mask',           tags: ['vorthi'] },
    { name: 'chime-fragment',        tags: ['sacred'] },
    { name: 'off-record recording',  tags: ['evidence', 'surveillance-defying'] },
  ];

  it('items carry the authored tags', () => {
    for (const { name, tags } of itemTags) {
      const id = findByName(name);
      const stored = w.get(id, 'tags');
      expect(stored, `${name} missing tags`).toBeDefined();
      expect(stored!.values).toEqual(tags);
    }
  });

  it('memorial wall and methane chamber carry room tags', () => {
    expect(w.get(findByName('memorial wall'),    'tags')!.values).toEqual(['memorial', 'sacred']);
    expect(w.get(findByName('methane chamber'),  'tags')!.values).toEqual(['vorthi', 'surveillance-defying']);
  });

  const sliceNpcs = ['Mira', 'Khaleth', 'station terminal', 'Tasen', 'Saen-of-Three-Notes', 'Aslin Keer'];

  it('slice NPCs (Mira, Khaleth, station terminal) carry tagReactions', () => {
    for (const npc of sliceNpcs) {
      const r = w.get(findByName(npc), 'tagReactions');
      expect(r, `${npc} missing tagReactions`).toBeDefined();
      expect(Object.keys(r!.notes).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('every tag used on an entity is matched by at least one slice NPC reaction', () => {
    const usedTags = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const t = w.get(i, 'tags');
      if (t) for (const v of t.values) usedTags.add(v);
    }
    const reactedTags = new Set<string>();
    for (const npc of sliceNpcs) {
      const r = w.get(findByName(npc), 'tagReactions');
      if (r) for (const k of Object.keys(r.notes)) reactedTags.add(k);
    }
    const unreacted = [...usedTags].filter(t => !reactedTags.has(t));
    expect(unreacted, `tags with no slice-NPC reaction: ${unreacted.join(', ')}`).toEqual([]);
  });
});
