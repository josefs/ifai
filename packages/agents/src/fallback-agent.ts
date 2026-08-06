import type { DialogueAgent, DialogueResponseLike, Exchange, NpcContext } from './types.js';
import type { World } from '@ifai/engine';

/**
 * Deterministic dialogue agent for offline / no-key runs and tests.
 *
 * Strategy:
 *  - For greet/say: produce a short, persona-aware acknowledgment.
 *  - For ask/tell: try to match the player's `topicPhrase` against the
 *    NPC's known facts (id + aliases, case-insensitive substring). If a
 *    match is found, surface the fact text as the NPC's line and reveal
 *    the topic to the player. If no match, decline in-character.
 *
 * No state changes beyond the reveal — fallback agents are intentionally
 * boring so they don't make the world drift in unprincipled ways.
 */
export class FallbackDialogueAgent implements DialogueAgent {
  async respond(_w: World, npc: NpcContext, ex: Exchange): Promise<DialogueResponseLike> {
    if (ex.mode === 'greet') {
      return { speech: greetingFor(npc) };
    }
    if (ex.mode === 'approached') {
      return { speech: approachedFor(npc) };
    }
    if (ex.mode === 'easter-egg') {
      return { speech: easterEggFor(npc, ex.easterEggHint ?? '') };
    }
    if (ex.mode === 'say') {
      return { speech: acknowledgeFor(npc, ex.utterance ?? '') };
    }
    // ask / tell
    const phrase = (ex.topicPhrase ?? '').toLowerCase().trim();
    if (!phrase) {
      return { speech: declineFor(npc) };
    }
    const matchKey = findTopicKey(npc.facts, phrase);
    if (!matchKey) {
      return { speech: declineFor(npc) };
    }
    const fact = npc.facts[matchKey]!;
    if (ex.mode === 'ask') {
      return {
        speech: fact.text,
        usedFactKeys: [matchKey],
        revealedTopicsToPlayer: [matchKey],
      };
    }
    // tell: the player is bringing up the topic; NPC acknowledges curtly.
    return {
      speech: tellAckFor(npc, matchKey),
      usedFactKeys: [matchKey],
    };
  }
}

function findTopicKey(
  facts: Record<string, { text: string; aliases?: string[] }>,
  phrase: string,
): string | undefined {
  for (const [key, fact] of Object.entries(facts)) {
    if (key.toLowerCase().includes(phrase) || phrase.includes(key.toLowerCase())) return key;
    for (const a of fact.aliases ?? []) {
      const al = a.toLowerCase();
      if (al === phrase || al.includes(phrase) || phrase.includes(al)) return key;
    }
  }
  return undefined;
}

// The dialogue schema requires `speech` to be the NPC's literal spoken
// line — no name prefix, no surrounding quotes, no embedded quoted
// stage directions. The engine's `npcSpoke` event wraps it as
// `Name: "..."`, and the LLM narrator serialises events via JSON.stringify
// (which escapes any embedded `"`). Both consumers assume speech is
// plain words in the speaker's voice; anything else looks broken.

function greetingFor(npc: NpcContext): string {
  if (npc.trust >= 70) return `Good to see you.`;
  if (npc.trust <= 30) return `Yes?`;
  return `Yes?`;
}

function approachedFor(npc: NpcContext): string {
  // If the author supplied a `briefing` fact on this NPC, deliver it
  // verbatim as the first-encounter line. This is the fallback-agent
  // path for the first-encounter briefing feature — the LLM agent
  // reads the same key and paraphrases it in-character. Any NPC with
  // `proactive: { greetOnEntry: true }` can opt in by adding the fact.
  const briefing = npc.facts['briefing']?.text;
  if (briefing) return briefing;
  return `Ah — you're here. We should talk.`;
}

function acknowledgeFor(npc: NpcContext, _u: string): string {
  void npc;
  return `Noted.`;
}

function declineFor(npc: NpcContext): string {
  void npc;
  return `I'm not the one to ask about that.`;
}

function tellAckFor(npc: NpcContext, _key: string): string {
  void npc;
  return `Noted.`;
}

/**
 * Fallback rendering for an easter-egg deflection. Return the hint as
 * pure speech (the NPC's voice) and let the render layer wrap it. If
 * the hint is missing (CLI didn't resolve), fall back to a generic
 * confused line rather than nothing.
 */
function easterEggFor(npc: NpcContext, hint: string): string {
  void npc;
  if (!hint) return `I don't know what you're talking about.`;
  return hint;
}
