import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';
import { perceive } from '../src/perception.js';

function makeWorld() {
  const w = new World();
  const lobby = w.newEntity({
    room: {}, name: { value: 'lobby' },
    description: { text: 'A lobby.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const corridor = w.newEntity({
    room: {}, name: { value: 'corridor' },
    description: { text: 'A corridor.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  w.add(lobby, 'exits', { to: { spinward: corridor } });
  w.add(corridor, 'exits', { to: { antispinward: lobby } });
  const datapad = w.newEntity({
    name: { value: 'datapad' }, portable: {},
    description: { text: 'A scratched datapad.' },
  });
  moveInto(w, datapad, lobby);
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, player, lobby);
  return { w, lobby, corridor, datapad, player };
}

describe('apply', () => {
  it('moves the player through an exit', () => {
    const { w, corridor } = makeWorld();
    const r = apply(w, { kind: 'move', dir: 'spinward' });
    expect(r.events[0]).toMatchObject({ kind: 'moved', dir: 'spinward', to: corridor });
    expect(perceive(w).room.id).toBe(corridor);
  });

  it('refuses to move through a missing exit', () => {
    const { w } = makeWorld();
    const r = apply(w, { kind: 'move', dir: 'outward' });
    expect(r.events[0]).toMatchObject({ kind: 'failed', reason: 'no_exit' });
  });

  it('takes a portable item in the same room', () => {
    const { w, datapad, player } = makeWorld();
    const r = apply(w, { kind: 'take', target: datapad });
    expect(r.events[0]).toMatchObject({ kind: 'took', target: datapad });
    expect(w.get(datapad, 'location')!.holderId).toBe(player);
  });

  it('refuses to take an item not in the room', () => {
    const { w, datapad } = makeWorld();
    apply(w, { kind: 'move', dir: 'spinward' });
    const r = apply(w, { kind: 'take', target: datapad });
    expect(r.events[0]).toMatchObject({ kind: 'failed', reason: 'not_here' });
  });

  it('goto resolves an adjacent room id to the right exit', () => {
    const { w, corridor } = makeWorld();
    const r = apply(w, { kind: 'goto', target: corridor });
    expect(r.events[0]).toMatchObject({ kind: 'moved', dir: 'spinward', to: corridor });
    expect(perceive(w).room.id).toBe(corridor);
  });

  it('goto fails for a non-adjacent target', () => {
    const { w, lobby } = makeWorld();
    apply(w, { kind: 'move', dir: 'spinward' }); // now in corridor
    const r = apply(w, { kind: 'goto', target: 9999 });
    expect(r.events[0]).toMatchObject({ kind: 'failed', action: 'goto', reason: 'no_exit' });
    expect(perceive(w).room.id).not.toBe(lobby);
  });

  it('drops a held item back into the room', () => {
    const { w, lobby, datapad } = makeWorld();
    apply(w, { kind: 'take', target: datapad });
    const r = apply(w, { kind: 'drop', target: datapad });
    expect(r.events[0]).toMatchObject({ kind: 'dropped', target: datapad, into: lobby });
    expect(w.get(datapad, 'location')!.holderId).toBe(lobby);
  });
});

describe('perceive', () => {
  it('lists visible entities in the player room', () => {
    const { w, datapad } = makeWorld();
    const p = perceive(w);
    expect(p.room.visibleEntities.map(e => e.id)).toContain(datapad);
    expect(p.room.lit).toBe(true);
  });

  it('hides visible entities in the dark', () => {
    const { w, lobby } = makeWorld();
    w.get(lobby, 'ambientLit')!.lit = false;
    const p = perceive(w);
    expect(p.room.lit).toBe(false);
    expect(p.room.visibleEntities).toEqual([]);
  });
});
