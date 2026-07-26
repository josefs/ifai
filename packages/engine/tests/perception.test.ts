import { describe, it, expect } from 'vitest';
import { World, moveInto, perceive } from '../src/index.js';

/**
 * Verifies that perception exposes each entity's authored description.
 * The parser LLM relies on this to resolve "feature of" references —
 * e.g. "look at the delegation seating chart" when the chart is text
 * inside the datapad's description.
 */
describe('perception: entity descriptions', () => {
  function makeWorld() {
    const w = new World();
    const cabin = w.newEntity({
      room: {}, name: { value: 'cabin' },
      description: { text: 'A cabin.' },
      container: { contents: [] },
      ambientLit: { lit: true },
    });
    const datapad = w.newEntity({
      name: { value: 'datapad' }, portable: {},
      description: { text: 'Displays the delegation seating chart.' },
    });
    const lampPlain = w.newEntity({
      name: { value: 'lamp' }, // no description on purpose
    });
    const player = w.newEntity({
      player: {}, name: { value: 'you' },
      container: { contents: [] },
    });
    moveInto(w, datapad, player);
    moveInto(w, lampPlain, cabin);
    moveInto(w, player, cabin);
    return { w, cabin, datapad, lampPlain, player };
  }

  it('includes the description on inventory items', () => {
    const { w, datapad } = makeWorld();
    const p = perceive(w);
    const item = p.inventory.find(e => e.id === datapad);
    expect(item?.description).toBe('Displays the delegation seating chart.');
  });

  it('includes the description on visible room entities', () => {
    const { w } = makeWorld();
    // Move datapad out of inventory into the cabin so it's "visible".
    const cabin = p => p.room.id;
    const p = perceive(w);
    cabin(p); // shut up unused
    expect(p.room.visibleEntities.find(e => e.name === 'lamp')).toBeDefined();
  });

  it('omits the description field when the entity has no description', () => {
    const { w, lampPlain } = makeWorld();
    const p = perceive(w);
    const lamp = p.room.visibleEntities.find(e => e.id === lampPlain);
    expect(lamp).toBeDefined();
    expect(lamp).not.toHaveProperty('description');
  });
});
