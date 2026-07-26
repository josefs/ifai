# Architecture

This document describes the design of IFAI — an LLM-driven interactive fiction
project set on **Waystation Threnody**, a multi-species diplomatic station
during a 72-hour ceasefire negotiation.

The bootstrap in this repository implements the deterministic core. The LLM
parser, LLM narrator, and per-NPC agent layers plug in behind the interfaces
already defined here.

## Guiding principle

> **The world model is authoritative. The LLM is the interface.**

Every architectural decision below follows from this. The engine — a pure,
deterministic ECS — is the source of truth for everything that "happened" in
the fiction. LLMs are responsible only for translating between natural
language and structured engine inputs/outputs. They never decide what is true
about the world, only how to phrase it or how to interpret a player's request.

This split keeps the LLM doing what it's best at (voice, texture, social
reasoning) and keeps it firmly out of what it's worst at (long-range
consistency, fair puzzle logic, keeping secrets).

## Turn loop

```
Player input (natural language)
        ↓
[Parser]         ← LLM #1 (or fallback): NL + Perception → Action[]
        ↓
[Engine.applyAll] ← deterministic: World × Action[] → ChainOutcome[]
        │           (per action: if `addressed` event was emitted,
        │            invoke DialogueAgent → wrap in respondAsNpc →
        │            re-apply through rulebook → append events)
        ↓
[Narrator]       ← LLM #2 (or fallback): per-action Event[] + Perception → prose
        ↓
Player output
```

Every turn:

1. The CLI/UI hands raw input plus a `Perception` snapshot to the **parser**.
2. The parser returns an array of `Action`s — typically one, occasionally
   several when the player chains steps with "and then" / "then" /
   commas — or a parse-failure with an explanation.
3. `applyAll(world, actions)` runs each action through the rulebook in
   order, mutating the world and emitting structured **events**. It
   stops on the first action that fails and reports the rest as skipped.
4. The **narrator** receives the events for each executed action and a
   fresh perception (re-perceived between actions, since state mutates).
5. Engine state is the only thing that survives between turns. LLM context
   does not.

### Action chains

Players can chain steps in one input line:

```
> go spinward and then go outward
> take the datapad, then leave
> look; inventory; wait
```

The fallback parser splits on `\s+and\s+then\s+|\s+then\s+|\s*;\s*|\s*,\s*|\s+and\s+`. The
LLM parser uses an `ActionsSchema` (`{ actions: Action[] }`) so any
provider that supports `generateObject` returns the chain natively.

`applyAll` runs each action sequentially. The shape of the result is:

```ts
type ChainOutcome = {
  action:  Action;
  events:  Event[];           // empty when status === 'skipped'
  status:  'ok' | 'failed' | 'skipped';
};
```

If any action emits a `failed` event, that action's status is `failed`
and **all subsequent actions are marked `skipped` with empty `events`**.
This matches the player's mental model ("I asked for three things; the
first worked, the second failed, the third never happened") and Inform 7's
"stop the action" semantics.

The CLI prints a small `▸ <verb summary>` header per step in chained
turns, then either narrates the events or prints a deterministic
"[did not happen — earlier step failed]" line for skipped steps.

**Limitation (v1):** A chain step that references an entity only visible
*after* an earlier step (e.g. `go to the lounge and give cup to Mira` from
the cabin) cannot resolve the recipient — both parsers see only the
current perception. Multi-room chains of pure navigation work perfectly;
mixed chains require richer perception (planned, not built).

## The ECS world model (`packages/engine`)

The world is an Entity-Component-System. Entities are bare integer ids;
components are pure data attached to entities. Systems are functions that
query for component combinations and mutate them.

Why ECS for IF:

- **Composition over inheritance.** A "magic key that's also a weapon" is
  just `Portable + Weapon + Key` — no class hierarchy to refactor.
- **Queryable state.** "All lit light sources in the player's room" is a
  one-liner.
- **Clean LLM boundary.** We can serialize *only the components the LLM
  needs to see* via the perception filter.
- **Trivial save/load.** Components are plain data. JSON in, JSON out.

### Components

Defined as keys of `ComponentMap` in `components.ts`. To add a component:
add a key + interface to `ComponentMap`, then access it as
`world.get(eid, 'mykey')`. Strict TypeScript ensures every consumer is
type-checked.

A few worth highlighting:

- **`location` and `container`.** `location.holderId` is the *canonical*
  truth about containment; `container.contents` is a mirror kept in sync via
  the `moveInto` helper. **Never set `holderId` directly** — go through
  `moveInto` so the mirrors stay coherent.
- **Tag components** (`room`, `player`, `portable`) are empty objects used
  purely for queries.
- **`knows.facts`** is a `Set<string>` representing what an NPC believes.
  This is what the per-NPC agent prompt will be filtered against later — an
  NPC must not be able to leak a fact it does not know.

### Actions and events

`Action` (in `actions.ts`) is what the parser emits and the engine accepts.
`Event` (in `events.ts`) is what the engine emits for the narrator.

Both are discriminated unions keyed on `kind`. The compile-time
`_typeCheck` between the LLM `ActionSchema` and the engine `Action` keeps
the parser schema in lockstep; rules registered for an action kind are
the runtime side of that contract.

Failure events carry a structured `reason` (e.g. `'no_exit'`,
`'not_portable'`, `'refused'`). The narrator decides how to phrase them
in-fiction — "You can't go that way" vs. "The bulkhead doesn't budge" —
and the engine never speaks directly to the player.

### Rulebooks (`rules/`)

The engine's dispatch is a **rulebook**, not a switch. This is the same
pattern Inform 7 uses, ported to TypeScript and ECS. It exists to solve
the combinatorial problem of transitive verbs ("give X to Y", "unlock X
with Y", "put X on Y"): instead of one giant function per verb, we have
many small rules that pattern-match on the action *and* the components
of its participants.

**Phases.** Every action runs through five phases in order:

| Phase    | Purpose                                                |
|----------|--------------------------------------------------------|
| before   | Atmospheric reactions and last-chance interventions    |
| check    | Preconditions; a failure here aborts the whole action  |
| carryOut | The actual world mutation + primary success event      |
| after    | Consequences and triggered side effects                |
| report   | Last-resort prose if nothing has been emitted          |

Within a phase, rules run in **descending specificity** order; equal
specificity preserves registration order (stable sort). A rule returns:

- `'continue'` — let later rules in the same phase fire too;
- `'stop'`    — end this phase; subsequent phases still run;
- `'fail'`    — abort the entire action; emitted via `ctx.fail(reason)`.

**Why this shape.** With pure component-keyed rules a generic
`take` rule covers every portable item; a generic `unlock` rule covers
every lockable; specificity lets a content pack add "Mira refuses any
gift but her own credentials" by registering one extra `check` rule
without touching the universal one. The pattern is predicate dispatch
with phase ordering — much smaller than a real rules engine and
purpose-shaped for IF.

**Adding an action.**

1. Add the variant to `Action` in `actions.ts`.
2. Add any new event variants and `FailureReason` values in `events.ts`.
3. Write check + carryOut rules in `rules/builtins/<kind>.ts` (use
   `defineRule({...})` so the action is type-narrowed inside `run`).
4. Register them in `defaultRulebook()`.
5. Update `ActionSchema` (`narrator/llm/schemas.ts`) — the
   compile-time `_typeCheck` will refuse to build until you do.
6. Add a parser path (fallback verb table + LLM prompt example).

**Adding a content rule.** Content packages start from
`defaultRulebook()` and call `.add(rule)` with rules that have higher
`specificity` than the universal ones — typically `100` for
entity-specific reactions. The same Action can have any number of
`before`/`check`/`after` rules from different sources; only `carryOut`
is normally singular.

**Future affordances** the rulebook unlocks: a "probe" mode where the
parser asks the engine "would `take rock` succeed right now?" by running
just the check phase with a flag; a `before` rule that expands `goto`
into a multi-step travel plan; per-room ambient `after` rules ("the AI
notices you").

### Perception (`perception.ts`)

The single most important LLM-facing surface. `perceive(world)` returns a
serializable POV snapshot:

```ts
{
  room: { id, name, description, exits, visibleEntities, lit },
  inventory: [...]
}
```

**The perception is the only thing the LLM should ever see about the world.**
Raw component tables are never passed to a model. This keeps prompts small,
keeps secrets out of NPC contexts, and makes per-NPC perception (later) a
matter of writing a different filter rather than retrofitting visibility
into every system.

In a dark room, `lit` is false and `visibleEntities` is empty — but exits
and the room's id are still present, so basic navigation continues to work.

## The narrator package (`packages/narrator`)

This package owns the *interface* between the engine and any LLM, plus
deterministic fallback implementations so the project runs without API
keys.

### Parser

`Parser.parse(input, perception) → ParseResult` produces an `Action` or a
structured parse failure. Implementations:

- **`FallbackParser`** — verb-noun matcher with direction shortcuts and
  alias resolution against the perceived entities. Used by tests and as a
  graceful degradation. We may keep it as a fast-path for trivial inputs
  (`north`, `inv`, `look`) even with the LLM enabled.
- **`LLMParser`** — calls the model via the AI SDK's `generateObject` with
  a Zod schema (`ActionSchema` in `llm/schemas.ts`) that mirrors `Action`.
  The schema's inferred type is asserted assignable to `Action` at compile
  time so the two definitions can't drift. The `LLMParser` always tries
  `FallbackParser` first as a fast path, then falls back to its error
  message on any LLM failure.

Both implementations are constrained to producing entity ids that appear in
the supplied perception. The engine treats an out-of-perception id as a
parse error rather than a successful action — the LLM cannot smuggle in
entities the player can't see.

### Narrator

`Narrator.narrate(events, world, perception) → string`. Implementations:

- **`FallbackNarrator`** — string templates per event kind. Serviceable,
  not pretty.
- **`LLMNarrator`** — streams prose via the AI SDK's `streamText`.
  Receives an optional `onToken(chunk)` callback so UIs can render tokens
  as they arrive. Events are resolved to entity *names* before being
  shown to the model so the model never has to look up ids. Allowed
  entity names are explicitly whitelisted in the prompt. On any stream
  error the LLMNarrator falls back to the template narrator and replays
  the resulting string through `onToken` so the contract — *every
  character of the final text passes through `onToken` exactly once* —
  holds in both paths.

The narrator may add non-canonical sensory detail (a smell, a distant sound)
but **must not** introduce entities, mutate state, or contradict facts.
Authored set-pieces (the climax, the reveal, the opening line) bypass the
narrator and pass through verbatim.

## LLM provider layer (`packages/narrator/src/llm/`)

The single place that knows about specific LLM vendors. Everything above
this layer sees only an AI SDK `LanguageModel` handle.

```
parser/narrator code
   │  parserModel(), narratorModel(), npcModel(), directorModel()
   ▼
models.ts          ← role-aware named handles (lazy + cached per role)
   │  resolveModel(role)
   ▼
providers.ts       ← env → AI SDK model handle
   │
   ▼
Vercel AI SDK      ← generateObject / streamText
   │
   ▼
provider packages  ← ollama-ai-provider-v2, @openrouter/ai-sdk-provider, ...
```

### Environment contract

Selection is environment-driven so the same code runs in CLI, web, and CI:

```
IFAI_<ROLE>_PROVIDER  = ollama | openrouter | groq  (default: ollama)
IFAI_<ROLE>_MODEL     = e.g. qwen2.5, anthropic/claude-3.5-sonnet,
                              llama-3.3-70b-versatile
```

Where `<ROLE>` is `PARSER`, `NARRATOR`, `NPC`, or `DIRECTOR`. General
defaults can be set with `IFAI_PROVIDER` and `IFAI_MODEL`. Per-role
variables override the general defaults, which override the built-in
defaults (`ollama` / `qwen2.5`).

Provider-specific configuration:

```
OLLAMA_BASE_URL        (default: http://localhost:11434/api)
OPENROUTER_API_KEY     (required if any role uses openrouter)
OPENROUTER_BASE_URL    (optional)
GROQ_API_KEY           (required if any role uses groq)
GROQ_BASE_URL          (optional; default is Groq's cloud endpoint)
```

Adding a provider:

1. Install its AI SDK provider package.
2. Import its `create*` factory in `providers.ts`.
3. Add a case to `build()` keyed on the provider name.
4. Document its env vars here.

The CLI honours `IFAI_LLM=1` to enable LLM-backed parser/narrator. With
`IFAI_LLM=0` (the default), tests and dev loops run on deterministic
fallbacks — no keys, no network, no flakiness.

### Recommended models per role

The parser uses `generateObject` and so needs a provider/model that
honours JSON-Schema constrained output (look for the
`structured_outputs` capability in the OpenRouter model list). The
narrator and NPC agent use `streamText` with no schema, so any chat
model works.

The free-tier list churns frequently — check
<https://openrouter.ai/api/v1/models> (filter for `:free` suffix and
`structured_outputs` in `supported_parameters`) for the current set.
At time of writing:

| Role     | Free-tier picks (OpenRouter)                                                                       | Paid picks                                          | Groq picks                                                    |
|----------|----------------------------------------------------------------------------------------------------|-----------------------------------------------------|---------------------------------------------------------------|
| parser   | `qwen/qwen3-next-80b-a3b-instruct:free`, `nvidia/nemotron-3-super-120b-a12b:free`                  | `openai/gpt-oss-mini`, `anthropic/claude-3.5-sonnet` | `openai/gpt-oss-20b` (default), `openai/gpt-oss-120b`         |
| narrator | `qwen/qwen3-next-80b-a3b-instruct:free`, `nvidia/nemotron-3-super-120b-a12b:free`                  | `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`      | any (streamText — no schema); `llama-3.3-70b-versatile` works |
| npc      | same as parser (needs structured replies)                                                          | same as parser                                      | same as parser — `openai/gpt-oss-*` only                      |

### Caveats

- **OpenRouter free tier is rate-limited.** Roughly 20 requests/minute
  and 50 requests/day per key on most free models (subject to change).
  The AI SDK retries failed `generateObject` calls up to 3 times, which
  burns through the budget quickly. If you start seeing 429s, switch to
  a paid model or wait out the window.
- **Not every model honours strict JSON-Schema.** If the parser starts
  returning malformed actions or the SDK bails with `AI_RetryError`,
  swap the parser model first. On OpenRouter, only models advertising
  `structured_outputs` in `supported_parameters` are reliable for
  `generateObject`. A "No endpoints found" error usually means the
  model ID is stale — re-check the live list.
- **Local Ollama with small models has its own quirks.** See "What's
  deliberately not here yet" for the `.int()` / llama.cpp crash and the
  flattened converse schema.
- **Groq is the fastest hosted option.** LPU inference means per-request
  latency is typically 5–10× lower than OpenRouter's Anthropic/OpenAI
  backends, which matters when a single player turn fans out to
  parser + narrator + NPC calls. **But not every Groq model supports
  the `json_schema` response format** — as of writing, only the
  `openai/gpt-oss-20b` and `openai/gpt-oss-120b` models do. The parser
  and NPC agent call `generateObject` and therefore need one of these
  (or the AI SDK will surface `This model does not support response
  format json_schema`). The narrator uses `streamText` with no schema,
  so any Groq model works for that role — `llama-3.3-70b-versatile` is
  a good pick for prose. Free-tier keys are rate-limited by
  tokens/minute rather than requests/minute — check
  <https://console.groq.com/docs/rate-limits> for current per-model
  limits, and <https://console.groq.com/docs/structured-outputs> for
  the authoritative list of models supporting structured output.

### Why the AI SDK and not a hand-rolled interface

Different providers handle structured output differently (function calling,
JSON mode, grammar-constrained sampling). The AI SDK abstracts this
behind `generateObject`, which is the single most useful thing in the
library for our purposes. Streaming, retries, schema repair, and tool
calls also land for free. Provider list grows by adding `npm` packages.
Trying to roll the equivalent ourselves would be a project of its own.

## Conversation & NPC agents (`packages/agents`)

Layer 1 of the NPC machinery: playable LLM-driven conversation with the
station's NPCs (Mira, Threnody). The agent layer sits between the engine
and the narrator in the per-action pipeline; it is a *pure* function
that produces a structured response, never mutating the world directly.

### The pipeline

Conversations dispatch through the same rulebook as everything else.
Two new action variants do the work:

- `converse` — the player's intent. A discriminated union by `mode`:
  `greet`, `say` (free utterance), `ask` (about a topic), `tell`. The
  rule emits an `addressed` event carrying the player's verbatim
  topic phrase or utterance.
- `respondAsNpc` — the synthetic action the agent step injects. Its
  rule writes mood, trust, dialogue memory, and any revealed facts,
  then emits `npcSpoke`.

`applyAll(world, actions, { afterEach })` accepts a hook that runs
after each non-skipped action. The CLI's hook inspects the outcome for
`addressed` events, builds an `NpcContext` from the world, calls
`DialogueAgent.respond(...)`, wraps the result in a `respondAsNpc`
action, and dispatches it through the engine. The follow-up events are
appended to the same step's outcome so the narrator renders the whole
exchange as one beat.

```
parse → applyAll {
  for each action:
    apply(world, action) → events
    if events contain `addressed`:
      agent.respond(world, npcCtx, exchange) → DialogueResponse
      apply(world, { kind:'respondAsNpc', payload }) → followUp
      append followUp.events
} → narrator
```

This per-action interleaving (rather than a batch agent pass after the
whole chain) means `ask Mira about X then ask about Y` sees the trust
and memory effects of X before Y runs.

### What the engine guarantees

The agent's response is data, not authority. The engine is the single
arbiter of valid state:

- `trustDelta` is clamped to ±10 per exchange, then the resulting trust
  to `[0, 100]`.
- `revealedTopicsToPlayer` only copies facts the speaker actually knows
  (`knows.facts[topicId]`). Hallucinated topics are silently dropped —
  the model can't poison the player's knowledge base.
- Every state change flows through a rule, so content packs can layer
  higher-specificity rules to intercept (e.g. "Mira refuses to discuss
  Aslin Keer in public").

### What the agent owns

- Persona voice, mood reflection, and topic resolution against the
  NPC's `knows.facts` (id + aliases).
- Deciding what to reveal, when to deflect, and how to end an exchange.
- Producing the literal `speech` line.

### `DialogueAgent` interface

```ts
interface DialogueAgent {
  respond(world: World, npc: NpcContext, exchange: Exchange):
    Promise<DialogueResponse>;
}
```

Two implementations:
- `FallbackDialogueAgent` — deterministic, no network. Matches the
  player's `topicPhrase` against `facts` keys + aliases (case-insensitive
  substring); reveals the matched fact text or declines in-character if
  nothing matches. Used in tests and for offline dev.
- `LLMDialogueAgent` — calls the configured `npc` role model via
  `generateObject` against `DialogueResponseSchema`. On any error
  (provider misconfigured, network failure, schema parse error) it
  falls back to `FallbackDialogueAgent` so the game never stalls.

### NPC components

- `npc` carries `persona`, `species`, `mood`, and `trust: number` (0-100,
  default 50).
- `knows.facts: Record<TopicId, { text: string; aliases?: string[] }>`.
  Topic ids are stable; aliases are natural-language hints used by the
  agent (and the fallback) to resolve the player's `topicPhrase`.
- `dialogueMemory.entries` — FIFO-capped (8) list of recent exchanges,
  each tagged with `speakerId` + `counterpartId` so multi-party dialogue
  is not a breaking schema change later.

### Scope and limits

- Only the addressed NPC speaks (v1).
- `wantsToEndConversation` is captured but unwired (v1 signal only).
- No NPC autonomy or movement yet — those are layers 2-4.
- The agent depends on `@ifai/narrator` for LLM provider helpers
  (`npcModel()`). If a third package needs LLM infra we extract a
  shared `@ifai/llm`; for now, agents → narrator → ai SDK is fine.

## Content package (`packages/content`)

A small Threnody seed: aide quarters → corridor → neutral lounge →
observation balcony, with two NPCs (Ambassador Mira Voss, station AI
Threnody) and a few items. This is intentionally the smallest world that
exercises every system.

Authoring conventions:

- Room descriptions are short, sensory, and **state-independent**. Anything
  that varies with state (time of day, who's present, recent events) is
  composed by the narrator from the perception, not duplicated in the
  base description.
- **Directions** follow ring-station convention: `spinward`/`antispinward`
  around the ring, `inward`/`outward` (toward the hub or rim), `up`/`down`
  between decks, and `in`/`out` for entering or leaving a contained space
  (a cabin off the corridor). Do not use cardinal directions —
  spin gravity makes them meaningless. The parser teaches the LLM this
  vocabulary in `PARSER_SYSTEM`; new directions require updating
  `Direction`, `OPPOSITE`, the `DIR_WORDS` aliases, and `DirectionSchema`
  in lockstep.
- **Navigation by destination.** Players can also name a place ("go to
  the lounge", "balcony"). This is a separate `goto` action carrying a
  room id, not a direction. The engine resolves which exit leads there;
  if the target isn't directly adjacent it fails with `no_exit` (no
  pathfinding yet). The fallback parser matches destination names by
  substring against `perception.room.exits[*].destinationName`. The LLM
  parser receives the same exits structure (now including
  `destinationId`) and is told to prefer `goto` whenever the player names
  a place. The LLM narrator is asked to weave each exit's direction and
  destination name into the prose so the player learns where they can go
  next without seeing a bare `Exits:` list. The fallback narrator
  (template-driven, used in tests and dev mode) still appends a flat
  `Exits: spinward (neutral lounge), up (observation balcony)` line —
  it has no LLM with which to weave.
- NPCs carry a `persona` string today. Once the agent layer lands, that
  string becomes their system prompt, plus `knows.facts` becomes their
  retrievable knowledge.

## What's deliberately not here yet

The following are designed for but unimplemented:

- **Per-NPC agent loop.** Each NPC eventually gets its own LLM call with a
  filtered view of the world (`knows.facts` + their perception of the
  room) and proposes actions, which the engine validates.
- **Director / drama manager.** A higher-level layer that nudges pacing,
  surfaces foreshadowing, and arbitrates ending conditions.
- **Web UI.** The CLI is the development harness; a Vite + React shell will
  reuse the engine and narrator unchanged.
- **Server proxy.** Once the web UI ships, LLM calls go through a thin
  Cloudflare/Vercel/Deno worker so API keys never reach the browser.
- **Persistence.** Save/load is a `JSON.stringify` away — the data is
  already plain — but no save UI exists.
- **Restore strict integer typing in the LLM parser schema.**
  `EntityIdSchema` in `packages/narrator/src/llm/schemas.ts` currently
  uses `z.number().nonnegative().refine(Number.isInteger, ...)` rather
  than `.int()`. The reason is a llama.cpp / Ollama bug: Zod 4 emits
  `.int()` as `{ minimum: 0, maximum: 9007199254740991 }`, and
  llama.cpp's GBNF grammar compiler — used by Ollama for
  structured-output enforcement — crashes its model runner subprocess
  outright on that 16-digit integer range, surfacing as HTTP 500
  ("model runner has unexpectedly stopped"). Bisected via
  `scripts/bisect-schema.ts` on 2026-05-09. Once we move off small
  local models, swap back to `.int()` and remove the runtime refine.
- **Restore the nested converse schema in the LLM parser.** The wire
  schema currently flattens `converse` into `converse_greet | converse_say
  | converse_ask | converse_tell` so the JSON-schema produced by Zod is a
  flat `oneOf`. Originally suspected as the cause of the same 500s, but
  bisecting showed the real cause was the integer-maximum issue above.
  The flattening is still slightly friendlier to weak structured-output
  backends, so we leave it for now. Collapse back to the nested form
  with an inner `mode` discriminator (and drop `parsedActionToAction()`)
  when convenient.

## Boundary rules (the ones that matter)

1. **The engine never imports from the narrator.** The narrator depends on
   the engine, never the reverse.
2. **The narrator never mutates the world.** It receives a `World` for
   read-only inspection of names and descriptions.
3. **The LLM only sees the perception.** Never the raw component tables.
4. **The parser only returns ids in the current perception.** No
   smuggling.
5. **Containment goes through `moveInto`.** Never write `location.holderId`
   directly.
6. **Add an action → register rules for it.** The `ActionSchema`'s
   compile-time check refuses to build until the LLM schema matches; the
   rule engine treats an unhandled action kind as a no-op so missing
   carryOut rules show up in tests as empty event lists.
