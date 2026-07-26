import type { ComponentKey, ComponentMap, EntityId } from './components.js';

/**
 * Minimal ECS. Components are stored in per-type maps keyed by entity id.
 *
 * Mutation is allowed inside system functions; the apply() dispatcher in
 * `apply.ts` is responsible for treating each tick as an atomic step. We
 * deliberately do not deep-clone the world on every tick — IF turns are
 * cheap enough that a careful mutate-and-emit-events model is simpler than
 * full immutability and equally debuggable thanks to event logs.
 */
export class World {
  private nextId = 0;
  // Type-erased internally; the public API restores type safety per key.
  private components = new Map<ComponentKey, Map<EntityId, unknown>>();

  /** Create a new entity with an optional bundle of components. */
  newEntity(comps: Partial<ComponentMap> = {}): EntityId {
    const eid = this.nextId++;
    for (const k of Object.keys(comps) as ComponentKey[]) {
      const v = comps[k];
      if (v !== undefined) this.add(eid, k, v as ComponentMap[typeof k]);
    }
    return eid;
  }

  add<K extends ComponentKey>(eid: EntityId, key: K, value: ComponentMap[K]): void {
    let table = this.components.get(key);
    if (!table) {
      table = new Map<EntityId, unknown>();
      this.components.set(key, table);
    }
    table.set(eid, value);
  }

  remove<K extends ComponentKey>(eid: EntityId, key: K): void {
    this.components.get(key)?.delete(eid);
  }

  get<K extends ComponentKey>(eid: EntityId, key: K): ComponentMap[K] | undefined {
    return this.components.get(key)?.get(eid) as ComponentMap[K] | undefined;
  }

  has<K extends ComponentKey>(eid: EntityId, key: K): boolean {
    return this.components.get(key)?.has(eid) ?? false;
  }

  /** All entities that have all of the given components. */
  query(...keys: [ComponentKey, ...ComponentKey[]]): EntityId[] {
    const tables = keys.map(k => this.components.get(k));
    if (tables.some(t => !t)) return [];
    const [first, ...rest] = tables as Map<EntityId, unknown>[];
    const out: EntityId[] = [];
    for (const eid of first!.keys()) {
      if (rest.every(t => t.has(eid))) out.push(eid);
    }
    return out;
  }

  /** Iterate the (eid, value) pairs of a single component table. */
  *entries<K extends ComponentKey>(key: K): IterableIterator<[EntityId, ComponentMap[K]]> {
    const table = this.components.get(key);
    if (!table) return;
    for (const [eid, v] of table.entries()) {
      yield [eid, v as ComponentMap[K]];
    }
  }

  /** Resolve the unique player entity. */
  player(): EntityId {
    const ids = this.query('player');
    if (ids.length !== 1) {
      throw new Error(`expected exactly one player entity, found ${ids.length}`);
    }
    return ids[0]!;
  }
}

/* --------------------------- Clock helpers -------------------------------- *
 *
 * The clock is a singleton component on a dedicated entity, created by the
 * content layer. Two helpers keep callers from re-implementing the lookup
 * (and from accidentally creating two clocks).
 *
 * `minutes` is monotonic — `tickClock` only adds to it; the deadline clamp
 * is computed in perception so step 8 can still tell how late the player is.
 */

export function getClock(
  world: World,
): { minutes: number; openingSessionAt: number } | undefined {
  const ids = world.query('clock');
  if (ids.length === 0) return undefined;
  if (ids.length > 1) {
    throw new Error(`expected at most one clock entity, found ${ids.length}`);
  }
  return world.get(ids[0]!, 'clock');
}

export function tickClock(world: World, minutes: number): void {
  if (minutes <= 0) return;
  const ids = world.query('clock');
  if (ids.length === 0) return;
  if (ids.length > 1) {
    throw new Error(`expected at most one clock entity, found ${ids.length}`);
  }
  const c = world.get(ids[0]!, 'clock')!;
  c.minutes += minutes;
}

/* --------------------------- Containment helpers -------------------------- *
 *
 * Convention: `location.holderId` is canonical. `container.contents` mirrors
 * it. Always change containment through `moveInto` so they stay in sync.
 */

export function moveInto(world: World, eid: EntityId, holderId: EntityId): void {
  const loc = world.get(eid, 'location');
  if (loc !== undefined) {
    const oldHolder = world.get(loc.holderId, 'container');
    if (oldHolder) {
      const idx = oldHolder.contents.indexOf(eid);
      if (idx >= 0) oldHolder.contents.splice(idx, 1);
    }
    loc.holderId = holderId;
  } else {
    world.add(eid, 'location', { holderId });
  }
  let container = world.get(holderId, 'container');
  if (!container) {
    container = { contents: [] };
    world.add(holderId, 'container', container);
  }
  if (!container.contents.includes(eid)) container.contents.push(eid);
}

/** The room an entity is currently in, walking up the holder chain. */
export function roomOf(world: World, eid: EntityId): EntityId | undefined {
  let cur: EntityId | undefined = eid;
  let safety = 64;
  while (cur !== undefined && safety-- > 0) {
    if (world.has(cur, 'room')) return cur;
    cur = world.get(cur, 'location')?.holderId;
  }
  return undefined;
}
