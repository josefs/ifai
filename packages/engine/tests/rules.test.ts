import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';
import { Rulebook } from '../src/rules/rulebook.js';
import { runAction } from '../src/rules/run.js';
import { defaultRulebook } from '../src/rules/builtins/index.js';
import { defineRule } from '../src/rules/types.js';

function makeWorld() {
  const w = new World();
  const lounge = w.newEntity({
    room: {}, name: { value: 'lounge' },
    description: { text: 'A lounge.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });
  const datapad = w.newEntity({
    name: { value: 'datapad' }, portable: {},
    description: { text: 'A datapad.' },
  });
  const mira = w.newEntity({
    name: { value: 'Mira' },
    description: { text: 'An ambassador.' },
    npc: { persona: 'crisp', species: 'human', mood: 'neutral' },
    container: { contents: [] },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, datapad, player);
  moveInto(w, mira, lounge);
  moveInto(w, player, lounge);
  return { w, lounge, datapad, mira, player };
}

describe('rules: phase ordering', () => {
  it('runs before-rules ahead of carryOut', () => {
    const { w } = makeWorld();
    const seen: string[] = [];
    const book = defaultRulebook()
      .add(defineRule({
        name: 'before-look', on: 'look', phase: 'before',
        run: (_w, _a, _ctx) => { seen.push('before'); return 'continue'; },
      }))
      .add(defineRule({
        name: 'after-look', on: 'look', phase: 'after',
        run: (_w, _a, _ctx) => { seen.push('after'); return 'continue'; },
      }));
    runAction(w, { kind: 'look' }, book);
    expect(seen).toEqual(['before', 'after']);
  });

  it('a check fail aborts carryOut and after', () => {
    const { w, datapad } = makeWorld();
    let carryOutRan = false;
    const book = defaultRulebook()
      .add(defineRule({
        name: 'block-take', on: 'take', phase: 'check',
        specificity: 100,
        run: (_w, _a, ctx) => ctx.fail('refused', datapad),
      }))
      .add(defineRule({
        name: 'spy-carry', on: 'take', phase: 'carryOut',
        specificity: 100,
        run: (_w, _a, _ctx) => { carryOutRan = true; return 'continue'; },
      }));
    const r = runAction(w, { kind: 'take', target: datapad }, book);
    expect(carryOutRan).toBe(false);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ kind: 'failed', action: 'take', reason: 'refused' });
  });

  it('higher specificity runs first within a phase', () => {
    const { w } = makeWorld();
    const order: string[] = [];
    const book = new Rulebook()
      .add(defineRule({
        name: 'low', on: 'wait', phase: 'before', specificity: 0,
        run: (_w, _a, _ctx) => { order.push('low'); return 'continue'; },
      }))
      .add(defineRule({
        name: 'high', on: 'wait', phase: 'before', specificity: 10,
        run: (_w, _a, _ctx) => { order.push('high'); return 'continue'; },
      }));
    runAction(w, { kind: 'wait' }, book);
    expect(order).toEqual(['high', 'low']);
  });

  it('returning stop ends the current phase but proceeds to the next', () => {
    const { w } = makeWorld();
    const trace: string[] = [];
    const book = new Rulebook()
      .add(defineRule({
        name: 'a', on: 'wait', phase: 'before', specificity: 10,
        run: (_w, _a, _ctx) => { trace.push('a'); return 'stop'; },
      }))
      .add(defineRule({
        name: 'b', on: 'wait', phase: 'before', specificity: 5,
        run: (_w, _a, _ctx) => { trace.push('b'); return 'continue'; },
      }))
      .add(defineRule({
        name: 'c', on: 'wait', phase: 'after',
        run: (_w, _a, _ctx) => { trace.push('c'); return 'continue'; },
      }));
    runAction(w, { kind: 'wait' }, book);
    expect(trace).toEqual(['a', 'c']);
  });
});

describe('give: built-in transitive verb', () => {
  it('moves a held item to an NPC in the same room', () => {
    const { w, datapad, mira, player } = makeWorld();
    const r = apply(w, { kind: 'give', target: datapad, to: mira });
    expect(r.events[0]).toMatchObject({ kind: 'gave', target: datapad, to: mira });
    expect(w.get(datapad, 'location')!.holderId).toBe(mira);
    expect(w.get(player, 'container')!.contents).not.toContain(datapad);
  });

  it('fails if the player is not holding the gift', () => {
    const { w, datapad, mira, lounge } = makeWorld();
    moveInto(w, datapad, lounge); // drop it on the floor
    const r = apply(w, { kind: 'give', target: datapad, to: mira });
    expect(r.events[0]).toMatchObject({ kind: 'failed', action: 'give', reason: 'not_held' });
  });

  it('fails if the recipient is not an actor', () => {
    const { w, datapad, lounge } = makeWorld();
    const rock = w.newEntity({ name: { value: 'rock' } });
    moveInto(w, rock, lounge);
    const r = apply(w, { kind: 'give', target: datapad, to: rock });
    expect(r.events[0]).toMatchObject({ kind: 'failed', action: 'give', reason: 'not_recipient' });
  });

  it('content rules can refuse via higher specificity', () => {
    const { w, datapad, mira } = makeWorld();
    // Demonstrate the compositional pattern: a content-specific check rule
    // overrides the universal one because specificity is higher.
    const book = defaultRulebook().add(defineRule({
      name: 'mira-refuses-gifts',
      on: 'give', phase: 'check', specificity: 100,
      when: (w, a) => w.get(a.to, 'name')?.value === 'Mira',
      run: (_w, a, ctx) => ctx.fail('refused', a.to),
    }));
    const r = apply(w, { kind: 'give', target: datapad, to: mira }, book);
    expect(r.events[0]).toMatchObject({ kind: 'failed', action: 'give', reason: 'refused' });
    // Item should not have moved
    expect(w.get(datapad, 'location')!.holderId).not.toBe(mira);
  });

  it('pushes a memory entry on the recipient so the dialogue agent sees the transfer', () => {
    const { w, datapad, mira, player } = makeWorld();
    apply(w, { kind: 'give', target: datapad, to: mira });
    const mem = w.get(mira, 'dialogueMemory');
    expect(mem).toBeDefined();
    const last = mem!.entries[mem!.entries.length - 1]!;
    expect(last).toMatchObject({
      kind: 'heard',
      speakerId: player,
      counterpartId: mira,
    });
    expect(last.text).toMatch(/datapad/);
    expect(last.text).toMatch(/handed/);
  });

  it('does not push a memory entry when the give fails (item not held)', () => {
    const { w, datapad, mira, lounge } = makeWorld();
    moveInto(w, datapad, lounge);
    apply(w, { kind: 'give', target: datapad, to: mira });
    const mem = w.get(mira, 'dialogueMemory');
    // Either no memory entry was created, or whatever existed is unchanged.
    expect(mem?.entries.some(e => /handed/.test(e.text))).not.toBe(true);
  });
});

describe('present: ceremonial sibling of give', () => {
  it('moves a held item to an NPC and emits a "presented" event', () => {
    const { w, datapad, mira, player } = makeWorld();
    const r = apply(w, { kind: 'present', target: datapad, to: mira });
    expect(r.events[0]).toMatchObject({ kind: 'presented', target: datapad, to: mira });
    expect(w.get(datapad, 'location')!.holderId).toBe(mira);
    expect(w.get(player, 'container')!.contents).not.toContain(datapad);
  });

  it('fails (not_held) if the player is not holding the item', () => {
    const { w, datapad, mira, lounge } = makeWorld();
    moveInto(w, datapad, lounge);
    const r = apply(w, { kind: 'present', target: datapad, to: mira });
    expect(r.events[0]).toMatchObject({
      kind: 'failed', action: 'present', reason: 'not_held',
    });
  });

  it('fails (not_recipient) if the target is not an actor', () => {
    const { w, datapad, lounge } = makeWorld();
    const rock = w.newEntity({ name: { value: 'rock' } });
    moveInto(w, rock, lounge);
    const r = apply(w, { kind: 'present', target: datapad, to: rock });
    expect(r.events[0]).toMatchObject({
      kind: 'failed', action: 'present', reason: 'not_recipient',
    });
  });

  it('pushes a "formally presented" memory entry on the recipient', () => {
    const { w, datapad, mira, player } = makeWorld();
    apply(w, { kind: 'present', target: datapad, to: mira });
    const mem = w.get(mira, 'dialogueMemory');
    const last = mem!.entries[mem!.entries.length - 1]!;
    expect(last).toMatchObject({
      kind: 'heard',
      speakerId: player,
      counterpartId: mira,
    });
    expect(last.text).toMatch(/datapad/);
    expect(last.text).toMatch(/presented/);
  });

  it('content rules can react via higher specificity', () => {
    const { w, datapad, mira } = makeWorld();
    let triggered = false;
    const book = defaultRulebook().add(defineRule({
      name: 'mira-reacts-to-presentation',
      on: 'present', phase: 'after', specificity: 100,
      when: (w, a) => w.get(a.to, 'name')?.value === 'Mira',
      run: () => { triggered = true; return 'continue'; },
    }));
    apply(w, { kind: 'present', target: datapad, to: mira }, book);
    expect(triggered).toBe(true);
  });
});
