import { generateObject } from 'ai';
import type { Action, Perception } from '@ifai/engine';
import type { Parser, ParseResult } from '../types.js';
import { ActionsSchema, parsedActionToAction } from './schemas.js';
import { parserModel } from './models.js';
import { PARSER_SYSTEM } from './prompts.js';
import { FallbackParser } from '../parser-fallback.js';
import { logPrompt, logResponse } from './debug.js';
import { recordUsage } from './usage.js';

/**
 * LLM-backed parser. Strategy:
 *  1. Fast path: try the deterministic FallbackParser first. It handles
 *     bare directions, single-word verbs, and chains thereof for free.
 *     If it succeeds, return immediately — saves a model call on most
 *     inputs.
 *  2. Otherwise call the model with `generateObject` and the
 *     `ActionsSchema` wrapper. The model always returns
 *     `{ actions: Action[] }` — typically a one-element array, but a
 *     player can chain steps with "and then" / "then" / commas.
 *  3. Validate the FIRST action's ids/exits strictly against the supplied
 *     perception. Subsequent actions cannot be validated this way because
 *     the world will have moved on by the time they execute; the engine
 *     catches their errors at runtime via `failed` events. (The LLM only
 *     sees the current perception so it can only legitimately reference
 *     ids visible now anyway — in practice subsequent actions are mostly
 *     navigation.)
 *  4. On any failure, surface the fallback parser's error so the game
 *     stays playable.
 */
export class LLMParser implements Parser {
  private fallback = new FallbackParser();

  async parse(input: string, perception: Perception): Promise<ParseResult> {
    const fast = await this.fallback.parse(input, perception);
    if (fast.ok) return fast;

    let actions: Action[];
    try {
      const { handle, provider, model } = parserModel();
      const userPrompt = buildUserPrompt(input, perception);
      logPrompt({ role: 'parser', system: PARSER_SYSTEM, prompt: userPrompt });
      const t0 = Date.now();
      const { object, usage } = await generateObject({
        model:  handle,
        schema: ActionsSchema,
        system: PARSER_SYSTEM,
        prompt: userPrompt,
      });
      recordUsage({
        role:         'parser',
        provider,
        model,
        inputTokens:  usage.inputTokens  ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        durationMs:   Date.now() - t0,
      });
      logResponse({ role: 'parser', payload: object });
      actions = object.actions.map(parsedActionToAction);
    } catch (err) {
      return {
        ok: false,
        reason:
          fast.reason +
          ` (LLM parser unavailable: ${friendlyProviderError(err as Error)})`,
      };
    }

    if (actions.length === 0) {
      return { ok: false, reason: 'LLM parser returned no actions.' };
    }

    // Strict validation against current perception only makes sense for
    // the first action; later actions execute against a mutated world.
    //
    // If validation fails (LLM hallucinated an id or picked a non-visible
    // entity), prefer the fallback parser's in-fiction reason over the
    // validator's technical message. The fallback's reason explains the
    // failure in the player's own words ("I don't see \"X\" here.")
    // which is what the player should see, not "Parser referenced an
    // entity id not in perception: 2".
    const firstCheck = validateAgainstPerception(actions[0]!, perception);
    if (!firstCheck.ok) {
      return { ok: false, reason: fast.reason };
    }

    return { ok: true, actions };
  }
}

function buildUserPrompt(input: string, p: Perception): string {
  return [
    `Player input: ${JSON.stringify(input)}`,
    '',
    'Perception:',
    JSON.stringify(p, null, 2),
  ].join('\n');
}

export function validateAgainstPerception(
  action: Action,
  p: Perception,
): { ok: true } | { ok: false; reason: string } {
  const ids = new Set<number>([
    ...p.room.visibleEntities.map(e => e.id),
    ...p.inventory.map(e => e.id),
  ]);
  switch (action.kind) {
    case 'take':
    case 'drop':
    case 'examine':
      if (!ids.has(action.target)) {
        return {
          ok: false,
          reason: `Parser referenced an entity id not in perception: ${action.target}`,
        };
      }
      break;
    case 'give':
    case 'present':
      if (!ids.has(action.target)) {
        return {
          ok: false,
          reason: `Parser referenced an entity id not in perception: ${action.target}`,
        };
      }
      if (!ids.has(action.to)) {
        return {
          ok: false,
          reason: `Parser referenced a recipient not in perception: ${action.to}`,
        };
      }
      break;
    case 'move': {
      const dirs = new Set(p.room.exits.map(e => e.dir));
      if (!dirs.has(action.dir)) {
        return {
          ok: false,
          reason: `Parser chose a non-existent exit: ${action.dir}`,
        };
      }
      break;
    }
    case 'goto': {
      const dests = new Set(p.room.exits.map(e => e.destinationId));
      if (!dests.has(action.target)) {
        return {
          ok: false,
          reason: `Parser chose a destination not adjacent to this room: ${action.target}`,
        };
      }
      break;
    }
    case 'converse': {
      if (!ids.has(action.target)) {
        return {
          ok: false,
          reason: `Parser referenced an addressee not in perception: ${action.target}`,
        };
      }
      break;
    }
    case 'look':
    case 'inventory':
    case 'wait':
    case 'time':
      break;
  }
  return { ok: true };
}

/**
 * Rewrite provider errors into actionable hints when we recognise them.
 * The AI SDK propagates raw provider messages, which are often terse
 * and platform-specific. We add a one-line pointer at the end so the
 * user can fix the misconfiguration without reading the SDK source.
 *
 * Currently handles:
 *  - Groq refusing `json_schema` on unsupported models. This is by far
 *    the most common gotcha — the Llama family works for streamText but
 *    not for generateObject, so parser and NPC roles need `openai/gpt-oss-*`.
 */
function friendlyProviderError(err: Error): string {
  const msg = err.message ?? String(err);
  if (/does not support response format\s*`?json_schema`?/i.test(msg)) {
    return msg + ' — try IFAI_PARSER_MODEL=openai/gpt-oss-20b (or 120b); ' +
      'only Groq\'s openai/gpt-oss-* models honour json_schema.';
  }
  return msg;
}
