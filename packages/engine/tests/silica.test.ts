import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';
import type { Event } from '../src/events.js';

/**
 * Engine-level tests for the silica binary-search mechanic
 * (component shape, examine→ready flip, tell-only reveal gating,
 * one-per-turn cap, reward threshold, no-double-gift).
 */

function makeWorld() {
  const w = new World();
  const lounge = w.newEntity({
    room: {}, name: { value: 'lounge' },
    description: { text: '' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const fragment = w.newEntity({
    name: { value: 'fragment' },
    description: { text: '' },
    portable: {},
  });
  const facts = {
    a: { text: 'A.', aliases: [] },
    b: { text: 'B.', aliases: [] },
    c: { text: 'C.', aliases: [] },
    d: { text: 'D.', aliases: [] },
  };
  const npc = w.newEntity({
    name: { value: 'saen', aliases: [] },
    description: { text: '' },
    npc: { persona: 'p', species: 'silica', mood: 'attendant', trust: 50 },
    species: { id: 'silica' },
    knows: { facts },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    silicaProtocol: {
      readyToSpeak: false,
      claimTopicIds: ['a', 'b', 'c', 'd'],
      revealedClaims: [],
      rewardThreshold: 3,
      chimeFragmentId: fragment,
      rewarded: false,
    },
  });
  moveInto(w, npc, lounge);
  moveInto(w, fragment, npc);
  // Gate every claim on readyToSpeak — defence in depth.
  const ready = () => w.get(npc, 'silicaProtocol')?.readyToSpeak ?? false;
  w.add(npc, 'topicGates', {
    gates: { a: ready, b: ready, c: ready, d: ready },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] }, knows: { facts: {} },
  });
  moveInto(w, player, lounge);
  return { w, npc, fragment, player };
}

function speak(w: ReturnType<typeof makeWorld>['w'], speaker: number, audience: number, topics: string[], mode: 'tell' | 'ask' | 'say' | 'greet' | 'approached' | undefined) {
  return apply(w, {
    kind: 'respondAsNpc', speaker, audience,
    payload: { speech: 's', revealedTopicsToPlayer: topics },
    ...(mode ? { inResponseTo: mode } : {}),
  });
}

describe('silica protocol', () => {
  it('examine flips readyToSpeak and emits silicaReady', () => {
    const { w, npc } = makeWorld();
    const out = apply(w, { kind: 'examine', target: npc });
    expect(w.get(npc, 'silicaProtocol')?.readyToSpeak).toBe(true);
    expect(out.events.some(e => e.kind === 'silicaReady' && e.target === npc)).toBe(true);
  });

  it('subsequent examines do not re-emit silicaReady', () => {
    const { w, npc } = makeWorld();
    apply(w, { kind: 'examine', target: npc });
    const out = apply(w, { kind: 'examine', target: npc });
    expect(out.events.some(e => e.kind === 'silicaReady')).toBe(false);
  });

  it('drops all reveals before being examined, regardless of mode', () => {
    const { w, npc, player } = makeWorld();
    const out = speak(w, npc, player, ['a', 'b'], 'tell');
    const spoke = out.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke.revealedTopicsToPlayer ?? []).toEqual([]);
    expect(spoke.blockedTopics).toContain('a');
  });

  it('after examine, ask/greet/say reveal nothing', () => {
    const { w, npc, player } = makeWorld();
    apply(w, { kind: 'examine', target: npc });
    for (const m of ['ask', 'say', 'greet', 'approached'] as const) {
      const out = speak(w, npc, player, ['a'], m);
      const spoke = out.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
      expect(spoke.revealedTopicsToPlayer ?? [], `mode=${m}`).toEqual([]);
    }
  });

  it('after examine, tell mode reveals exactly one claim per turn', () => {
    const { w, npc, player } = makeWorld();
    apply(w, { kind: 'examine', target: npc });
    const out = speak(w, npc, player, ['a', 'b', 'c'], 'tell');
    const spoke = out.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke.revealedTopicsToPlayer).toEqual(['a']);
    expect(w.get(player, 'knows')?.facts['a']).toBeDefined();
    expect(w.get(player, 'knows')?.facts['b']).toBeUndefined();
  });

  it('tracks distinct revealed claims and gifts the chime-fragment at threshold', () => {
    const { w, npc, player, fragment } = makeWorld();
    apply(w, { kind: 'examine', target: npc });
    speak(w, npc, player, ['a'], 'tell');
    speak(w, npc, player, ['b'], 'tell');
    // Re-revealing 'a' is a no-op and must not double-count.
    speak(w, npc, player, ['a'], 'tell');
    expect(w.get(fragment, 'location')?.holderId).toBe(npc);
    expect(w.get(npc, 'silicaProtocol')?.rewarded).toBe(false);
    const out = speak(w, npc, player, ['c'], 'tell');
    expect(out.events.some(e => e.kind === 'silicaGifted')).toBe(true);
    expect(w.get(fragment, 'location')?.holderId).toBe(player);
    expect(w.get(npc, 'silicaProtocol')?.rewarded).toBe(true);
  });

  it('does not gift twice once rewarded', () => {
    const { w, npc, player } = makeWorld();
    apply(w, { kind: 'examine', target: npc });
    speak(w, npc, player, ['a'], 'tell');
    speak(w, npc, player, ['b'], 'tell');
    speak(w, npc, player, ['c'], 'tell');
    const out = speak(w, npc, player, ['d'], 'tell');
    expect(out.events.some(e => e.kind === 'silicaGifted')).toBe(false);
  });

  it('missing inResponseTo is treated conservatively (no reveal)', () => {
    const { w, npc, player } = makeWorld();
    apply(w, { kind: 'examine', target: npc });
    const out = speak(w, npc, player, ['a'], undefined);
    const spoke = out.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke.revealedTopicsToPlayer ?? []).toEqual([]);
  });

  it('non-claim topics are not revealed even in tell mode', () => {
    const { w, npc, player } = makeWorld();
    // Add an extra ungated fact not in claimTopicIds.
    const knows = w.get(npc, 'knows')!;
    w.add(npc, 'knows', { facts: { ...knows.facts, 'extra': { text: 'X.', aliases: [] } } });
    apply(w, { kind: 'examine', target: npc });
    const out = speak(w, npc, player, ['extra'], 'tell');
    const spoke = out.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke.revealedTopicsToPlayer ?? []).toEqual([]);
  });
});
