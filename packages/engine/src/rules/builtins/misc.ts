import { defineRule } from '../types.js';
import { getClock } from '../../world.js';

export const inventoryCarryOut = defineRule({
  name: 'inventory:carry-out',
  on: 'inventory', phase: 'carryOut',
  run: (w, _a, ctx) => {
    const items = w.get(w.player(), 'container')?.contents ?? [];
    ctx.emit({ kind: 'inventoryListed', items: [...items] });
    return 'continue';
  },
});

export const waitCarryOut = defineRule({
  name: 'wait:carry-out',
  on: 'wait', phase: 'carryOut',
  run: (_w, _a, ctx) => {
    ctx.emit({ kind: 'waited' });
    return 'continue';
  },
});

/**
 * `time` is the player's explicit "check the clock" command — analogous
 * to `inventory`. Free (cost 0), always succeeds, deterministic output.
 * If the world has no clock entity, emits `tracked: false` so the
 * narrator can say so cleanly.
 */
export const timeCarryOut = defineRule({
  name: 'time:carry-out',
  on: 'time', phase: 'carryOut',
  run: (w, _a, ctx) => {
    const clock = getClock(w);
    if (!clock) {
      ctx.emit({ kind: 'timeChecked', tracked: false });
      return 'continue';
    }
    const minutesUntilSession = Math.max(0, clock.openingSessionAt - clock.minutes);
    ctx.emit({
      kind: 'timeChecked',
      tracked: true,
      minutes: clock.minutes,
      openingSessionAt: clock.openingSessionAt,
      minutesUntilSession,
      sessionStarted: clock.minutes >= clock.openingSessionAt,
    });
    return 'continue';
  },
});

/**
 * `attendSession`: the player commits to the opening session. The clock
 * is fast-forwarded to `openingSessionAt` so the session-open after-rule
 * can fire on the same turn. If the clock is already past the threshold
 * this is a no-op on `minutes`; the session-open rule will fire either
 * way. Always emits a `waited` beat so the narrator has something to
 * render before the climax narration kicks in.
 *
 * Failure path: no clock entity. The arc requires one — but a defensive
 * `not_here` failure lets generic test worlds avoid surprise mutations.
 */
export const attendSessionCheck = defineRule({
  name: 'attendSession:check',
  on: 'attendSession', phase: 'check',
  run: (w, _a, ctx) => {
    if (!getClock(w)) return ctx.fail('not_here');
    return 'continue';
  },
});

export const attendSessionCarryOut = defineRule({
  name: 'attendSession:carry-out',
  on: 'attendSession', phase: 'carryOut',
  run: (w, _a, ctx) => {
    const clock = getClock(w)!;
    if (clock.minutes < clock.openingSessionAt) {
      clock.minutes = clock.openingSessionAt;
    }
    ctx.emit({ kind: 'waited' });
    return 'continue';
  },
});
