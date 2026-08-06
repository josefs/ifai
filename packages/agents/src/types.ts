import type { World, EntityId, KnownFact, DialogueMemoryEntry } from '@ifai/engine';

/**
 * The shape of a single conversational exchange the CLI passes to the
 * dialogue agent. `mode` mirrors the player's `converse` action plus the
 * unprompted `'approached'` mode the engine emits when the player walks
 * into a proactive NPC's room. The agent uses the mode to decide whether
 * the NPC is being greeted, asked about a topic, told something,
 * addressed with free speech, or initiating contact themselves.
 */
export interface Exchange {
  mode: 'greet' | 'say' | 'ask' | 'tell' | 'approached' | 'easter-egg';
  /** Free-form utterance from the player (mode: 'say'). */
  utterance?: string;
  /** Player's raw topic phrase (modes: 'ask' / 'tell'). Verbatim, not resolved. */
  topicPhrase?: string;
  /**
   * When `mode === 'easter-egg'`, the id of the franchise that fired
   * (e.g. `'star-wars'`). The CLI resolves this against the content
   * registry; the agent uses the hint and id to compose a reply.
   */
  easterEggId?: string;
  /**
   * Generic in-universe deflection seed for the easter-egg mode. The
   * fallback agent returns it verbatim wrapped in NPC voice; the LLM
   * agent rewrites it in-character. Lives on Exchange (not in a
   * registry the agent imports) so the agents package stays free of
   * content dependencies.
   */
  easterEggHint?: string;
}

/**
 * Minimal NPC view the agent layer needs. Built by the CLI from the
 * world before invoking the agent so the agent itself never reaches
 * into the ECS.
 */
export interface NpcContext {
  id: EntityId;
  name: string;
  persona: string;
  species: string;
  mood: string;
  trust: number;
  facts: Record<string, KnownFact>;
  recentDialogue: DialogueMemoryEntry[];
  /** Brief room context — already-rendered prose works fine. */
  roomBrief: string;
  /**
   * Optional tag-system fields. The CLI populates these from the world
   * each turn; the agent uses them to assemble a small just-in-time
   * reactivity block. All are optional so a context built without tags
   * (or for an NPC with no `tagReactions`) still works unchanged.
   *
   *   roomTags     — tags on the room the NPC is currently in.
   *   inPlayItems  — tagged items visible to the NPC right now: items
   *                  held by the NPC, items held by the player, and
   *                  loose items in the same room. Listed in stable
   *                  order. Items without tags are omitted.
   *   tagReactions — pass-through of `npc.tagReactions.notes`; the
   *                  agent filters this to tags actually in play.
   */
  roomTags?: string[];
  inPlayItems?: InPlayItem[];
  tagReactions?: Record<string, string>;
  /**
   * Read-only silica binary-search status. Present only on NPCs with a
   * `silicaProtocol` component. The agent uses this to decide whether to
   * emit *semantic* responses or chime-register only. The engine enforces
   * the same rules independently; this field exists so the LLM can
   * produce in-fiction-appropriate prose without leaking reveals that
   * the engine would block anyway.
   */
  silicaProtocol?: { readyToSpeak: boolean };
  /**
   * What the NPC currently perceives — their own room's authored
   * description and the non-NPC entities in that room (with their own
   * descriptions). Populated per turn so an LLM agent can answer
   * conversationally about things the NPC can plainly see ("what
   * drinks does the bar have?", "what's out that window?") without
   * every such thing being pre-authored as a fact.
   *
   * The distinction with `facts` is deliberate:
   *   - `facts` are canonical, plot-bearing content the author decided
   *     the NPC knows. The LLM must not invent new ones or paraphrase
   *     these away.
   *   - `perceived` is ambient texture. The LLM may speak about it
   *     using common sense appropriate to the NPC's persona and
   *     species, without treating it as revealed plot.
   *
   * Fallback agents ignore this field and behave as before.
   */
  perceived?: {
    roomName: string;
    roomDescription: string;
    entities: Array<{ name: string; description?: string; scenery: boolean }>;
  };
}

/** A tagged entity the NPC perceives this turn. */
export interface InPlayItem {
  name: string;
  description?: string;
  tags: string[];
  /** Where the item is — held by the NPC, held by the player, or loose in the room. */
  source: 'npc-held' | 'player-held' | 'room';
}

/**
 * The pure-function interface the engine/CLI calls. Implementations
 * never mutate `world`; the returned payload is wrapped in a
 * `respondAsNpc` action and pushed back through the rulebook.
 */
export interface DialogueAgent {
  respond(world: World, npc: NpcContext, exchange: Exchange): Promise<DialogueResponseLike>;
}

/**
 * Local mirror of the agent's response payload. Identical structure to
 * the engine's `NpcResponsePayload`, but kept as a separate name so
 * implementations can import only from `@ifai/agents`.
 */
export interface DialogueResponseLike {
  speech: string;
  npcMood?: string;
  trustDelta?: number;
  usedFactKeys?: string[];
  revealedTopicsToPlayer?: string[];
  npcLearnedTopics?: Record<string, KnownFact>;
  wantsToEndConversation?: boolean;
}
