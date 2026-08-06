/**
 * Components — pure data attached to entities.
 *
 * Adding a component:
 *   1. Add a key + interface to `ComponentMap` below.
 *   2. (Optional) Add a typed accessor or helper in `world.ts`.
 *   3. Use it in systems via `world.get(eid, 'name')` etc.
 *
 * Keep components small and orthogonal — composition over inheritance.
 */

export type EntityId = number;

/**
 * Directions on Waystation Threnody, a ring station with spin gravity.
 *
 *   spinward / antispinward — the two ways around the ring
 *   inward   / outward      — toward the hub / out to the rim
 *   up       / down         — between stacked decks
 *   in       / out          — entering/leaving a contained space (cabin,
 *                             chamber) from a corridor
 *
 * The engine treats directions as opaque strings; semantics live in the
 * parser prompts and content. Adding/removing a direction requires touching
 * `OPPOSITE`, the parser aliases (`parser-fallback.ts`), and the LLM
 * direction schema (`llm/schemas.ts`).
 */
export type Direction =
  | 'spinward' | 'antispinward'
  | 'inward'   | 'outward'
  | 'up'       | 'down'
  | 'in'       | 'out';

export const DIRECTIONS: readonly Direction[] = [
  'spinward', 'antispinward',
  'inward',   'outward',
  'up',       'down',
  'in',       'out',
] as const;

export const OPPOSITE: Record<Direction, Direction> = {
  spinward:     'antispinward',
  antispinward: 'spinward',
  inward:       'outward',
  outward:      'inward',
  up:           'down',
  down:         'up',
  in:           'out',
  out:          'in',
};

export interface ComponentMap {
  /** Display name. Singular noun phrase, lowercase by default. */
  name:        { value: string; aliases?: string[] };
  /** Authored base description. Narrator may extend it from state. */
  description: { text: string };
  /** Tag — this entity is a room. */
  room:        Record<string, never>;
  /** Tag — this entity is the player. */
  player:      Record<string, never>;
  /** Outgoing exits keyed by direction → destination room id. */
  exits:       { to: Partial<Record<Direction, EntityId>> };
  /**
   * What entity holds this one. Convention: `location.holderId` is the
   * canonical truth; `container.contents` mirrors it. Always change
   * containment via `moveInto` in `world.ts` so they stay in sync.
   */
  location:    { holderId: EntityId };
  /** Anything that can hold other entities — rooms, chests, NPCs, the player. */
  container:   { contents: EntityId[] };
  /** Tag — this entity can be picked up. */
  portable:    Record<string, never>;
  /**
   * Tag — this entity is scenery: named-and-examinable, but not portable
   * and not enumerated in room descriptions. Use for windows, bunks,
   * terminals, ceiling panels, ambient crowds — anything the room's
   * fiction mentions that the player might reasonably try to examine
   * ("look at the window") but that shouldn't be listed as a distinct
   * object when the room is described. The narrator MUST NOT enumerate
   * scenery on `look`; the parser SHOULD resolve player references to
   * them the same as any other visible entity.
   */
  scenery:     Record<string, never>;
  /** Openable (and maybe lockable). */
  openable:    { isOpen: boolean; locked: boolean; keyId?: EntityId };
  /** Light source — illuminates its current room when `lit`. */
  lightSource: { lit: boolean };
  /** Whether a room is ambiently lit without any light source. */
  ambientLit:  { lit: boolean };
  /**
   * Non-player character core data.
   *
   * `trust` is a 0-100 scalar tracking how disposed the NPC is toward the
   * player. The dialogue agent reads it (to colour tone) and may emit a
   * `trustDelta` per exchange; the engine clamps any change into range.
   * 50 is a sensible neutral starting value.
   */
  npc:         {
    persona:  string;
    species:  string;
    mood:     string;
    trust:    number;
  };
  /**
   * Facts a character knows. The map is keyed by stable topic ids
   * (e.g. `negotiations`, `vorthi-delegation`). Each entry carries the
   * fact's text plus optional natural-language aliases used by the
   * dialogue agent to resolve a player's `topicPhrase`.
   *
   * Player entities also use this component — when an NPC reveals a
   * topic (`revealedTopicsToPlayer`), the engine copies the matching
   * fact into the player's knows.facts.
   */
  knows:       { facts: Record<string, KnownFact> };
  /**
   * Per-NPC FIFO of recent dialogue exchanges, used by the dialogue
   * agent prompt as short-term memory. Capped (see `pushDialogueMemory`)
   * so prompts stay bounded.
   *
   * Each entry includes both `speakerId` and `counterpartId` so the
   * schema supports multi-party conversations later (currently the
   * counterpart is always the player or the NPC).
   */
  dialogueMemory: { entries: DialogueMemoryEntry[] };
  /** Species-specific tag, useful for affordances and UI. */
  species:     { id: string };
  /**
   * NPC initiative trait — the NPC will speak first when something
   * triggers it. Currently only `greetOnEntry` is wired: when the
   * player enters the NPC's room and the NPC has no prior dialogue
   * memory of the player, the engine emits a `noticed` event which
   * the dialogue agent layer turns into an unprompted opening line.
   *
   * Kept as flags rather than an enum so additional initiative
   * conditions (e.g. greetOnSchedule, interjectOnTopic) can be added
   * without breaking the component shape.
   */
  proactive:   { greetOnEntry: boolean };
  /**
   * Per-topic reveal predicates — the engine-side backstop against the
   * dialogue LLM leaking climactic facts before the player is qualified
   * to hear them.
   *
   * Each gate is a function `(world, audience) => boolean`. The engine
   * consults it inside `respondAsNpc` carry-out: if a gate exists for a
   * topic id in `revealedTopicsToPlayer` and returns false, the topic
   * is silently dropped from the reveal (and recorded on the `npcSpoke`
   * event as `blockedTopics` for debug). Topics without a gate are
   * always revealable; the agent's prompt and trust scalar still do the
   * soft-shaping work.
   *
   * Gates are functions rather than a declarative shape so content can
   * express any condition (held items, trust thresholds, prior reveals,
   * world time). The tradeoff: gate functions aren't JSON-serializable.
   * That's fine for now — world state is in-memory only.
   *
   * `audience` is the entity hearing the reveal (typically the player).
   * The predicate may also consult the NPC's own state via `world`.
   */
  topicGates: { gates: Record<string, TopicGate> };
  /**
   * Singleton clock. Lives on a single dedicated entity created by
   * the content layer. `minutes` is monotonic — it only ever
   * increases. The clamp to "session starts now" is computed on the
   * fly in perception so we never lose track of how late the player
   * is. `openingSessionAt` is the threshold the climax reads when it
   * arrives (step 8); for now it is simply surfaced.
   */
  clock:       { minutes: number; openingSessionAt: number };
  /**
   * Free-form content tags attached to any entity — items, rooms, NPCs.
   * Tags are short opaque symbols (e.g. `vorthi`, `memorial`, `credential`,
   * `evidence`, `mundane`) drawn from a flat content-defined vocabulary.
   * The engine attaches no semantics; tags exist so other systems
   * (dialogue prompt assembly, topic-gate predicates, narrator register,
   * parser disambiguation) can react to entity *kinds* without needing
   * per-entity per-NPC authored content.
   *
   * Convention: tags are lowercase ascii, hyphen-separated, deduplicated.
   * Authoring rule of thumb: every tag should appear on at least one
   * entity AND in at least one NPC's `tagReactions` — otherwise it's
   * not earning its keep.
   */
  tags:        { values: string[] };
  /**
   * NPC-side reaction sheet — short tone notes keyed by tag. The
   * dialogue agent assembles a just-in-time prompt block by collecting
   * tags currently "in play" (tags on the NPC itself, on items held by
   * either party, on items just given/presented this turn, on entities
   * resolved from the player's topicPhrase) and including only the
   * matching notes. When no tag matches, the block is omitted entirely
   * and the NPC falls back on persona — there is no canned text.
   *
   * Notes are short tone/stance guidance ("Subdued, exact. Will not
   * joke."), NOT lines of dialogue — the LLM improvises within them.
   */
  tagReactions: { notes: Record<string, string> };
  /**
   * Silica-protocol dialogue gating — content-defined, engine-enforced.
   *
   * Designed for the crystal envoy Saen-of-Three-Notes (the witness to
   * the climactic event). The component encodes a "binary search"
   * conversation puzzle:
   *
   *   - Until the player has `examine`-d the speaker, `readyToSpeak`
   *     is false and the engine drops all topic reveals from the
   *     speaker — chime patterns only, no semantic content.
   *   - After the flip, the speaker only confirms `tell`-mode claims;
   *     `ask`/`say`/`greet` exchanges reveal nothing.
   *   - Each `tell` may reveal at MOST one previously-unrevealed
   *     `claimTopicIds` topic; multi-topic reveals are truncated.
   *   - `revealedClaims` tracks which eligible claims this NPC has
   *     already confirmed (de-duplicated; single-player today, would
   *     need a per-audience map for multi-player).
   *   - When `revealedClaims.length` reaches `rewardThreshold`, the
   *     engine transfers `chimeFragmentId` (if set) to the audience
   *     and sets `rewarded`, emitting `silicaGifted`. Subsequent
   *     reveals do not re-gift.
   *
   * The gate is intentionally narrow: it does NOT shape Saen's prose
   * register. That stays in the dialogue agent's prompt — push the
   * LLM, don't add suspenders. The engine only protects the climactic
   * facts and the reward mechanic.
   */
  silicaProtocol: {
    readyToSpeak:    boolean;
    claimTopicIds:   string[];
    revealedClaims:  string[];
    rewardThreshold: number;
    chimeFragmentId?: EntityId;
    rewarded:        boolean;
  };
  /**
   * Marker component identifying a room (or other entity) as the
   * memorial-wall climax receptacle. The `present:after` rule looks
   * for this marker to decide whether to record the presented item
   * on the `endingState`. There is intentionally exactly one of these
   * in the canonical arc, but the component is plural-safe — any
   * `present` whose target carries `memorialWall` is recorded.
   *
   * Content sets this on the memorial-wall room (or on an item inside
   * it that proxies for the wall). Engine attaches no other meaning.
   */
  memorialWall: {};
  /**
   * Singleton arc-resolution state. Lives on the same entity as
   * `clock` so the climax driver can read both with one entity lookup.
   *
   *   - `presentedAtWall` is the de-duplicated, ordered list of item
   *     ids the player has presented at the memorial wall so far.
   *     Order is preserved for diagnostics; selection rules read this
   *     as a set.
   *   - `sessionOpened` flips exactly once when the clock reaches
   *     `clock.openingSessionAt` (or when the player invokes the
   *     `attendSession` action). The flip emits a `sessionOpened`
   *     event, after which the content-layer resolution rule reads
   *     the presented set and emits `endingResolved`.
   *   - `resolved` is the chosen ending id, or undefined while the
   *     arc is unresolved. The CLI inspects this to end the prompt
   *     loop; tests assert on it.
   *
   * Putting this on the engine layer (not content) lets engine-side
   * rules — clock tick, present-at-wall — touch it without piercing
   * the rulebook boundary. The actual ending-id catalogue is content.
   */
  endingState: {
    presentedAtWall: EntityId[];
    sessionOpened:   boolean;
    resolved?:       string;
  };
  /**
   * Content-defined catalogue of ending outcomes for the arc. Each entry
   * is `(id, matches)`; on the `sessionOpened` event the engine evaluates
   * `matches` against the current presented set and picks the FIRST one
   * that returns true (priority is by list order — author the list
   * accordingly: richest-truth first, walkout last).
   *
   * Like `topicGates`, predicates are functions and therefore not JSON-
   * serializable. That's fine: world state is in-memory only. The engine
   * provides no fallback ending — if no entry matches, `endingState.resolved`
   * stays undefined and the CLI surfaces "no ending resolved" (a content
   * bug to fix).
   *
   * Lives on the same singleton entity as `endingState`/`clock`.
   */
  endingCatalogue: {
    endings: Array<{
      id: string;
      matches: (presented: EntityId[], world: import('./world.js').World) => boolean;
    }>;
  };
}

/** A single fact an NPC (or the player) knows. */
export interface KnownFact {
  text: string;
  aliases?: string[];
}

/**
 * A reveal predicate. Return `true` to allow a topic to be copied from
 * the speaker's `knows.facts` into the audience's; return `false` to
 * silently block it. The first argument is the world; `audience` is
 * whoever is hearing the reveal (typically the player).
 *
 * Imported by content packs from `@ifai/engine`.
 */
export type TopicGate = (world: import('./world.js').World, audience: EntityId) => boolean;

/** One entry in an NPC's short-term dialogue memory. */
export interface DialogueMemoryEntry {
  kind: 'said' | 'heard';
  speakerId: EntityId;
  counterpartId: EntityId;
  text: string;
}

/**
 * Structured payload an agent supplies via the `respondAsNpc` action.
 *
 * The agent layer constructs this from a Zod-validated LLM response;
 * the engine is the only place that mutates state in response to it,
 * and clamps anything out-of-range (see `respondAsNpc:check`).
 *
 *   speech                 - the NPC's quoted line; rendered by the narrator
 *   npcMood?               - replacement mood string; engine writes verbatim
 *   trustDelta?            - signed adjustment, clamped to ±10 then to [0,100]
 *   usedFactKeys?          - topic ids the agent drew on; for audit only
 *   revealedTopicsToPlayer? - topic ids the player should now `knows`;
 *                            engine copies each fact from the speaker
 *   npcLearnedTopics?      - topic ids and texts the NPC should now know;
 *                            currently used only when the player teaches
 *                            something (deferred — agent rarely emits)
 *   wantsToEndConversation? - signalling only; no behaviour wired in v1
 */
export interface NpcResponsePayload {
  speech: string;
  npcMood?: string;
  trustDelta?: number;
  usedFactKeys?: string[];
  revealedTopicsToPlayer?: string[];
  npcLearnedTopics?: Record<string, KnownFact>;
  wantsToEndConversation?: boolean;
}

export type ComponentKey = keyof ComponentMap;
export type Component<K extends ComponentKey> = ComponentMap[K];
