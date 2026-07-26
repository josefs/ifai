import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';
import { apply, moveInto } from '@ifai/engine';

/**
 * End-to-end ending resolution. We don't drive the full arc — we just
 * teleport items into the player's hands, jump to the memorial wall,
 * `present` what's needed, then `attendSession` and assert the chosen
 * ending id.
 */
function findByName(w: ReturnType<typeof buildThrenody>, name: string): number {
  for (let i = 0; i < 10_000; i++) {
    if (w.get(i, 'name')?.value === name) return i;
  }
  throw new Error(`not found: ${name}`);
}
function findEndingEntity(w: ReturnType<typeof buildThrenody>): number {
  for (const [eid] of w.entries('endingState')) return eid;
  throw new Error('endingState singleton missing');
}

function setup() {
  const w = buildThrenody();
  const player = w.player();
  const wall = findByName(w, 'memorial wall');
  moveInto(w, player, wall);
  return { w, player, wall };
}

function presentAll(w: ReturnType<typeof buildThrenody>, items: number[], wall: number) {
  const player = w.player();
  for (const it of items) {
    moveInto(w, it, player);
    apply(w, { kind: 'present', target: it, to: wall });
  }
}

describe('Threnody endings', () => {
  it('vorthi-truth: coin + chime-fragment', () => {
    const { w, wall } = setup();
    const coin = findByName(w, "Iren's coin");
    const fragment = findByName(w, 'chime-fragment');
    presentAll(w, [coin, fragment], wall);
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.find(e => e.kind === 'endingResolved')).toMatchObject({ id: 'vorthi-truth' });
    expect(w.get(findEndingEntity(w), 'endingState')!.resolved).toBe('vorthi-truth');
  });

  it('human-truth: chime-fragment + off-record recording', () => {
    const { w, wall } = setup();
    const fragment = findByName(w, 'chime-fragment');
    const recording = findByName(w, 'off-record recording');
    presentAll(w, [fragment, recording], wall);
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.find(e => e.kind === 'endingResolved')).toMatchObject({ id: 'human-truth' });
  });

  it('procedural: badge only', () => {
    const { w, wall } = setup();
    const badge = findByName(w, 'credentials badge');
    presentAll(w, [badge], wall);
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.find(e => e.kind === 'endingResolved')).toMatchObject({ id: 'procedural' });
  });

  it('walkout: nothing presented', () => {
    const { w } = setup();
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.find(e => e.kind === 'endingResolved')).toMatchObject({ id: 'walkout' });
  });

  it('vorthi-truth wins over human-truth when both sets are present', () => {
    const { w, wall } = setup();
    const coin = findByName(w, "Iren's coin");
    const fragment = findByName(w, 'chime-fragment');
    const recording = findByName(w, 'off-record recording');
    presentAll(w, [coin, fragment, recording], wall);
    const out = apply(w, { kind: 'attendSession' });
    expect(out.events.find(e => e.kind === 'endingResolved')).toMatchObject({ id: 'vorthi-truth' });
  });

  it('badge + chime-fragment alone does not unlock procedural (procedural requires badge-only)', () => {
    const { w, wall } = setup();
    const badge = findByName(w, 'credentials badge');
    const fragment = findByName(w, 'chime-fragment');
    presentAll(w, [badge, fragment], wall);
    const out = apply(w, { kind: 'attendSession' });
    // Neither vorthi (needs coin) nor human (needs recording) nor walkout
    // (presented is non-empty); resolved stays undefined.
    const resolved = out.events.find(e => e.kind === 'endingResolved');
    expect(resolved).toBeUndefined();
    expect(w.get(findEndingEntity(w), 'endingState')!.resolved).toBeUndefined();
  });
});
