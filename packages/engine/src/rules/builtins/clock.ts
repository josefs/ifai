import type { Action, ActionKind } from '../../actions.js';
import { tickClock } from '../../world.js';
import { defineRule } from '../types.js';
import { maybeOpenSession } from './session-open.js';

/**
 * Per-action time cost in minutes.
 *
 * Encoded as a function rather than a plain Record so future tuning (e.g.
 * different costs per converse `mode`) doesn't require a redesign — the
 * engine asks "how many minutes did this cost?" and gets a single answer.
 *
 * Notable choices:
 *  - `look`, `examine`, `inventory` are free. They model the player
 *    looking around, not committing to anything.
 *  - `respondAsNpc` is free: the player's `converse` paid for the
 *    exchange already, and double-counting would distort dialogue cost.
 *  - `noticed` is not in the table because it is an event, not an action.
 *  - Failed actions never reach `after`-phase rules, so the clock
 *    correctly does not advance on e.g. "go north" with no exit.
 *
 * Tune freely — the values are content/balance, not engine semantics.
 */
export function timeCost(action: Action): number {
  switch (action.kind) {
    case 'move':
    case 'goto':
      return 5;
    case 'wait':
      return 10;
    case 'take':
    case 'drop':
    case 'give':
    case 'present':
      return 1;
    case 'converse':
      return 2;
    case 'attendSession':
      // No regular minute cost — the carry-out fast-forwards the clock
      // explicitly to the threshold. A flat tick would double-count.
      return 0;
    case 'respondAsNpc':
    case 'look':
    case 'examine':
    case 'inventory':
    case 'time':
      return 0;
  }
}

/**
 * Action kinds that have a non-zero default time cost. Each gets its own
 * `after`-phase rule that calls `tickClock`. Listing the kinds explicitly
 * keeps the rule registration discoverable in `defaultRulebook()`.
 */
const COSTLY_KINDS: readonly ActionKind[] = [
  'move', 'goto', 'wait', 'take', 'drop', 'give', 'present', 'converse',
] as const;

function makeClockTick(kind: ActionKind) {
  return defineRule({
    name: `clock:after:${kind}`,
    on: kind, phase: 'after',
    run: (w, a, ctx) => {
      tickClock(w, timeCost(a));
      maybeOpenSession(w, ctx);
      return 'continue';
    },
  });
}

export const clockTickRules = COSTLY_KINDS.map(makeClockTick);
