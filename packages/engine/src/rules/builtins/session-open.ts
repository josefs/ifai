import { getClock } from '../../world.js';
import { defineRule } from '../types.js';
import type { World } from '../../world.js';
import type { Event } from '../../events.js';

/**
 * Singleton-session-opening helper. Looks up the clock + endingState
 * (which canonically live on the same entity), and if the clock has
 * crossed `openingSessionAt` and `sessionOpened` is still false, flips
 * it and emits a `sessionOpened` event. Idempotent — repeated calls
 * after the flip are no-ops, so it's safe to invoke from every
 * action's `after` phase.
 *
 * Returns whether the session was just opened (used in tests).
 */
export function maybeOpenSession(
  world: World,
  ctx: { emit: (e: Event) => void },
): boolean {
  const clock = getClock(world);
  if (!clock) return false;
  if (clock.minutes < clock.openingSessionAt) return false;
  let stateEnt: number | undefined;
  let state: { presentedAtWall: number[]; sessionOpened: boolean; resolved?: string } | undefined;
  for (const [eid, s] of world.entries('endingState')) {
    stateEnt = eid;
    state = s as typeof state;
    break;
  }
  if (stateEnt === undefined || !state) return false;
  if (state.sessionOpened) return false;
  // Resolve ending in the same step — content-defined predicates over
  // the presented set, first match wins. If no entry matches, leave
  // `resolved` undefined (a content bug; the CLI will surface it).
  const catalogue = world.get(stateEnt as any, 'endingCatalogue');
  let resolvedId: string | undefined;
  if (catalogue) {
    for (const entry of catalogue.endings) {
      if (entry.matches(state.presentedAtWall, world)) {
        resolvedId = entry.id;
        break;
      }
    }
  }
  world.add(stateEnt as any, 'endingState', {
    ...state,
    sessionOpened: true,
    ...(resolvedId !== undefined ? { resolved: resolvedId } : {}),
  });
  ctx.emit({ kind: 'sessionOpened', atMinute: clock.minutes });
  if (resolvedId !== undefined) {
    ctx.emit({ kind: 'endingResolved', id: resolvedId });
  }
  return true;
}

/**
 * The `attendSession:open` after-rule. attendSession has zero ordinary
 * tick cost, so the generic `clock:after:*` rules don't run; this
 * action-specific after-rule guarantees the session-open check still
 * happens after the carry-out's explicit clock-jump.
 */
export const attendSessionOpen = defineRule({
  name: 'attendSession:open',
  on: 'attendSession', phase: 'after',
  run: (w, _a, ctx) => {
    maybeOpenSession(w, ctx);
    return 'continue';
  },
});
