import type { Direction, EntityId, NpcResponsePayload } from './components.js';

/**
 * Actions are what the parser emits and what the engine accepts.
 * Add a variant here, then handle it exhaustively in `apply.ts`.
 * The discriminant `kind` is also what the LLM tool-call schema keys on.
 *
 * `converse` is itself a discriminated union by `mode` so invalid combos
 * (e.g. `say` without an utterance) are unrepresentable. The rulebook
 * dispatches by `kind`; converse rules narrow further on `action.mode`.
 *
 * `respondAsNpc` is an internal/synthetic action — only the agent layer
 * emits it, never the parser. It funnels the dialogue agent's structured
 * output through the same rulebook so events, hooks, and audit logs all
 * work uniformly. (See ARCHITECTURE.md → Conversation & NPC agents.)
 */
export type Action =
  | { kind: 'look' }
  | { kind: 'move';    dir: Direction }
  | { kind: 'goto';    target: EntityId }
  | { kind: 'take';    target: EntityId }
  | { kind: 'drop';    target: EntityId }
  | { kind: 'examine'; target: EntityId }
  | { kind: 'give';    target: EntityId; to: EntityId }
  | { kind: 'present'; target: EntityId; to: EntityId }
  | { kind: 'inventory' }
  | { kind: 'wait' }
  | { kind: 'time' }
  /**
   * The arc-climax trigger. Fast-forwards the game clock to
   * `openingSessionAt` and lets the session-open rule do the rest. No
   * target — the action is whole-arc. Carryout is a no-op if the
   * session has already opened; the clock advance is idempotent.
   */
  | { kind: 'attendSession' }
  | ConverseAction
  | { kind: 'respondAsNpc';
      speaker: EntityId;
      audience: EntityId;
      payload: NpcResponsePayload;
      /**
       * The originating exchange mode the agent is replying to (greet/say/
       * ask/tell/approached), or a tagged easter-egg id like
       * `'easter-egg:star-wars'` when the CLI rerouted an Earth-pop-culture
       * reference. Threaded by the CLI from the `addressed` or `noticed`
       * event. Optional for backwards compatibility — engine gates that
       * need it (e.g. silica binary-search) treat absence conservatively
       * (no semantic reveal) and skip easter-egg modes the same way.
       */
      inResponseTo?:
        | 'greet' | 'say' | 'ask' | 'tell' | 'approached'
        | `easter-egg:${string}`;
    };

/**
 * Parser-facing converse action. `topicPhrase` for ask/tell is the raw
 * phrase the player typed — topic-id resolution happens later in the
 * agent layer (the parser must not read NPC `knows.facts`).
 */
export type ConverseAction =
  | { kind: 'converse'; mode: 'greet'; target: EntityId }
  | { kind: 'converse'; mode: 'say';   target: EntityId; utterance: string }
  | { kind: 'converse'; mode: 'ask';   target: EntityId; topicPhrase: string }
  | { kind: 'converse'; mode: 'tell';  target: EntityId; topicPhrase: string };

export type ActionKind = Action['kind'];
