import { describe, it, expect } from 'vitest';
import { buildThrenody, hintFor } from '../src/index.js';
import { moveInto, tickClock } from '@ifai/engine';

/**
 * The hint provider is a small decision tree over world state. The
 * cases below cover each rung of the ladder in the order the tree
 * evaluates: arc-resolved, no Mira contact, two+ items secured,
 * time-pressure fallback, one-item follow-ups, zero-item nudges, and
 * the unconditional last rung. Each case constructs a bare minimum
 * of state to reach that rung.
 */
function findByName(w: ReturnType<typeof buildThrenody>, name: string): number {
  for (let i = 0; i < 10_000; i++) {
    if (w.get(i, 'name')?.value === name) return i;
  }
  throw new Error(`not found: ${name}`);
}

function findEndingEntity(w: ReturnType<typeof buildThrenody>): number {
  for (const [eid] of w.entries('endingState')) return eid;
  throw new Error('endingState singleton missing');
}

/** Record a fake dialogue entry so `hasSpokenTo` reads true. */
function pretendSpokenTo(w: ReturnType<typeof buildThrenody>, npcName: string): void {
  const id = findByName(w, npcName);
  const dm = w.get(id, 'dialogueMemory');
  if (!dm) throw new Error(`${npcName} has no dialogueMemory`);
  dm.entries.push({ speaker: 'player', text: '(setup)' } as never);
}

describe('hintFor — Contested Casualty ladder', () => {
  it('opens by pointing the player to Mira before anything else', () => {
    const w = buildThrenody();
    expect(hintFor(w)).toMatch(/Mira/);
  });

  it('names the lounge when Mira is elsewhere', () => {
    const w = buildThrenody();
    expect(hintFor(w)).toMatch(/neutral lounge/);
  });

  it('after Mira contact but no items, steers to an untouched delegate', () => {
    const w = buildThrenody();
    pretendSpokenTo(w, 'Mira');
    // Khaleth is checked first in the untouched-delegate loop.
    expect(hintFor(w)).toMatch(/Khaleth/);
  });

  it('after all four principals spoken to but nothing secured, offers the gates line', () => {
    const w = buildThrenody();
    for (const n of ['Mira', 'Khaleth', 'Tasen', 'Saen-of-Three-Notes', 'Aslin Keer']) {
      pretendSpokenTo(w, n);
    }
    expect(hintFor(w)).toMatch(/all four|memorial gesture|truth spoken|commitment/i);
  });

  it("with one story item (coin) secured, nudges toward Saen for the second voice", () => {
    const w = buildThrenody();
    pretendSpokenTo(w, 'Mira');
    const player = w.player();
    const coin = findByName(w, "Iren's coin");
    moveInto(w, coin, player);
    expect(hintFor(w)).toMatch(/Saen/);
  });

  it("with two story items secured, points to the memorial wall", () => {
    const w = buildThrenody();
    pretendSpokenTo(w, 'Mira');
    const player = w.player();
    moveInto(w, findByName(w, "Iren's coin"), player);
    moveInto(w, findByName(w, 'chime-fragment'), player);
    expect(hintFor(w)).toMatch(/memorial wall/);
  });

  it("when the player is standing at the wall with items, frames the hint in-place", () => {
    const w = buildThrenody();
    pretendSpokenTo(w, 'Mira');
    const player = w.player();
    moveInto(w, player, findByName(w, 'memorial wall'));
    moveInto(w, findByName(w, "Iren's coin"), player);
    moveInto(w, findByName(w, 'chime-fragment'), player);
    expect(hintFor(w)).toMatch(/wall is here|present/i);
  });

  it("under 30 minutes with only the badge, urges the procedural closing", () => {
    const w = buildThrenody();
    pretendSpokenTo(w, 'Mira');
    const player = w.player();
    moveInto(w, findByName(w, 'credentials badge'), player);
    tickClock(w, 160); // 180 openingSessionAt - 160 = 20 min left
    const hint = hintFor(w);
    expect(hint).toMatch(/procedural|badge|witness/i);
  });

  it("when the arc has resolved, says there's nothing left to prepare for", () => {
    const w = buildThrenody();
    const ent = findEndingEntity(w);
    const state = w.get(ent, 'endingState')!;
    state.resolved = 'procedural';
    expect(hintFor(w)).toMatch(/doors are already open|nothing left/i);
  });
});
