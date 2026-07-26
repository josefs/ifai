import type { Action } from './actions.js';
import type { Event, Result } from './events.js';
import type { World } from './world.js';
import { Rulebook } from './rules/rulebook.js';
import { runAction } from './rules/run.js';
import { defaultRulebook } from './rules/builtins/index.js';

/**
 * The single entry point for stepping the world.
 *
 * `apply` is now a thin wrapper around `runAction`: the actual dispatch is
 * driven by the rulebook (see `packages/engine/src/rules/`). The cached
 * builtin book is reused across calls; pass an explicit `book` to layer
 * content-specific rules on top.
 *
 * Adding a new action no longer requires touching this file. Extend the
 * `Action` union in `actions.ts`, write rules in
 * `rules/builtins/<kind>.ts`, register them in `defaultRulebook()`.
 */
const BUILTIN_BOOK: Rulebook = defaultRulebook();

export function apply(world: World, action: Action, book: Rulebook = BUILTIN_BOOK): Result {
  return runAction(world, action, book);
}

/**
 * Outcome of a single action inside a chain run.
 *  - 'ok'      — the action ran and produced no failed event;
 *  - 'failed'  — the action ran but produced (at least one) failed event;
 *  - 'skipped' — the action was not executed because an earlier action in
 *                the chain failed.
 *
 * `events` is the per-action event list (empty for skipped). The narrator
 * receives this slice plus the post-action perception so each step is
 * rendered against the world state it produced.
 *
 * If an `afterEach` hook is supplied to `applyAll`, any events it returns
 * are appended to `events` for the same step (the hook fires *after* the
 * action's own events are recorded but *before* the next action runs, so
 * later actions see the world state including agent-driven mutations).
 */
export interface ChainOutcome {
  action: Action;
  events: Event[];
  status: 'ok' | 'failed' | 'skipped';
}

export interface ChainResult {
  outcomes: ChainOutcome[];
}

/**
 * Hook called after each successful (non-skipped) action in a chain.
 * Used to slot in the dialogue-agent step between actions: when
 * `outcome.events` contains an `addressed` event, the CLI runs the
 * agent and dispatches a `respondAsNpc` action through the engine. The
 * returned events are appended to the outcome so the narrator renders
 * them as part of the same chain step.
 *
 * The hook may mutate the world via the engine's normal helpers (or by
 * dispatching further actions). Throwing rolls the chain back to the
 * caller — the hook should catch and convert errors into events.
 */
export type ChainAfterEach = (
  world: World,
  outcome: ChainOutcome,
) => Promise<Event[]> | Event[];

export interface ApplyAllOptions {
  book?: Rulebook;
  afterEach?: ChainAfterEach;
}

/**
 * Run a sequence of actions in order against a single shared world.
 *
 * Semantics:
 *  - Actions execute one at a time; the world mutates between them, so a
 *    later action sees the state produced by earlier ones (e.g. a `take`
 *    after a `move`).
 *  - The chain **stops on the first action that produces a failed event**.
 *    All remaining actions are recorded as `skipped` with empty events,
 *    so the UI can tell the player exactly which steps did not run.
 *  - An empty action list returns no outcomes (caller's responsibility).
 *  - When `afterEach` is provided, it runs after each non-skipped action
 *    and may append events (e.g. NPC replies). A failure event produced
 *    by the hook does NOT stop the chain — only failures from the
 *    primary action do — but the hook may dispatch further actions
 *    itself if it wants chain-stopping semantics.
 *
 * This is the multi-action analogue of `apply()`. Single-action callers
 * (tests, internal tooling) should keep using `apply()` directly.
 *
 * Always returns a Promise so callers can `await` the agent hook;
 * synchronous callers can simply `await` and get the same shape.
 */
export async function applyAll(
  world: World,
  actions: readonly Action[],
  opts: ApplyAllOptions = {},
): Promise<ChainResult> {
  const book = opts.book ?? BUILTIN_BOOK;
  const outcomes: ChainOutcome[] = [];
  let stopped = false;
  for (const action of actions) {
    if (stopped) {
      outcomes.push({ action, events: [], status: 'skipped' });
      continue;
    }
    const { events } = runAction(world, action, book);
    const failed = events.some(e => e.kind === 'failed');
    const outcome: ChainOutcome = {
      action,
      events: [...events],
      status: failed ? 'failed' : 'ok',
    };
    if (!failed && opts.afterEach) {
      const extra = await opts.afterEach(world, outcome);
      if (extra.length) outcome.events.push(...extra);
    }
    outcomes.push(outcome);
    if (failed) stopped = true;
  }
  return { outcomes };
}
