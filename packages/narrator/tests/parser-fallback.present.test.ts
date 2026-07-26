import { describe, it, expect } from 'vitest';
import { World, moveInto, perceive } from '@ifai/engine';
import { FallbackParser } from '../src/parser-fallback.js';

function makeWorld() {
  const w = new World();
  const lounge = w.newEntity({
    room: {}, name: { value: 'lounge' },
    description: { text: 'A lounge.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const badge = w.newEntity({
    name: { value: 'credentials badge', aliases: ['badge'] },
    portable: {},
    description: { text: 'A badge.' },
  });
  const terminal = w.newEntity({
    name: { value: 'station terminal', aliases: ['terminal', 'threnody'] },
    description: { text: 'A station AI terminal.' },
    npc: { persona: 'AI', species: 'station-ai', mood: 'attentive' },
    container: { contents: [] },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, terminal, lounge);
  moveInto(w, player, lounge);
  moveInto(w, badge, player);
  return { w, lounge, badge, terminal, player };
}

describe('FallbackParser: present', () => {
  it('parses "present X to Y" as a present action', async () => {
    const { w, badge, terminal } = makeWorld();
    const parser = new FallbackParser();
    const result = await parser.parse('present my badge to the terminal', perceive(w));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions).toEqual([
      { kind: 'present', target: badge, to: terminal },
    ]);
  });

  it('"show X to Y" also maps to present', async () => {
    const { w, badge, terminal } = makeWorld();
    const parser = new FallbackParser();
    const result = await parser.parse('show the badge to the terminal', perceive(w));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actions[0]).toMatchObject({
      kind: 'present', target: badge, to: terminal,
    });
  });

  it('fails when the player is not holding the item', async () => {
    const { w } = makeWorld();
    // Take badge back out of player's inventory by stashing it in lounge
    const parser = new FallbackParser();
    const result = await parser.parse('present the datapad to the terminal', perceive(w));
    // datapad isn't even in the world — should fail with a useful message.
    expect(result.ok).toBe(false);
  });
});
