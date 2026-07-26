import { z } from 'zod';
import type { NpcResponsePayload } from '@ifai/engine';

/**
 * Zod schema for the dialogue agent's structured output.
 *
 * Mirrors `NpcResponsePayload` from the engine. The agent's LLM call
 * uses this schema with `generateObject` so any deviation surfaces as
 * a parse error rather than a malformed world mutation.
 *
 * Constraints we DO express here (defence-in-depth — engine clamps too):
 *  - speech: 1-1000 chars (we want quotable lines, not novellas)
 *  - trustDelta: ±10 cap
 *  - revealedTopicsToPlayer / usedFactKeys: arrays of strings, capped at 6
 *
 * Mood is a free string because authors keep adding new ones; we don't
 * want to hard-code an enum here.
 */
export const DialogueResponseSchema = z.object({
  speech: z
    .string()
    .min(1)
    .max(1000)
    // Require at least one alphanumeric character. Without this, models
    // occasionally emit punctuation-only "speech" (":", "...", "—") which
    // passes a naïve length check but renders as garbage in-game.
    .regex(/[\p{L}\p{N}]/u, 'speech must contain at least one letter or digit'),
  npcMood: z.string().min(1).max(40).optional(),
  trustDelta: z.number().int().min(-10).max(10).optional(),
  usedFactKeys: z.array(z.string()).max(8).optional(),
  revealedTopicsToPlayer: z.array(z.string()).max(6).optional(),
  npcLearnedTopics: z.record(
    z.string(),
    z.object({ text: z.string(), aliases: z.array(z.string()).optional() }),
  ).optional(),
  wantsToEndConversation: z.boolean().optional(),
});

export type DialogueResponse = z.infer<typeof DialogueResponseSchema>;

// Compile-time bridge: anything the schema produces must satisfy the
// engine's NpcResponsePayload, so the action wrapping is a no-op cast.
const _typeCheck: (r: DialogueResponse) => NpcResponsePayload = r => r;
void _typeCheck;
