# IFAI — Waystation Threnody

LLM-driven interactive fiction set on a multi-species diplomatic station during
a 72-hour ceasefire negotiation.

This repository is an early-stage prototype. The engine and narrator scaffolding
runs without any LLM API keys via deterministic fallbacks — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design.

## Quick start

```sh
npm install
npm run build
npm test               # runs Vitest

# Deterministic mode (no LLM, no keys, no network):
npm run cli

# LLM mode against local Ollama (default):
IFAI_LLM=1 IFAI_MODEL=llama3 npm run cli

# LLM mode against OpenRouter, free tier (no cost, rate-limited):
export OPENROUTER_API_KEY=sk-or-...
IFAI_LLM=1 IFAI_PROVIDER=openrouter \
  IFAI_MODEL=qwen/qwen3-next-80b-a3b-instruct:free \
  npm run cli

# LLM mode against OpenRouter, paid model:
export OPENROUTER_API_KEY=sk-or-...
IFAI_LLM=1 IFAI_PROVIDER=openrouter \
  IFAI_MODEL=anthropic/claude-3.5-sonnet \
  npm run cli

# LLM mode against Groq (fastest hosted option; runs on LPU hardware).
# The parser and NPC agent need a model that supports json_schema
# response format — as of writing that's only the openai/gpt-oss-* line.
# Llama 3.3 works fine for the narrator but rejects json_schema, so it
# cannot be used for parser or NPC roles.
export GROQ_API_KEY=gsk_...
IFAI_LLM=1 IFAI_PROVIDER=groq \
  IFAI_MODEL=openai/gpt-oss-20b \
  npm run cli

# Groq per-role — small model for the parser, bigger for prose:
IFAI_LLM=1 \
  IFAI_PARSER_PROVIDER=groq   IFAI_PARSER_MODEL=openai/gpt-oss-20b \
  IFAI_NPC_PROVIDER=groq      IFAI_NPC_MODEL=openai/gpt-oss-120b \
  IFAI_NARRATOR_PROVIDER=groq IFAI_NARRATOR_MODEL=llama-3.3-70b-versatile \
  GROQ_API_KEY=gsk_... npm run cli

# Mix providers per role (parser local, narrator hosted):
IFAI_LLM=1 \
  IFAI_PARSER_PROVIDER=ollama       IFAI_PARSER_MODEL=llama3 \
  IFAI_NARRATOR_PROVIDER=openrouter IFAI_NARRATOR_MODEL=qwen/qwen3-next-80b-a3b-instruct:free \
  OPENROUTER_API_KEY=sk-or-... npm run cli
```

Per-role overrides (`PARSER`, `NARRATOR`, `NPC`, `DIRECTOR`), provider
caveats, and the full env contract: see [`ARCHITECTURE.md`](./ARCHITECTURE.md#environment-contract).

The CLI word-wraps its output at the terminal width (capped at 100 cols,
default 80 when stdout isn't a TTY). Override with `IFAI_WRAP=N`.

To debug prompts while playing, set `IFAI_DEBUG_PROMPTS=1` — every LLM
call (parser, narrator, dialogue) prints its system + user prompt to
stderr in a delineated block. Use `IFAI_DEBUG_PROMPTS=2` to also print
the model's response payload. Redirect stderr to capture:

```bash
IFAI_LLM=1 IFAI_DEBUG_PROMPTS=1 npm run cli 2>prompts.log
```

To see how many tokens a session has used, set `IFAI_USAGE=1`. On exit
the CLI prints a per-role summary table to stderr with call counts,
input/output token counts, and wall time. `IFAI_USAGE=2` additionally
prints a one-line stderr note after every LLM call. Regardless of
`IFAI_USAGE`, you can type `usage` (or `tokens`) at any prompt to
print the running total without spending a turn. Cost is not shown —
the AI SDK doesn't expose per-call pricing, and hardcoding a rate
table would rot the moment a provider retunes; multiply the token
counts by whatever your provider currently charges.

```bash
IFAI_LLM=1 IFAI_PROVIDER=groq IFAI_USAGE=1 npm run cli
```

## Layout

- `packages/engine`   — deterministic ECS world model (no LLM dependency)
- `packages/narrator` — parser + narrator interfaces, with deterministic fallbacks
- `packages/agents`   — LLM-driven NPC dialogue agent (with fallback)
- `packages/content`  — Threnody seed content
- `apps/cli`          — Node REPL harness
- `docs/`             — design docs for in-progress arcs

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full picture and
[`docs/arc-contested-casualty.md`](./docs/arc-contested-casualty.md)
for the first playable arc's design spec.
