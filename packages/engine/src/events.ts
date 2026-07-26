import type { Direction, EntityId } from './components.js';

/**
 * Events are the engine's *output* — a structured description of what
 * changed in the last tick. The narrator consumes events and produces prose.
 *
 * Failure events carry a machine-readable reason; the narrator decides how
 * to phrase them in-fiction.
 *
 * Conversation events:
 *   - `addressed` is emitted by the engine's `converse` carryOut after
 *     the access checks pass. It carries the player's intent so the
 *     downstream agent layer (or a content-author rule) can produce a
 *     reply.
 *   - `npcSpoke` is emitted by `respondAsNpc` carryOut, *after* the
 *     engine has applied the agent's payload (mood/trust/memory/knows
 *     updates). Narrators render the `speech` verbatim in quotes.
 */
export type Event =
  | { kind: 'looked';     room: EntityId }
  | { kind: 'moved';      from: EntityId; to: EntityId; dir: Direction }
  | { kind: 'took';       target: EntityId }
  | { kind: 'dropped';    target: EntityId; into: EntityId }
  | { kind: 'examined';   target: EntityId }
  | { kind: 'gave';       target: EntityId; to: EntityId }
  | { kind: 'presented';  target: EntityId; to: EntityId }
  | { kind: 'inventoryListed'; items: EntityId[] }
  | { kind: 'waited' }
  | { kind: 'timeChecked';
      /**
       * False when the world has no clock entity (test worlds, alt
       * content). The renderer says "Time isn't being tracked here."
       * Otherwise the fields are the perceived game time.
       */
      tracked: boolean;
      minutes?: number;
      openingSessionAt?: number;
      minutesUntilSession?: number;
      sessionStarted?: boolean;
    }
  | { kind: 'addressed';
      speaker: EntityId;
      target: EntityId;
      mode: 'greet' | 'say' | 'ask' | 'tell';
      utterance?: string;
      topicPhrase?: string;
    }
  | { kind: 'noticed';
      /** The NPC who noticed something. */
      observer: EntityId;
      /** Who or what they noticed (currently always the player). */
      target:   EntityId;
      /** What triggered the notice. Single-value union for now; extend later. */
      trigger:  'enteredRoom';
    }
  | { kind: 'npcSpoke';
      speaker: EntityId;
      audience: EntityId;
      speech: string;
      moodAfter?: string;
      trustAfter?: number;
      revealedTopicsToPlayer?: string[];
      /**
       * Topic ids the agent asked to reveal that were blocked by a
       * content-author `topicGates` predicate. Surfaced for debug/audit;
       * narrators MUST ignore this field (the player never hears a
       * blocked topic, by design).
       */
      blockedTopics?: string[];
    }
  | { kind: 'failed';     action: string; reason: FailureReason; target?: EntityId }
  | { kind: 'silicaReady';
      /**
       * Emitted by the engine when a player examines a silica-protocol NPC
       * for the first time, flipping `readyToSpeak`. The narrator may
       * render a brief sensory beat ("the notch-lights brighten").
       */
      target: EntityId;
    }
  | { kind: 'silicaGifted';
      /**
       * Emitted by the engine when a silica-protocol NPC's reveal count
       * reaches the reward threshold. The named item has already been
       * transferred to the recipient.
       */
      donor:     EntityId;
      recipient: EntityId;
      item:      EntityId;
    }
  | { kind: 'presentedAtMemorial';
      /**
       * Emitted by the engine when the player successfully presents an
       * item at a memorial-wall entity. The item id has just been
       * appended (de-duplicated) to `endingState.presentedAtWall`.
       * Narrators render this as a reverent beat; the climax driver
       * reads it for free as the session-open trigger has its own event.
       */
      item: EntityId;
      wall: EntityId;
    }
  | { kind: 'sessionOpened';
      /**
       * Fired exactly once when the opening session begins — either the
       * clock reached `openingSessionAt`, or the player invoked
       * `attendSession`. After this, ordinary play is locked; the
       * content-layer resolution rule consumes this event and emits
       * `endingResolved`.
       */
      atMinute: number;
    }
  | { kind: 'endingResolved';
      /**
       * Terminal event. `id` is the content-defined ending key (e.g.
       * 'vorthi-truth', 'human-truth', 'procedural', 'walkout'). The
       * CLI prompt loop ends after this event renders. Narrators may
       * render a closing paragraph; the fallback narrator emits a
       * stable one-liner per id.
       */
      id: string;
    };

export type FailureReason =
  | 'no_exit'
  | 'not_here'
  | 'not_portable'
  | 'already_held'
  | 'not_held'
  | 'not_recipient'
  | 'not_listening'
  | 'refused'
  | 'unknown_target'
  | 'dark'
  | 'unknown_action';

export type Result = { events: Event[] };
