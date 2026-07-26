import type { EntityId, KnownFact, DialogueMemoryEntry } from './components.js';
import type { World } from './world.js';

/**
 * NPC mutation helpers used by the `respondAsNpc` carryOut rule (and
 * potentially by content-author rules that want to nudge NPC state
 * without going through the dialogue agent).
 *
 * All helpers are no-ops on entities that lack the relevant component,
 * so callers can be defensive without explicit checks. Numeric helpers
 * clamp into bounds so the engine stays the single arbiter of valid
 * state regardless of what the LLM proposes.
 */

/** Default cap on per-NPC dialogue memory length. */
export const DIALOGUE_MEMORY_CAP = 8;

/** Replace an NPC's mood. No-op if the entity is not an NPC. */
export function setNpcMood(world: World, npcId: EntityId, mood: string): void {
  const n = world.get(npcId, 'npc');
  if (!n) return;
  n.mood = mood;
}

/**
 * Adjust an NPC's trust by a signed delta. The delta itself is clamped
 * to ±10 (so a single exchange can't swing trust wildly), then the
 * resulting value is clamped to [0,100].
 *
 * Returns the new trust value, or undefined if the entity isn't an NPC.
 */
export function adjustNpcTrust(world: World, npcId: EntityId, delta: number): number | undefined {
  const n = world.get(npcId, 'npc');
  if (!n) return undefined;
  const clampedDelta = Math.max(-10, Math.min(10, Math.trunc(delta)));
  n.trust = Math.max(0, Math.min(100, n.trust + clampedDelta));
  return n.trust;
}

/**
 * Append an entry to an NPC's dialogue memory (FIFO). The component is
 * created lazily if absent. The list is trimmed to `cap` entries
 * (oldest first) after the push.
 */
export function pushDialogueMemory(
  world: World,
  npcId: EntityId,
  entry: DialogueMemoryEntry,
  cap: number = DIALOGUE_MEMORY_CAP,
): void {
  let mem = world.get(npcId, 'dialogueMemory');
  if (!mem) {
    mem = { entries: [] };
    world.add(npcId, 'dialogueMemory', mem);
  }
  mem.entries.push(entry);
  if (mem.entries.length > cap) {
    mem.entries.splice(0, mem.entries.length - cap);
  }
}

/**
 * Teach a learner one fact. Creates the `knows` component if absent.
 * If the learner already knows this topic, the existing entry is
 * preserved (we don't overwrite — first revelation wins).
 */
export function learnTopic(
  world: World,
  learnerId: EntityId,
  topicId: string,
  fact: KnownFact,
): void {
  let knows = world.get(learnerId, 'knows');
  if (!knows) {
    knows = { facts: {} };
    world.add(learnerId, 'knows', knows);
  }
  if (!(topicId in knows.facts)) {
    knows.facts[topicId] = fact;
  }
}
