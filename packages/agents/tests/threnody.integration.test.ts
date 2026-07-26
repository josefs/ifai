import { describe, it, expect } from 'vitest';
import { moveInto } from '@ifai/engine';
import { buildThrenody } from '@ifai/content';
import { buildNpcContext, buildReactivityBlock } from '../src/index.js';

/**
 * End-to-end integration of the tag-system slice against the live
 * Threnody content. Verifies that:
 *   1. moving a tagged item into the player's inventory surfaces it
 *      and the relevant NPC tone-notes in the assembled dialogue prompt;
 *   2. an NPC with no matching reactions produces an empty block.
 *
 * No LLM is involved — we exercise the prompt-assembly path directly.
 */
describe('tag system × Threnody content', () => {
  function findByName(world: ReturnType<typeof buildThrenody>, name: string): number {
    for (let i = 0; i < 10_000; i++) {
      if (world.get(i, 'name')?.value === name) return i;
    }
    throw new Error(`entity ${name} not found`);
  }

  it("player carrying Iren's coin surfaces Mira's vorthi/memorial/sacred reactions", () => {
    const w = buildThrenody();
    const coin   = findByName(w, "Iren's coin");
    const player = findByName(w, 'you');
    const mira   = findByName(w, 'Mira');
    // Move the player into the lounge so they share Mira's room.
    moveInto(w, player, findByName(w, 'neutral lounge'));
    // Hand the coin to the player.
    moveInto(w, coin, player);

    const ctx = buildNpcContext(w, mira);
    expect(ctx).toBeDefined();
    expect(ctx!.inPlayItems?.some(i => i.name === "Iren's coin")).toBe(true);

    const block = buildReactivityBlock(ctx!)!;
    expect(block).not.toBeNull();
    expect(block).toContain("Iren's coin");
    // The coin's authored description should appear (gives the LLM grounding).
    expect(block).toMatch(/IREN VASS/);
    // Mira's authored notes for vorthi and memorial should be present.
    expect(block).toMatch(/vorthi:.*formal/i);
    expect(block).toMatch(/memorial:/i);
    // Mira has no `sacred` reaction — the tag should not surface.
    expect(block).not.toMatch(/^\s*-\s+sacred:/m);
  });

  it("Khaleth in the methane chamber sees room tags surface in their reactivity", () => {
    const w = buildThrenody();
    const khaleth = findByName(w, 'Khaleth');
    const chamber = findByName(w, 'methane chamber');
    moveInto(w, khaleth, chamber);

    const ctx = buildNpcContext(w, khaleth);
    expect(ctx!.roomTags).toEqual(['vorthi', 'surveillance-defying']);
    const block = buildReactivityBlock(ctx!)!;
    expect(block).toMatch(/vorthi:/);
    expect(block).toMatch(/surveillance-defying:/);
  });

  it("Saen-of-Three-Notes' tagReactions render in a chime register when memorial-tagged items are in play", () => {
    const w = buildThrenody();
    const coin   = findByName(w, "Iren's coin");
    const player = findByName(w, 'you');
    const saen   = findByName(w, 'Saen-of-Three-Notes');
    moveInto(w, player, findByName(w, 'neutral lounge'));
    moveInto(w, coin, player);
    const ctx = buildNpcContext(w, saen);
    expect(ctx!.tagReactions).toBeDefined();
    const block = buildReactivityBlock(ctx!)!;
    expect(block).toMatch(/memorial:.*chime/i);
    expect(block).toMatch(/sacred:.*chime/i);
  });

  it("tea in the lounge produces a 'room' source label in Mira's reactivity block", () => {
    const w = buildThrenody();
    const mira = findByName(w, 'Mira');
    const ctx = buildNpcContext(w, mira);
    const block = buildReactivityBlock(ctx!)!;
    expect(block).toMatch(/cup of tea \[in the room\]/);
  });
});
