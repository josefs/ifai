import { describe, it, expect } from 'vitest';
import { World, moveInto } from '../src/world.js';
import { apply } from '../src/apply.js';
import type { Event } from '../src/events.js';
import { FallbackNarrator } from '../../narrator/src/narrator-fallback.js';

function makeWorld(opts: { withClock?: boolean; minutes?: number; openingAt?: number } = {}) {
  const w = new World();
  const room = w.newEntity({
    room: {}, name: { value: 'room' },
    description: { text: 'A room.' },
    container: { contents: [] }, ambientLit: { lit: true },
  });
  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
  });
  moveInto(w, player, room);
  if (opts.withClock !== false) {
    w.newEntity({ clock: { minutes: opts.minutes ?? 0, openingSessionAt: opts.openingAt ?? 180 } });
  }
  return { w, room, player };
}

function timeEvent(events: Event[]) {
  return events.find(e => e.kind === 'timeChecked') as Extract<Event, { kind: 'timeChecked' }>;
}

describe('time action — engine', () => {
  it('emits timeChecked with exact perceived game time', () => {
    const { w } = makeWorld({ minutes: 25, openingAt: 180 });
    const { events } = apply(w, { kind: 'time' });
    expect(timeEvent(events)).toEqual({
      kind: 'timeChecked', tracked: true,
      minutes: 25, openingSessionAt: 180,
      minutesUntilSession: 155, sessionStarted: false,
    });
  });

  it('is free — the clock does not advance on time', () => {
    const { w } = makeWorld({ minutes: 7 });
    apply(w, { kind: 'time' });
    const { events } = apply(w, { kind: 'time' });
    expect(timeEvent(events).minutes).toBe(7);
  });

  it('clamps minutesUntilSession to 0 after the deadline; sessionStarted flips', () => {
    const { w } = makeWorld({ minutes: 200, openingAt: 180 });
    const ev = timeEvent(apply(w, { kind: 'time' }).events);
    expect(ev).toMatchObject({
      tracked: true, minutes: 200, openingSessionAt: 180,
      minutesUntilSession: 0, sessionStarted: true,
    });
  });

  it('emits tracked: false when no clock is present', () => {
    const { w } = makeWorld({ withClock: false });
    const ev = timeEvent(apply(w, { kind: 'time' }).events);
    expect(ev).toEqual({ kind: 'timeChecked', tracked: false });
  });
});

describe('time action — fallback narrator phrasing', () => {
  const narr = new FallbackNarrator();
  async function render(opts: Parameters<typeof makeWorld>[0]) {
    const { w } = makeWorld(opts);
    const { events } = apply(w, { kind: 'time' });
    // Filter to just timeChecked so the room re-render isn't included
    // (the time action doesn't emit `looked`, but be defensive).
    const tc = events.filter(e => e.kind === 'timeChecked');
    return narr.narrate(tc, w, { /* unused for timeChecked */ } as never);
  }

  it('renders minutes-only when under an hour', async () => {
    expect(await render({ minutes: 155, openingAt: 180 }))
      .toBe('25 minutes until the opening session.');
  });

  it('renders the singular minute', async () => {
    expect(await render({ minutes: 179, openingAt: 180 }))
      .toBe('1 minute until the opening session.');
  });

  it('renders exact hours when the remainder is zero', async () => {
    expect(await render({ minutes: 60, openingAt: 180 }))
      .toBe('2 hours until the opening session.');
  });

  it('renders hours + minutes when mixed', async () => {
    expect(await render({ minutes: 25, openingAt: 180 }))
      .toBe('2 hours 35 minutes until the opening session.');
  });

  it('renders past-deadline overshoot', async () => {
    expect(await render({ minutes: 195, openingAt: 180 }))
      .toBe('The opening session began 15 minutes ago.');
  });

  it('renders the just-begun edge case', async () => {
    expect(await render({ minutes: 180, openingAt: 180 }))
      .toBe('The opening session has just begun.');
  });

  it('says so when time is not being tracked', async () => {
    expect(await render({ withClock: false }))
      .toBe("Time isn't being tracked here.");
  });
});
