import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';
import type { Event } from '../src/events.js';

function makeWorld(opts: { proactive?: boolean; priorMemory?: boolean } = {}) {
  const w = new World();
  const cabin = w.newEntity({
    room: {}, name: { value: 'cabin' },
    description: { text: 'A cabin.' },
    container: { contents: [] },
    ambientLit: { lit: true },
    exits: { to: { out: -1 } },
  });
  const lounge = w.newEntity({
    room: {}, name: { value: 'lounge' },
    description: { text: 'A lounge.' },
    container: { contents: [] },
    ambientLit: { lit: true },
    exits: { to: { in: cabin } },
  });
  // patch back-edge now that lounge id is known
  w.get(cabin, 'exits')!.to.out = lounge;

  const npc = w.newEntity({
    name: { value: 'Mira' },
    description: { text: 'Mira.' },
    npc: { persona: 'p', species: 'human', mood: 'guarded', trust: 50 },
    species: { id: 'human' },
    knows: { facts: {} },
    dialogueMemory: {
      entries: opts.priorMemory
        ? [{ kind: 'said', speakerId: 0, counterpartId: 0, text: 'hi' }]
        : [],
    },
    container: { contents: [] },
    ...(opts.proactive ? { proactive: { greetOnEntry: true } } : {}),
  });
  moveInto(w, npc, lounge);

  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] }, knows: { facts: {} },
  });
  moveInto(w, player, cabin);
  return { w, cabin, lounge, npc, player };
}

describe('proactive NPC after-move rule', () => {
  it('emits a noticed event when the player enters a proactive NPC\'s room', () => {
    const { w, npc, player } = makeWorld({ proactive: true });
    const { events } = apply(w, { kind: 'move', dir: 'out' });
    const noticed = events.find(e => e.kind === 'noticed') as Extract<Event, { kind: 'noticed' }>;
    expect(noticed).toBeDefined();
    expect(noticed.observer).toBe(npc);
    expect(noticed.target).toBe(player);
    expect(noticed.trigger).toBe('enteredRoom');
  });

  it('also fires for goto', () => {
    const { w, lounge } = makeWorld({ proactive: true });
    const { events } = apply(w, { kind: 'goto', target: lounge });
    expect(events.some(e => e.kind === 'noticed')).toBe(true);
  });

  it('does NOT fire if the NPC is not proactive', () => {
    const { w } = makeWorld({ proactive: false });
    const { events } = apply(w, { kind: 'move', dir: 'out' });
    expect(events.some(e => e.kind === 'noticed')).toBe(false);
  });

  it('does NOT fire if the NPC already has dialogue memory with the player', () => {
    const { w } = makeWorld({ proactive: true, priorMemory: true });
    const { events } = apply(w, { kind: 'move', dir: 'out' });
    expect(events.some(e => e.kind === 'noticed')).toBe(false);
  });

  it('does NOT fire when the player moves into a room with no proactive NPC', () => {
    // Player moves out of cabin into lounge where Mira lives, then back to cabin.
    const { w } = makeWorld({ proactive: true });
    apply(w, { kind: 'move', dir: 'out' });
    const { events } = apply(w, { kind: 'move', dir: 'in' });
    expect(events.some(e => e.kind === 'noticed')).toBe(false);
  });
});
