import { z } from 'zod';
import type { Action, Direction } from '@ifai/engine';

/**
 * Zod schema for the LLM parser's structured output.
 *
 * Wire shape vs. engine shape:
 *  - The engine's `Action` union uses `kind: 'converse'` with a nested
 *    `mode` discriminator (greet/say/ask/tell). That's a clean type
 *    domestically.
 *  - On the wire we flatten that into a single discriminator `kind`:
 *    `converse_greet | converse_say | converse_ask | converse_tell`.
 *    A flat top-level `discriminatedUnion('kind')` produces a single
 *    `oneOf` in JSON-schema, which weaker structured-output backends
 *    (notably Ollama with smaller models like llama3) compile reliably.
 *    The previous nested union-of-discriminated-union compiled to
 *    `oneOf` inside `oneOf` and reproducibly hung Ollama on inputs the
 *    fallback parser couldn't handle, returning an HTTP 500.
 *  - `parsedActionToAction()` converts the flat wire shape back to the
 *    engine's nested union before the parser hands actions on.
 *
 * Revisit: once we run on a stronger local model (or move the LLM
 * parser to a hosted provider), the flattening is no longer necessary
 * and we could go back to the nested form for a slightly tighter
 * inferred type. Tracked in the in-source comment here and in
 * ARCHITECTURE.md "What's deliberately not here yet".
 *
 * Constraints we *don't* express in the schema (and instead validate
 * post-hoc against the perception):
 *  - `target` must be an entity id present in the current perception.
 *  - `dir` must be an exit available from the current room.
 *
 * `respondAsNpc` is intentionally absent: it's an internal action only
 * the agent layer emits. The parser must never produce one.
 */
const DirectionSchema = z.enum([
  'spinward', 'antispinward',
  'inward',   'outward',
  'up',       'down',
  'in',       'out',
]) satisfies z.ZodType<Direction>;

/**
 * Entity ids on the wire.
 *
 * We deliberately do NOT use `.int()` here. Zod 4's `z.toJSONSchema`
 * emits `.int()` as `{ type: "integer", minimum: 0, maximum: 9007199254740991 }`,
 * and llama.cpp (which Ollama embeds) tries to compile that 16-digit
 * range into a GBNF grammar — the runner subprocess crashes outright,
 * surfacing as an HTTP 500 on `/api/chat`. See the in-repo debug note
 * dated 2026-05-09. Dropping `.int()` keeps the schema as
 * `{ type: "number", minimum: 0 }` which compiles cleanly. We add a
 * runtime refine so non-integers still fail Zod validation; in
 * practice the LLM never emits decimals for entity ids referenced by
 * literal id in the prompt.
 *
 * Revisit: once we move off small local models, restore `.int()` and
 * delete the refine. Tracked in ARCHITECTURE.md.
 */
const EntityIdSchema = z.number()
  .nonnegative()
  .refine(Number.isInteger, { message: 'entity id must be an integer' });

export const ActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('look') }),
  z.object({ kind: z.literal('inventory') }),
  z.object({ kind: z.literal('wait') }),
  z.object({ kind: z.literal('time') }),
  z.object({ kind: z.literal('attendSession') }),
  z.object({ kind: z.literal('move'),    dir: DirectionSchema }),
  z.object({ kind: z.literal('goto'),    target: EntityIdSchema }),
  z.object({ kind: z.literal('take'),    target: EntityIdSchema }),
  z.object({ kind: z.literal('drop'),    target: EntityIdSchema }),
  z.object({ kind: z.literal('examine'), target: EntityIdSchema }),
  z.object({ kind: z.literal('give'),    target: EntityIdSchema, to: EntityIdSchema }),
  z.object({ kind: z.literal('present'), target: EntityIdSchema, to: EntityIdSchema }),
  // Converse variants — flattened so `kind` is the sole discriminator.
  z.object({ kind: z.literal('converse_greet'), target: EntityIdSchema }),
  z.object({
    kind: z.literal('converse_say'),
    target: EntityIdSchema,
    utterance: z.string().min(1).max(500),
  }),
  z.object({
    kind: z.literal('converse_ask'),
    target: EntityIdSchema,
    topicPhrase: z.string().min(1).max(200),
  }),
  z.object({
    kind: z.literal('converse_tell'),
    target: EntityIdSchema,
    topicPhrase: z.string().min(1).max(200),
  }),
]);

/**
 * Wrapper schema for multi-action input. Always an object with an
 * `actions` array — even single-action turns return a one-element array.
 *
 * We use an object wrapper rather than a top-level array because some
 * AI SDK providers handle object roots more reliably than array roots
 * for `generateObject`.
 *
 * The cap of 10 is a safety bound; a typical chained input (`X and then Y
 * and then Z`) yields 2-3 actions.
 */
export const ActionsSchema = z.object({
  actions: z.array(ActionSchema).min(1).max(10),
});

export type ParsedAction = z.infer<typeof ActionSchema>;

/**
 * Map a wire-shape parsed action to the engine's `Action` union.
 *
 * For non-converse variants this is the identity. For converse variants
 * we lift the flat `converse_*` discriminator back into the engine's
 * `{ kind: 'converse', mode: 'greet'|... }` shape.
 */
export function parsedActionToAction(p: ParsedAction): Action {
  switch (p.kind) {
    case 'converse_greet':
      return { kind: 'converse', mode: 'greet', target: p.target };
    case 'converse_say':
      return { kind: 'converse', mode: 'say', target: p.target, utterance: p.utterance };
    case 'converse_ask':
      return { kind: 'converse', mode: 'ask', target: p.target, topicPhrase: p.topicPhrase };
    case 'converse_tell':
      return { kind: 'converse', mode: 'tell', target: p.target, topicPhrase: p.topicPhrase };
    default:
      return p;
  }
}
