import type { Action, ActionKind } from '../actions.js';
import type { EntityId } from '../components.js';
import type { Event, FailureReason } from '../events.js';
import type { World } from '../world.js';

/**
 * Rulebooks — the engine's compositional alternative to a giant switch.
 *
 * Inspired by Inform 7. An action is processed by running a fixed
 * sequence of *phases*; each phase has a list of rules; the first matching
 * rule whose `when` predicate is true gets a chance to run, in
 * specificity order.
 *
 * Phases (run in this order):
 *
 *   before    — atmospheric reactions before the action ("you hesitate").
 *               Rules return 'continue' to let later rules also fire.
 *   check     — preconditions. A rule that returns 'fail' aborts the
 *               entire action; the engine emits the failure event the
 *               rule supplied via `ctx.fail(reason)`.
 *   carryOut  — the actual world mutation and primary success event.
 *   after     — consequences and triggered side effects ("the alarm sounds").
 *   report    — last-resort prose / status events if nothing has been
 *               emitted yet. Rare in our codebase since the narrator
 *               already prose-renders carryOut events.
 *
 * Within a phase, rules run in **descending specificity** order. Equal
 * specificity preserves registration order (stable sort). A rule may
 * return 'stop' to end its phase early (the next phase still runs); 'fail'
 * to abort the whole action; or 'continue' to let later rules in the same
 * phase also fire.
 */
export type Phase = 'before' | 'check' | 'carryOut' | 'after' | 'report';

export const PHASES: readonly Phase[] = [
  'before', 'check', 'carryOut', 'after', 'report',
] as const;

export type Verdict = 'continue' | 'stop' | 'fail';

/**
 * The mutable execution context handed to each rule. The driver (run.ts)
 * builds one per action invocation and threads it through every rule.
 *
 * Rules emit events through `ctx.emit` rather than returning them, so a
 * single rule can produce multiple events and we don't need a fancier
 * return type.
 */
export interface RuleCtx {
  /** Append an event to the result. */
  emit(event: Event): void;
  /**
   * Convenience for check-phase rules: emit a failed event and tell the
   * driver to abort the action. Returns 'fail' so the rule can simply
   * `return ctx.fail('not_here')`.
   */
  fail(reason: FailureReason, target?: EntityId): Verdict;
  /** True if any rule has emitted any event in this action so far. */
  hasEmitted(): boolean;
}

/**
 * A rule is keyed on an action kind `K` (so `action` is narrowed to that
 * variant inside `when`/`run`). Rules are registered with a `Rulebook`,
 * which dispatches them by kind + phase.
 *
 * `specificity` defaults to 0. Use higher numbers for rules that match
 * narrower patterns — typically: +1 per component constraint, +10 for an
 * entity-specific rule. Authors may use any positive integers; the only
 * thing that matters is the relative order within a (kind, phase) bucket.
 */
export interface Rule<K extends ActionKind = ActionKind> {
  /** Optional name for debugging / logging. */
  name?: string;
  on: K;
  phase: Phase;
  specificity?: number;
  when?(world: World, action: Extract<Action, { kind: K }>, ctx: RuleCtx): boolean;
  run(world: World, action: Extract<Action, { kind: K }>, ctx: RuleCtx): Verdict;
}

/**
 * Tiny helper that preserves the action-kind generic so `action.dir`,
 * `action.target` etc. type-check inside rule bodies. Equivalent to
 * `as Rule<'move'>` but nicer to read.
 */
export function defineRule<K extends ActionKind>(rule: Rule<K>): Rule<K> {
  return rule;
}
