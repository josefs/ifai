import { generateObject } from 'ai';
import { npcModel, logPrompt, logResponse } from '@ifai/narrator';
import type { World } from '@ifai/engine';
import { DialogueResponseSchema, type DialogueResponse } from './schema.js';
import { DIALOGUE_SYSTEM } from './prompts.js';
import { FallbackDialogueAgent } from './fallback-agent.js';
import type { DialogueAgent, Exchange, NpcContext, DialogueResponseLike, InPlayItem } from './types.js';

/**
 * LLM-backed dialogue agent.
 *
 *  - Calls the configured `npc` role model via `generateObject` with the
 *    `DialogueResponseSchema`.
 *  - On any error (no provider configured, network failure, schema parse
 *    error), falls back to `FallbackDialogueAgent` so the game never
 *    stalls on a missing model.
 *  - Never mutates the world. The returned object is destined for the
 *    engine's `respondAsNpc` action wrapper.
 */
export class LLMDialogueAgent implements DialogueAgent {
  private fallback = new FallbackDialogueAgent();

  async respond(w: World, npc: NpcContext, ex: Exchange): Promise<DialogueResponseLike> {
    try {
      const { handle } = npcModel();
      const userPrompt = buildUserPrompt(npc, ex);
      logPrompt({ role: `dialogue:${npc.name}`, system: DIALOGUE_SYSTEM, prompt: userPrompt });
      const { object } = await generateObject({
        model:  handle,
        schema: DialogueResponseSchema,
        system: DIALOGUE_SYSTEM,
        prompt: userPrompt,
      });
      logResponse({ role: `dialogue:${npc.name}`, payload: object });
      // Defence-in-depth: the schema already rejects punctuation-only
      // speech, but a model could in principle slip past with an
      // alphabetic-but-meaningless line. If after trimming the speech
      // has fewer than two word characters, prefer the deterministic
      // fallback to a broken-looking exchange.
      if (!hasMeaningfulSpeech(object.speech)) {
        return this.fallback.respond(w, npc, ex);
      }
      const cleaned = sanitizeSpeech(object.speech, npc.name);
      // After cleaning we might have removed everything (e.g. the model
      // emitted only "Aslin:"). Fall back rather than render an empty line.
      if (!hasMeaningfulSpeech(cleaned)) {
        return this.fallback.respond(w, npc, ex);
      }
      return { ...(object as DialogueResponse), speech: cleaned };
    } catch {
      return this.fallback.respond(w, npc, ex);
    }
  }
}

function hasMeaningfulSpeech(s: string): boolean {
  const letters = s.match(/[\p{L}\p{N}]/gu);
  return !!letters && letters.length >= 2;
}

/**
 * Clean up well-known artefacts that creep into LLM speech regardless of
 * how clearly the system prompt forbids them:
 *
 *   - leading speaker prefix:  "Aslin: foo"   -> "foo"
 *   - leading bare colon:      ": foo"        -> "foo"
 *   - leading/trailing matched quotes: "\"foo\"" or "“foo”" -> "foo"
 *
 * Conservative by design — only strips the exact patterns above so it
 * never eats real content. Leading em-dashes (a legitimate dialogue
 * style) and interior colons are left alone.
 */
export function sanitizeSpeech(raw: string, speakerName: string): string {
  let s = raw.trim();

  // Strip a leading speaker prefix "<Name>:" or just ":" with any
  // surrounding whitespace. Repeat once in case the model produced both
  // ("Aslin: : I think...").
  for (let i = 0; i < 2; i++) {
    const namePrefix = new RegExp(
      `^${escapeRegex(speakerName)}\\s*[:\\-—]\\s*`,
      'i',
    );
    const before = s;
    s = s.replace(namePrefix, '').replace(/^\s*:\s*/, '').trim();
    if (s === before) break;
  }

  // Strip a single pair of surrounding matched quotes.
  const pairs: [string, string][] = [
    ['"', '"'],
    ['\u201C', '\u201D'], // “ ”
    ['\u2018', '\u2019'], // ‘ ’
    ['\'', '\''],
  ];
  for (const [open, close] of pairs) {
    if (s.length >= 2 && s.startsWith(open) && s.endsWith(close)) {
      s = s.slice(open.length, s.length - close.length).trim();
      break;
    }
  }

  // Normalise any *interior* ASCII double quotes to typographic ones.
  // The downstream LLM narrator serialises speech via JSON.stringify,
  // which turns interior `"` into `\"` in the model's prompt. Weaker
  // models (Groq's gpt-oss-20b in particular) copy those escape
  // sequences verbatim into the rendered prose ("Yes?" becomes
  // "\"Yes?\""). Typographic quotes are unaffected by JSON escaping
  // and render as normal quotes.
  s = s.replace(/"/g, '\u201D');

  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUserPrompt(npc: NpcContext, ex: Exchange): string {
  const factsBlock = Object.entries(npc.facts)
    .map(([key, f]) => {
      const aliases = f.aliases?.length ? ` [aliases: ${f.aliases.join(', ')}]` : '';
      return `  - ${key}${aliases}\n    ${f.text}`;
    })
    .join('\n');

  const memoryBlock = npc.recentDialogue.length
    ? npc.recentDialogue
        .slice(-6)
        .map(e => `  ${e.kind === 'said' ? npc.name : 'player'}: ${e.text}`)
        .join('\n')
    : '  (none)';

  const intent =
    ex.mode === 'greet'
      ? 'The player greets you.'
      : ex.mode === 'approached'
      ? 'The player has just walked into the room. They have not spoken yet. ' +
        'Open the conversation yourself with a brief, in-character line — ' +
        'a greeting plus one concrete hook (a topic to ask about, a place ' +
        'to go, or something you need from them). Do not dump everything ' +
        'you know; one hook is enough. Stay in persona.'
      : ex.mode === 'easter-egg'
      ? `The player just made an Earth pop-culture reference your ` +
        `character does not recognise (franchise id: ${ex.easterEggId ?? 'unknown'}). ` +
        `Generic deflection seed (do NOT quote verbatim — rewrite in voice): ` +
        `${JSON.stringify(ex.easterEggHint ?? '')}. ` +
        `Reply as someone who has never heard of this reference. One short ` +
        `line, in character. Set revealedTopicsToPlayer to [].`
      : ex.mode === 'say'
      ? `The player says to you: ${JSON.stringify(ex.utterance ?? '')}`
      : ex.mode === 'ask'
      ? `The player asks you about: ${JSON.stringify(ex.topicPhrase ?? '')}`
      : `The player tells you about: ${JSON.stringify(ex.topicPhrase ?? '')}`;

  const reactivity = buildReactivityBlock(npc);
  const silicaBlock = buildSilicaBlock(npc, ex);

  return [
    `You are: ${npc.name} (${npc.species}).`,
    ``,
    `Persona:`,
    `  ${npc.persona}`,
    ``,
    `Current state:`,
    `  mood: ${npc.mood}`,
    `  trust toward player: ${npc.trust} / 100`,
    ``,
    `Room context:`,
    `  ${npc.roomBrief}`,
    ``,
    `Known facts (use ONLY these for topical content):`,
    factsBlock || '  (none)',
    ``,
    ...(reactivity ? [reactivity, ``] : []),
    ...(silicaBlock ? [silicaBlock, ``] : []),
    `Recent dialogue:`,
    memoryBlock,
    ``,
    `This turn:`,
    `  ${intent}`,
    ``,
    `Produce the structured response now.`,
  ].join('\n');
}

/**
 * Silica binary-search prompt block (only emitted for NPCs carrying the
 * `silicaProtocol` component). Mirrors engine-side enforcement so the
 * model's prose stays consistent with what the engine will actually let
 * through, instead of producing reveals the rulebook then strips out.
 *
 *   pre-examined: chime register only, no semantic content under any mode
 *   examined:     chime register; semantic confirmations ONLY in tell mode
 *                 (one claim per turn); ask/greet/say still chime-only
 *
 * The "⟂ yes / ⟂⟂ no / // uncertain" glyphs are persona-flavour the
 * narrator can lean on; nothing parses them.
 */
export function buildSilicaBlock(npc: NpcContext, ex: Exchange): string | null {
  const s = npc.silicaProtocol;
  if (!s) return null;
  const lines: string[] = ['Silica protocol (binary-search register):'];
  if (!s.readyToSpeak) {
    lines.push('  You have not yet been examined as a sapient interlocutor.');
    lines.push('  Reply in chime/resonance imagery only — no semantic content,');
    lines.push('  no confirmations, no denials. Set revealedTopicsToPlayer to [].');
    return lines.join('\n');
  }
  lines.push('  You have been recognised; the chime register is open.');
  if (ex.mode === 'tell') {
    lines.push('  This is a tell — you MAY confirm at most ONE claim from your');
    lines.push('  known facts that matches the player\'s phrasing. Use the');
    lines.push('  glyphs sparingly: ⟂ yes, ⟂⟂ no, // uncertain. Set');
    lines.push('  revealedTopicsToPlayer to that one topic id if confirming.');
  } else {
    lines.push('  This is not a tell. Reply in chime register only — no');
    lines.push('  semantic confirmations. Set revealedTopicsToPlayer to [].');
  }
  return lines.join('\n');
}

/**
 * Assemble the just-in-time "Reactivity in play" prompt block.
 *
 * Strategy:
 *   1. Collect the union of tags actually present this turn — from the
 *      room and from every tagged item visible to the NPC.
 *   2. Filter the NPC's authored `tagReactions` to that set. If nothing
 *      matches, return null (block is fully elided — no "(none)" line).
 *   3. Filter `inPlayItems` to those that share ≥1 tag with the matched
 *      reactions, so we don't spend tokens listing items the NPC has
 *      nothing to say about. Sort items and tags for determinism.
 *
 * The result is a short prompt fragment the agent appends after the
 * known-facts block. Exported for testing.
 */
export function buildReactivityBlock(npc: NpcContext): string | null {
  const reactions = npc.tagReactions;
  if (!reactions || Object.keys(reactions).length === 0) return null;

  const tagsInPlay = new Set<string>();
  for (const t of npc.roomTags ?? []) tagsInPlay.add(t);
  for (const item of npc.inPlayItems ?? []) {
    for (const t of item.tags) tagsInPlay.add(t);
  }
  if (tagsInPlay.size === 0) return null;

  const matchedTags = [...tagsInPlay].filter(t => reactions[t]).sort();
  if (matchedTags.length === 0) return null;

  const itemsToShow = (npc.inPlayItems ?? [])
    .filter(item => item.tags.some(t => reactions[t]))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const sourceLabel: Record<InPlayItem['source'], string> = {
    'npc-held':    'you carry',
    'player-held': 'player carries',
    'room':        'in the room',
  };

  const itemLines = itemsToShow.map(item => {
    const sortedTags = item.tags.slice().sort().join(', ');
    const desc = item.description ? ` — ${item.description}` : '';
    return `  - ${item.name} [${sourceLabel[item.source]}] (${sortedTags})${desc}`;
  });

  const noteLines = matchedTags.map(t => `  - ${t}: ${reactions[t]}`);

  const out: string[] = [`Reactivity in play (tone/stance guidance — NOT new facts):`];
  if (itemLines.length) {
    out.push(`  Tagged items present:`);
    out.push(...itemLines.map(l => `  ${l}`));
  }
  out.push(`  Your reactivity to these tags:`);
  out.push(...noteLines.map(l => `  ${l}`));
  return out.join('\n');
}
