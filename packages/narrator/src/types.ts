import type { Action, Event, Perception, World } from '@ifai/engine';

/**
 * A Parser turns the player's natural-language input into a structured Action,
 * grounded in the current Perception so it can resolve entity references.
 *
 * Implementations:
 *  - `FallbackParser` (this package): deterministic verb-noun matcher that
 *    runs without any LLM. Used by tests and as a graceful degradation.
 *  - `LLMParser` (later): structured-output call to an LLM, schema-validated
 *    against `actions.ts`.
 *
 * Both implementations must produce only Actions whose entity ids appear in
 * the supplied Perception. The engine treats an unknown id as a parse error.
 */
export interface Parser {
  parse(input: string, perception: Perception): Promise<ParseResult>;
}

export type ParseResult =
  | { ok: true;  actions: Action[] }
  | { ok: false; reason: string; suggestion?: string };

/**
 * A Narrator turns engine events into prose. It receives the world and the
 * post-tick perception so it can describe state, but should *not* mutate
 * the world. The fallback narrator is a string-template renderer; the LLM
 * narrator will accept the same arguments.
 */
export interface Narrator {
  narrate(events: Event[], world: World, perception: Perception): Promise<string>;
}
