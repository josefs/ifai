import { roomOf, type World } from '@ifai/engine';
import type { InPlayItem, NpcContext } from './types.js';

/**
 * Build the `NpcContext` an agent needs for one dialogue turn.
 *
 * Pure function over the world — never mutates. Returns `undefined`
 * for non-NPC entities so callers can guard on the result. Tag-system
 * fields (`roomTags`, `inPlayItems`, `tagReactions`) are populated when
 * the relevant components exist on the entity; the agent treats them
 * as fully optional.
 */
export function buildNpcContext(world: World, npcId: number): NpcContext | undefined {
  const npc = world.get(npcId, 'npc');
  if (!npc) return undefined;
  const name = world.get(npcId, 'name')?.value ?? `#${npcId}`;
  const knows = world.get(npcId, 'knows');
  const memory = world.get(npcId, 'dialogueMemory');
  const roomId = roomOf(world, npcId);
  const roomName = roomId !== undefined ? world.get(roomId, 'name')?.value ?? '' : '';
  const tagReactions = world.get(npcId, 'tagReactions')?.notes;
  const roomTags = roomId !== undefined ? world.get(roomId, 'tags')?.values : undefined;
  const inPlayItems = collectInPlayItems(world, npcId, roomId);
  const silica = world.get(npcId, 'silicaProtocol');
  const perceived = buildPerceived(world, npcId, roomId);
  return {
    id: npcId,
    name,
    persona: npc.persona,
    species: npc.species,
    mood: npc.mood,
    trust: npc.trust,
    facts: knows?.facts ?? {},
    recentDialogue: memory?.entries ?? [],
    roomBrief: roomName,
    ...(roomTags && roomTags.length ? { roomTags: [...roomTags] } : {}),
    ...(inPlayItems.length ? { inPlayItems } : {}),
    ...(tagReactions ? { tagReactions: { ...tagReactions } } : {}),
    ...(silica ? { silicaProtocol: { readyToSpeak: silica.readyToSpeak } } : {}),
    ...(perceived ? { perceived } : {}),
  };
}

/**
 * Snapshot of what the NPC can see in their own room this turn.
 *
 *   - roomName, roomDescription — the room's authored data.
 *   - entities — every non-NPC, non-player entity in the room, with
 *     name and (optional) description. NPCs and the player are
 *     excluded because the LLM already receives them via dialogue
 *     memory / addressing context.
 *
 * The LLM uses this to answer conversationally about things the NPC
 * can plainly see (a bar terminal, a slit window, a memorial script)
 * without needing every ambient feature pre-authored as a fact.
 *
 * Returns `undefined` if the NPC isn't in a room — nothing sensible to
 * report in that case.
 */
function buildPerceived(
  world: World,
  npcId: number,
  roomId: number | undefined,
): NpcContext['perceived'] {
  if (roomId === undefined) return undefined;
  const roomName = world.get(roomId, 'name')?.value ?? '';
  const roomDescription = world.get(roomId, 'description')?.text ?? '';
  const contents = world.get(roomId, 'container')?.contents ?? [];
  const entities: NonNullable<NpcContext['perceived']>['entities'] = [];
  for (const eid of contents) {
    if (eid === npcId) continue;
    if (world.get(eid, 'npc')) continue;
    if (world.get(eid, 'player')) continue;
    const eName = world.get(eid, 'name')?.value;
    if (!eName) continue;
    const desc = world.get(eid, 'description')?.text;
    entities.push({
      name: eName,
      ...(desc ? { description: desc } : {}),
      scenery: world.has(eid, 'scenery'),
    });
  }
  return { roomName, roomDescription, entities };
}

/**
 * Gather tagged items the NPC perceives this turn: items held by the
 * NPC, items held by the player, and loose items in the same room.
 * Items without any tags are skipped — they have nothing to contribute
 * to the tag-reactivity block. Other NPCs in the room are excluded
 * (modelling NPC↔NPC reactivity belongs to a later iteration).
 */
export function collectInPlayItems(
  world: World,
  npcId: number,
  roomId: number | undefined,
): InPlayItem[] {
  const out: InPlayItem[] = [];
  const playerId = findPlayer(world);

  const sources: Array<{ holderId: number | undefined; source: InPlayItem['source'] }> = [
    { holderId: npcId,    source: 'npc-held' },
    { holderId: playerId, source: 'player-held' },
    { holderId: roomId,   source: 'room' },
  ];

  for (const { holderId, source } of sources) {
    if (holderId === undefined) continue;
    const c = world.get(holderId, 'container');
    if (!c) continue;
    for (const eid of c.contents) {
      // Skip NPCs and the player when scanning a container's contents —
      // tags on people are about who they are, not props they'd be
      // commented on through reactivity.
      if (world.get(eid, 'npc') || world.get(eid, 'player')) continue;
      const tags = world.get(eid, 'tags')?.values;
      if (!tags || tags.length === 0) continue;
      out.push({
        name: world.get(eid, 'name')?.value ?? `#${eid}`,
        description: world.get(eid, 'description')?.text,
        tags: [...tags],
        source,
      });
    }
  }
  return out;
}

function findPlayer(world: World): number | undefined {
  for (let i = 0; i < 10_000; i++) {
    if (world.get(i, 'player')) return i;
  }
  return undefined;
}
