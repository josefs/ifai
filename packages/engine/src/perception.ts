import type { EntityId, Direction } from './components.js';
import { World, getClock, roomOf } from './world.js';

/**
 * Perception — a serializable POV snapshot for the player. Both the parser
 * and narrator consume it. It is the *only* thing the LLM should see about
 * the world; never pass raw component tables to a model.
 *
 * Conventions:
 *  - Only entities reachable from the player's current room (and their
 *    own inventory) appear.
 *  - In a dark room with no carried light, visible entities are hidden.
 *  - Entity ids are exposed so the parser can return them by id; names and
 *    aliases are exposed so the parser can match phrases.
 */
export interface PerceivedEntity {
  id: EntityId;
  name: string;
  aliases: string[];
  portable: boolean;
  /**
   * True if this entity is scenery — examinable but not enumerated in
   * the room's rendered description. Used by the narrator to skip
   * enumeration, and by the parser as a hint that "look at the X" /
   * "look through the X" refers to a real (though ambient) entity.
   */
  scenery: boolean;
  /**
   * The entity's authored description, included so the parser LLM can
   * recognize when a player's phrasing refers to a feature *of* the
   * entity rather than the entity itself ("look at the delegation
   * seating chart" → examine the datapad whose description names it).
   * Optional because not every entity has a description.
   */
  description?: string;
  open?: boolean;
  locked?: boolean;
}

export interface PerceivedExit {
  dir: Direction;
  destinationId: EntityId;
  destinationName?: string;
}

export interface PerceivedRoom {
  id: EntityId;
  name: string;
  description: string;
  exits: PerceivedExit[];
  visibleEntities: PerceivedEntity[];
  lit: boolean;
}

/**
 * Player-visible game time. `minutes` is the engine's monotonic counter
 * (it never decreases or saturates). `minutesUntilSession` is clamped to
 * zero so renderers don't have to do the math, and `sessionStarted` is the
 * canonical "the deadline has passed" flag.
 *
 * Absent from the perception entirely when the world has no clock entity
 * (test worlds, alternate content packages).
 */
export interface PerceivedGameTime {
  minutes: number;
  openingSessionAt: number;
  minutesUntilSession: number;
  sessionStarted: boolean;
}

export interface Perception {
  room: PerceivedRoom;
  inventory: PerceivedEntity[];
  gameTime?: PerceivedGameTime;
}

export function perceive(world: World): Perception {
  const player = world.player();
  const roomId = roomOf(world, player);
  if (roomId === undefined) {
    throw new Error('player is not inside any room');
  }

  const lit = isRoomLit(world, roomId, player);
  const room = describeRoom(world, roomId, player, lit);
  const inventory = perceiveContents(world, player).filter(e => e.id !== player);

  const clock = getClock(world);
  const gameTime: PerceivedGameTime | undefined = clock && {
    minutes: clock.minutes,
    openingSessionAt: clock.openingSessionAt,
    minutesUntilSession: Math.max(0, clock.openingSessionAt - clock.minutes),
    sessionStarted: clock.minutes >= clock.openingSessionAt,
  };

  return { room, inventory, ...(gameTime ? { gameTime } : {}) };
}

function isRoomLit(world: World, roomId: EntityId, player: EntityId): boolean {
  const ambient = world.get(roomId, 'ambientLit');
  if (ambient?.lit) return true;
  for (const [eid, ls] of world.entries('lightSource')) {
    if (!ls.lit) continue;
    const holder = world.get(eid, 'location')?.holderId;
    if (holder === roomId || holder === player) return true;
  }
  return false;
}

function describeRoom(
  world: World,
  roomId: EntityId,
  player: EntityId,
  lit: boolean,
): PerceivedRoom {
  const name = world.get(roomId, 'name')?.value ?? 'somewhere';
  const description = world.get(roomId, 'description')?.text ?? '';
  const exits: PerceivedExit[] = [];
  const exitsComp = world.get(roomId, 'exits');
  if (exitsComp) {
    for (const [d, dest] of Object.entries(exitsComp.to) as [Direction, EntityId][]) {
      exits.push({ dir: d, destinationId: dest, destinationName: world.get(dest, 'name')?.value });
    }
  }
  const visibleEntities = lit
    ? perceiveContents(world, roomId).filter(e => e.id !== player)
    : [];
  return { id: roomId, name, description, exits, visibleEntities, lit };
}

function perceiveContents(world: World, holderId: EntityId): PerceivedEntity[] {
  const c = world.get(holderId, 'container');
  if (!c) return [];
  return c.contents.map(eid => describeEntity(world, eid));
}

function describeEntity(world: World, eid: EntityId): PerceivedEntity {
  const nameComp = world.get(eid, 'name');
  const desc = world.get(eid, 'description')?.text;
  const op = world.get(eid, 'openable');
  return {
    id: eid,
    name: nameComp?.value ?? `entity-${eid}`,
    aliases: nameComp?.aliases ?? [],
    portable: world.has(eid, 'portable'),
    scenery:  world.has(eid, 'scenery'),
    ...(desc ? { description: desc } : {}),
    ...(op ? { open: op.isOpen, locked: op.locked } : {}),
  };
}
