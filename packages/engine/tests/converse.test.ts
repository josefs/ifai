import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply, applyAll } from '../src/apply.js';
import type { Event } from '../src/events.js';

function makeWorld() {
  const w = new World();
  const lounge = w.newEntity({
    room: {}, name: { value: 'lounge' },
    description: { text: 'A lounge.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const elsewhere = w.newEntity({
    room: {}, name: { value: 'elsewhere' },
    description: { text: 'Elsewhere.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const npc = w.newEntity({
    name: { value: 'mira', aliases: [] },
    description: { text: 'Mira.' },
    npc: { persona: 'p', species: 'human', mood: 'guarded', trust: 50 },
    species: { id: 'human' },
    knows: { facts: { 'topic-a': { text: 'A is true.', aliases: ['the thing'] } } },
    dialogueMemory: { entries: [] },
  });
  moveInto(w, npc, lounge);
  const rock = w.newEntity({
    name: { value: 'rock' }, description: { text: 'A rock.' },
  });
  moveInto(w, rock, lounge);
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] }, knows: { facts: {} },
  });
  moveInto(w, player, lounge);
  return { w, lounge, elsewhere, npc, rock, player };
}

describe('converse rules', () => {
  it('emits an addressed event with mode + topicPhrase', () => {
    const { w, npc, player } = makeWorld();
    const { events } = apply(w, {
      kind: 'converse', mode: 'ask', target: npc, topicPhrase: 'topic-a',
    });
    const addr = events.find(e => e.kind === 'addressed') as Extract<Event, { kind: 'addressed' }>;
    expect(addr).toBeDefined();
    expect(addr.mode).toBe('ask');
    expect(addr.topicPhrase).toBe('topic-a');
    expect(addr.speaker).toBe(player);
    expect(addr.target).toBe(npc);
  });

  it('fails not_listening when target lacks npc component', () => {
    const { w, rock } = makeWorld();
    const { events } = apply(w, {
      kind: 'converse', mode: 'greet', target: rock,
    });
    const failed = events.find(e => e.kind === 'failed') as Extract<Event, { kind: 'failed' }>;
    expect(failed?.reason).toBe('not_listening');
  });

  it('fails not_here when target is in another room', () => {
    const { w, npc, elsewhere } = makeWorld();
    moveInto(w, npc, elsewhere);
    const { events } = apply(w, { kind: 'converse', mode: 'greet', target: npc });
    const failed = events.find(e => e.kind === 'failed') as Extract<Event, { kind: 'failed' }>;
    expect(failed?.reason).toBe('not_here');
  });
});

describe('respondAsNpc rules', () => {
  it('updates mood, clamps trustDelta to ±10, copies revealed facts', () => {
    const { w, npc, player } = makeWorld();
    const { events } = apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: {
        speech: 'Indeed.',
        npcMood: 'amused',
        trustDelta: 999,
        revealedTopicsToPlayer: ['topic-a'],
      },
    });
    const spoke = events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke).toBeDefined();
    expect(spoke.speech).toBe('Indeed.');
    expect(spoke.moodAfter).toBe('amused');
    expect(spoke.trustAfter).toBe(60);
    expect(w.get(npc, 'npc')!.mood).toBe('amused');
    expect(w.get(npc, 'npc')!.trust).toBe(60);
    expect(w.get(player, 'knows')!.facts['topic-a']?.text).toBe('A is true.');
  });

  it('drops revealed topics the speaker does not actually know', () => {
    const { w, npc, player } = makeWorld();
    apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: { speech: 'Yes.', revealedTopicsToPlayer: ['hallucinated'] },
    });
    expect(w.get(player, 'knows')!.facts['hallucinated']).toBeUndefined();
  });

  it('pushes a dialogue memory entry for the speaker', () => {
    const { w, npc, player } = makeWorld();
    apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: { speech: 'Hello there.' },
    });
    const mem = w.get(npc, 'dialogueMemory')!.entries;
    expect(mem.length).toBe(1);
    expect(mem[0]!.kind).toBe('said');
    expect(mem[0]!.text).toBe('Hello there.');
  });

  it('topicGates block reveals when the predicate returns false', () => {
    const { w, npc, player } = makeWorld();
    let allow = false;
    w.add(npc, 'topicGates', { gates: { 'topic-a': () => allow } });
    const r = apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: { speech: 'Withheld.', revealedTopicsToPlayer: ['topic-a'] },
    });
    expect(w.get(player, 'knows')?.facts['topic-a']).toBeUndefined();
    const spoke = r.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke.revealedTopicsToPlayer).toBeUndefined();
    expect(spoke.blockedTopics).toEqual(['topic-a']);
  });

  it('topicGates allow reveals when the predicate returns true', () => {
    const { w, npc, player } = makeWorld();
    w.add(npc, 'topicGates', { gates: { 'topic-a': () => true } });
    const r = apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: { speech: 'Here it is.', revealedTopicsToPlayer: ['topic-a'] },
    });
    expect(w.get(player, 'knows')!.facts['topic-a']?.text).toBe('A is true.');
    const spoke = r.events.find(e => e.kind === 'npcSpoke') as Extract<Event, { kind: 'npcSpoke' }>;
    expect(spoke.revealedTopicsToPlayer).toEqual(['topic-a']);
    expect(spoke.blockedTopics).toBeUndefined();
  });

  it('gates only filter topics that have a gate; ungated topics pass through', () => {
    const { w, npc, player } = makeWorld();
    // Add a second known fact alongside topic-a.
    w.get(npc, 'knows')!.facts['topic-b'] = { text: 'B is true.' };
    w.add(npc, 'topicGates', { gates: { 'topic-a': () => false } });
    apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: {
        speech: 'Mixed bag.',
        revealedTopicsToPlayer: ['topic-a', 'topic-b'],
      },
    });
    expect(w.get(player, 'knows')!.facts['topic-a']).toBeUndefined();
    expect(w.get(player, 'knows')!.facts['topic-b']?.text).toBe('B is true.');
  });

  it('gate predicate receives world + audience and can read state', () => {
    const { w, npc, player } = makeWorld();
    const seen: Array<{ audience: number }> = [];
    let unlocked = false;
    w.add(npc, 'topicGates', {
      gates: {
        'topic-a': (world, audience) => {
          // Verify the predicate is invoked with the right arguments
          // and can read world state (existence of an entity here).
          seen.push({ audience });
          expect(world.get(audience, 'player')).toBeDefined();
          return unlocked;
        },
      },
    });
    apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: { speech: '…', revealedTopicsToPlayer: ['topic-a'] },
    });
    expect(seen).toEqual([{ audience: player }]);
    expect(w.get(player, 'knows')?.facts['topic-a']).toBeUndefined();
    // Flip the flag and try again.
    unlocked = true;
    apply(w, {
      kind: 'respondAsNpc', speaker: npc, audience: player,
      payload: { speech: '…', revealedTopicsToPlayer: ['topic-a'] },
    });
    expect(w.get(player, 'knows')?.facts['topic-a']?.text).toBe('A is true.');
  });
});

describe('applyAll afterEach hook', () => {
  it('runs after each non-skipped action and appends events', async () => {
    const { w, npc } = makeWorld();
    const { outcomes } = await applyAll(
      w,
      [{ kind: 'converse', mode: 'greet', target: npc }],
      {
        afterEach: (_w, outcome) => {
          if (outcome.events.some(e => e.kind === 'addressed')) {
            return [{ kind: 'waited' } as Event];
          }
          return [];
        },
      },
    );
    expect(outcomes[0]!.events.some(e => e.kind === 'waited')).toBe(true);
  });
});
