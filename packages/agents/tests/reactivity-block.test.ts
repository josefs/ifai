import { describe, it, expect } from 'vitest';
import { buildReactivityBlock, type NpcContext, type InPlayItem } from '../src/index.js';

const baseNpc: NpcContext = {
  id: 1,
  name: 'Mira',
  persona: 'human diplomat',
  species: 'human',
  mood: 'guarded',
  trust: 50,
  facts: {},
  recentDialogue: [],
  roomBrief: 'lounge',
};

function item(partial: Partial<InPlayItem> & { name: string; tags: string[] }): InPlayItem {
  return { source: 'player-held', ...partial };
}

describe('buildReactivityBlock', () => {
  it('returns null when the NPC has no tagReactions', () => {
    expect(buildReactivityBlock(baseNpc)).toBeNull();
  });

  it('returns null when tagReactions is empty', () => {
    expect(buildReactivityBlock({ ...baseNpc, tagReactions: {} })).toBeNull();
  });

  it('returns null when nothing tagged is in play', () => {
    expect(buildReactivityBlock({
      ...baseNpc,
      tagReactions: { vorthi: 'careful' },
    })).toBeNull();
  });

  it('returns null when in-play tags do not match any reaction', () => {
    const out = buildReactivityBlock({
      ...baseNpc,
      tagReactions: { vorthi: 'careful' },
      inPlayItems: [item({ name: 'lamp', tags: ['mundane', 'illumination'] })],
    });
    expect(out).toBeNull();
  });

  it('renders matched tag reactions and the items that triggered them', () => {
    const out = buildReactivityBlock({
      ...baseNpc,
      tagReactions: {
        vorthi:   'Careful and formal.',
        memorial: 'Subdued, exact.',
        mundane:  'Brief.',
      },
      inPlayItems: [
        item({ name: "Iren's coin", description: 'A small disc.', tags: ['vorthi', 'memorial', 'sacred'] }),
        item({ name: 'lamp', tags: ['illumination'] }),
      ],
    });
    expect(out).not.toBeNull();
    expect(out).toContain('Reactivity in play');
    expect(out).toContain("Iren's coin");
    // Item-triggering content shown
    expect(out).toContain('A small disc.');
    // Matched reactions shown
    expect(out).toContain('vorthi: Careful and formal.');
    expect(out).toContain('memorial: Subdued, exact.');
    // 'sacred' is on the item but has no reaction for this NPC — not rendered
    expect(out).not.toContain('sacred:');
    // 'mundane' has a reaction but no item triggered it — not rendered
    expect(out).not.toContain('mundane:');
    // The untagged-by-reaction lamp is filtered out
    expect(out).not.toContain('lamp');
  });

  it('uses room tags as a source of tags-in-play', () => {
    const out = buildReactivityBlock({
      ...baseNpc,
      tagReactions: { memorial: 'lowers head' },
      roomTags: ['memorial', 'sacred'],
    });
    expect(out).not.toBeNull();
    expect(out).toContain('memorial: lowers head');
  });

  it('labels item source (held by NPC vs player vs in the room)', () => {
    const out = buildReactivityBlock({
      ...baseNpc,
      tagReactions: { credential: 'pragmatic' },
      inPlayItems: [
        item({ name: 'badge A', tags: ['credential'], source: 'player-held' }),
        item({ name: 'badge B', tags: ['credential'], source: 'npc-held' }),
        item({ name: 'badge C', tags: ['credential'], source: 'room' }),
      ],
    });
    expect(out).toContain('badge A [player carries]');
    expect(out).toContain('badge B [you carry]');
    expect(out).toContain('badge C [in the room]');
  });

  it('sorts tag list within an item and the reactions list alphabetically', () => {
    const out = buildReactivityBlock({
      ...baseNpc,
      tagReactions: { vorthi: 'V', memorial: 'M', credential: 'C' },
      inPlayItems: [item({ name: 'thing', tags: ['vorthi', 'credential', 'memorial'] })],
    })!;
    // tags listed alphabetically within the item line
    expect(out).toMatch(/\(credential, memorial, vorthi\)/);
    // reactions listed alphabetically by tag
    const credIdx = out.indexOf('credential: C');
    const memIdx  = out.indexOf('memorial: M');
    const vorIdx  = out.indexOf('vorthi: V');
    expect(credIdx).toBeGreaterThan(-1);
    expect(memIdx).toBeGreaterThan(credIdx);
    expect(vorIdx).toBeGreaterThan(memIdx);
  });
});
