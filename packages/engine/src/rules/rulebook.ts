import type { ActionKind } from '../actions.js';
import type { Phase, Rule } from './types.js';

/**
 * Registry of rules keyed by (action kind, phase). Rules are stored in
 * specificity-descending order; equal specificity preserves registration
 * order thanks to V8's stable sort.
 *
 * A game pipeline typically:
 *   1. starts from `defaultRulebook()` (engine builtins)
 *   2. layers content-specific rules on top via `.add(...)`
 *   3. passes the result to `apply(world, action, book)` (or to
 *      `runAction(world, action, book)` directly).
 *
 * Rulebooks are instances, not globals: a test or a what-if simulation
 * can construct its own without polluting the builtin set.
 */
export class Rulebook {
  private rules = new Map<ActionKind, Map<Phase, Rule[]>>();

  /** Register a rule. Returns `this` for chaining. */
  add<K extends ActionKind>(rule: Rule<K>): this {
    let byPhase = this.rules.get(rule.on);
    if (!byPhase) {
      byPhase = new Map();
      this.rules.set(rule.on, byPhase);
    }
    let list = byPhase.get(rule.phase);
    if (!list) {
      list = [];
      byPhase.set(rule.phase, list);
    }
    list.push(rule as unknown as Rule);
    list.sort((a, b) => (b.specificity ?? 0) - (a.specificity ?? 0));
    return this;
  }

  /** All rules registered for a given (kind, phase), in run order. */
  rulesFor(kind: ActionKind, phase: Phase): readonly Rule[] {
    return this.rules.get(kind)?.get(phase) ?? [];
  }
}
