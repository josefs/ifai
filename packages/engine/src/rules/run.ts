import type { Action } from '../actions.js';
import type { Event, Result } from '../events.js';
import type { World } from '../world.js';
import type { Rulebook } from './rulebook.js';
import { PHASES, type RuleCtx, type Verdict } from './types.js';

/**
 * Run a single action through a rulebook and return the events it produced.
 *
 * Driver semantics:
 *   - phases run in fixed order (PHASES);
 *   - within a phase, rules run in registration-sorted (specificity desc) order;
 *   - a rule's `when` is evaluated first; false skips the rule entirely;
 *   - returning 'continue' lets later rules in the phase also fire;
 *   - returning 'stop'   ends the phase and proceeds to the next one;
 *   - returning 'fail'   aborts the entire action immediately.
 *
 * A `fail` is the only way to skip mutation: returning fail from a check
 * rule prevents `carryOut` from running. We intentionally do not run
 * `after` or `report` after a fail — those describe *successful*
 * consequences. Rules in `before` may also fail (e.g. "you can't bring
 * yourself to do that"), with the same effect.
 */
export function runAction(world: World, action: Action, book: Rulebook): Result {
  const events: Event[] = [];
  const ctx: RuleCtx = {
    emit(e: Event) { events.push(e); },
    fail(reason, target) {
      events.push({
        kind: 'failed',
        action: action.kind,
        reason,
        ...(target !== undefined ? { target } : {}),
      });
      return 'fail';
    },
    hasEmitted() { return events.length > 0; },
  };

  for (const phase of PHASES) {
    const rules = book.rulesFor(action.kind, phase);
    for (const rule of rules) {
      if (rule.when && !rule.when(world, action as never, ctx)) continue;
      const v: Verdict = rule.run(world, action as never, ctx);
      if (v === 'fail') return { events };
      if (v === 'stop') break;
    }
  }
  return { events };
}
