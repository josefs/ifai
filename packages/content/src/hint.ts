/*
 * Content-side hint provider for the Contested Casualty arc.
 *
 * Called from the CLI when the player types `hint` (or `?hint`). The
 * function inspects the current world state — clock, endingState,
 * player location and inventory, and dialogue memory on the principal
 * NPCs — and returns a single short in-fiction nudge.
 *
 * Design principles:
 *
 * - **Content owns the ladder.** The hint tree is arc-specific:
 *   which items lead to which endings, which NPCs hold what, which
 *   room the wall is in. The engine has none of this. Putting the
 *   ladder here keeps the engine content-agnostic.
 *
 * - **First match wins.** The ladder is authored as a sequence of
 *   `(condition, line)` pairs; the first condition that fires
 *   returns. The last entry is unconditional so `hintFor` always
 *   returns something.
 *
 * - **No spoilers, no walkthrough.** The hints name people and
 *   places but never the specific item to trade, the specific
 *   question to ask, or the specific ending. They point; they do
 *   not solve.
 *
 * - **In-fiction voice.** Written as narrator observation, not
 *   system prose. No "you should" — instead, "the wall is
 *   antispinward through the corridor."
 */

import type { EntityId, World } from '@ifai/engine';
import { roomOf } from '@ifai/engine';

/** Find the singleton entity of a component. */
function singleton<K extends Parameters<World['entries']>[0]>(
  w: World, key: K,
): EntityId | undefined {
  for (const [eid] of w.entries(key)) return eid;
  return undefined;
}

/** Find an entity by exact `name.value`. Returns undefined if absent. */
function findByName(w: World, name: string): EntityId | undefined {
  for (const [eid, n] of w.entries('name')) {
    if (n.value === name) return eid;
  }
  return undefined;
}

/** True iff `item` is somewhere in `holder`'s transitive container. */
function heldBy(w: World, item: EntityId, holder: EntityId): boolean {
  const loc = w.get(item, 'location');
  return loc?.holderId === holder;
}

/** True iff the NPC has any dialogue memory with the player. */
function hasSpokenTo(w: World, npcId: EntityId | undefined): boolean {
  if (npcId === undefined) return false;
  const dm = w.get(npcId, 'dialogueMemory');
  return (dm?.entries?.length ?? 0) > 0;
}

/**
 * Return a short, in-fiction nudge based on world state. Always
 * returns a non-empty string; the ladder's last rung is unconditional.
 */
export function hintFor(w: World): string {
  const player = w.player();
  const playerRoom = roomOf(w, player);

  const clockEnt = singleton(w, 'clock');
  const clock = clockEnt !== undefined ? w.get(clockEnt, 'clock') : undefined;
  const minutesLeft = clock ? clock.openingSessionAt - clock.minutes : Infinity;

  const endingStateEnt = singleton(w, 'endingState');
  const ending = endingStateEnt !== undefined
    ? w.get(endingStateEnt, 'endingState')
    : undefined;

  // Arc resolved — nothing to advise.
  if (ending?.resolved) {
    return 'The doors are already open. There is nothing left to prepare for.';
  }

  // Locate the four ending-eligible items by canonical name. If any
  // are missing (content changed), the hint degrades gracefully:
  // conditions that reference the missing id simply never fire.
  const coin      = findByName(w, "Iren's coin");
  const chime     = findByName(w, 'chime-fragment');
  const recording = findByName(w, 'off-record recording');
  const badge     = findByName(w, 'credentials badge');

  // Item disposition helpers. An item counts as "secured" if the
  // player is carrying it OR has already presented it at the wall.
  const inInventory = (id: EntityId | undefined) =>
    id !== undefined && heldBy(w, id, player);
  const alreadyPresented = (id: EntityId | undefined) =>
    id !== undefined && (ending?.presentedAtWall.includes(id) ?? false);
  const secured = (id: EntityId | undefined) =>
    inInventory(id) || alreadyPresented(id);

  const securedStoryItems = [coin, chime, recording].filter(secured).length;
  const hasBadge = secured(badge);

  // Principal NPCs — used both for "haven't spoken to" checks and
  // for room-direction hints. Look them up once.
  const mira    = findByName(w, 'Mira');
  const khaleth = findByName(w, 'Khaleth');
  const tasen   = findByName(w, 'Tasen');
  const saen    = findByName(w, 'Saen-of-Three-Notes');
  const aslin   = findByName(w, 'Aslin Keer');

  const memorialWall = findByName(w, 'memorial wall');
  const lounge       = findByName(w, 'neutral lounge');
  const balcony      = findByName(w, 'observation balcony');

  // Very early: haven't met Mira yet. The briefing is the seed of
  // everything; nothing else makes sense before it.
  if (!hasSpokenTo(w, mira)) {
    const where = playerRoom === lounge
      ? 'Mira is here. She was waiting.'
      : 'Mira Vane was expecting you in the neutral lounge, spinward through the corridor.';
    return where;
  }

  // Two or more story items secured — the wall is the next move.
  // Frame around whichever room the player is standing in.
  if (securedStoryItems >= 2) {
    if (playerRoom === memorialWall) {
      return 'You have what you brought. The wall is here; present, then attend the session.';
    }
    return 'The memorial wall is antispinward through the corridor. Present what you carry before the doors open.';
  }

  // Time is short and the player has nothing story-critical. Even the
  // badge alone resolves to the procedural ending — better than the
  // walkout.
  if (minutesLeft <= 30 && securedStoryItems === 0) {
    if (hasBadge) {
      return 'The chime is close. The wall accepts even a single badge as a form of witness; a procedural closing is better than the doors opening on an empty hand.';
    }
    return 'Time is short. Reach the memorial wall with whatever you can carry — even your badge counts as witness at the wall.';
  }

  // Exactly one story item — nudge toward the complementary item for
  // the richest matching ending. Priority order matches the ending
  // catalogue: the two-item endings before the procedural.
  if (securedStoryItems === 1) {
    if (secured(coin)) {
      // vorthi-truth wants coin + chime.
      return hintTowardSaen(w, playerRoom, saen);
    }
    if (secured(chime)) {
      // vorthi-truth (with coin) or human-truth (with recording).
      // Prefer the untouched thread.
      const spokenKhaleth = hasSpokenTo(w, khaleth);
      const spokenAslin   = hasSpokenTo(w, aslin);
      if (!spokenKhaleth) return hintTowardKhaleth(w, playerRoom, khaleth);
      if (!spokenAslin)   return hintTowardAslin(w, playerRoom, aslin, balcony);
      return 'You have one voice; the second — Khaleth or Aslin Keer — will make the account matter.';
    }
    if (secured(recording)) {
      // human-truth wants recording + chime.
      return hintTowardSaen(w, playerRoom, saen);
    }
  }

  // Zero story items. Steer toward the least-explored delegate.
  // Weight: which principal has the player not yet drawn out.
  const untouched: string[] = [];
  if (!hasSpokenTo(w, khaleth)) untouched.push('Khaleth, at the rim wall of the lounge');
  if (!hasSpokenTo(w, tasen))   untouched.push('Tasen, near the antispinward arch');
  if (!hasSpokenTo(w, saen))    untouched.push('Saen-of-Three-Notes, on the silica dais');
  if (!hasSpokenTo(w, aslin))   untouched.push('Aslin Keer, on the observation balcony');

  if (untouched.length > 0) {
    return `You have not yet drawn out ${untouched[0]}. Each holds a piece of what happened.`;
  }

  // All principals spoken to, no items secured. The gates are the
  // usual sticking points; point at them without saying which.
  return 'You have heard from all four. Each will part with something when the right thing is offered — a memorial gesture, a truth spoken plainly, a commitment made.';
}

function hintTowardSaen(
  w: World, playerRoom: EntityId | undefined, saen: EntityId | undefined,
): string {
  const saenRoom = saen !== undefined ? roomOf(w, saen) : undefined;
  if (playerRoom !== undefined && playerRoom === saenRoom) {
    return "Saen-of-Three-Notes is here. What they hold is answered in silica, not in words.";
  }
  return "Saen-of-Three-Notes waits in the methane chamber, inward of the lounge. The chime they carry is the second voice.";
}

function hintTowardKhaleth(
  w: World, playerRoom: EntityId | undefined, khaleth: EntityId | undefined,
): string {
  const khalethRoom = khaleth !== undefined ? roomOf(w, khaleth) : undefined;
  if (playerRoom !== undefined && playerRoom === khalethRoom) {
    return 'Khaleth is here. The Hearth speaks after the dead are acknowledged, not before.';
  }
  return 'Khaleth waits in the neutral lounge. Approach the Hearth as the Hearth expects to be approached.';
}

function hintTowardAslin(
  w: World, playerRoom: EntityId | undefined,
  aslin: EntityId | undefined, balcony: EntityId | undefined,
): string {
  const aslinRoom = aslin !== undefined ? roomOf(w, aslin) : undefined;
  if (playerRoom !== undefined && playerRoom === aslinRoom) {
    return 'Aslin Keer is here. What he holds, he trades — and only for something he judges worth the trade.';
  }
  void balcony;
  return 'Aslin Keer is out on the observation balcony, above the lounge. He will trade, but he does not give.';
}
