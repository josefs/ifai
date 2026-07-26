import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';

/**
 * Provider selection — the only place that knows about specific LLM vendors.
 * Everything above this layer (`models.ts`, parser, narrator) sees only an
 * AI SDK `LanguageModel` handle.
 *
 * Selection is environment-driven so the same code runs in CLI, web, and CI:
 *
 *   IFAI_<ROLE>_PROVIDER  = ollama | openrouter | groq   (default: ollama)
 *   IFAI_<ROLE>_MODEL     = e.g. qwen2.5, anthropic/claude-3.5-sonnet,
 *                                 llama-3.3-70b-versatile
 *
 * Where <ROLE> is PARSER, NARRATOR, NPC, or DIRECTOR. A general default may
 * be set with IFAI_PROVIDER and IFAI_MODEL.
 *
 * Provider-specific configuration:
 *   OLLAMA_BASE_URL         (default: http://localhost:11434/api)
 *   OPENROUTER_API_KEY      (required if any role uses openrouter)
 *   OPENROUTER_BASE_URL     (optional)
 *   GROQ_API_KEY            (required if any role uses groq)
 *   GROQ_BASE_URL           (optional; default is Groq's cloud endpoint)
 *
 * Adding a provider:
 *   1. import its `create*` factory
 *   2. add a case to `build()` keyed on its provider name
 *   3. add a sensible default to DEFAULT_MODELS
 *   4. document the env vars it needs above
 */

export type Role = 'parser' | 'narrator' | 'npc' | 'director';

export interface ProviderResolution {
  provider: string;
  model:    string;
  handle:   LanguageModel;
}

const DEFAULT_MODELS: Record<string, string> = {
  // Local-first, offline-friendly defaults. Override with env vars.
  ollama:      'qwen2.5',
  openrouter:  'anthropic/claude-3.5-sonnet',
  // Groq's default MUST support `json_schema` response format because
  // our parser and NPC agents both call `generateObject`. As of writing
  // only Groq's `openai/gpt-oss-*` line honours `response_format:
  // json_schema` — the Llama family rejects the request outright.
  // `openai/gpt-oss-20b` is the smaller/faster of the two and is the
  // right general default; users who want higher quality can override
  // to `openai/gpt-oss-120b`. See ARCHITECTURE.md → "Recommended models
  // per role" for the constraint per role (narrator uses streamText and
  // is free to pick any model).
  groq:        'openai/gpt-oss-20b',
};

export function resolveModel(role: Role): ProviderResolution {
  const upper = role.toUpperCase();
  const provider =
    process.env[`IFAI_${upper}_PROVIDER`] ??
    process.env.IFAI_PROVIDER ??
    'ollama';
  const model =
    process.env[`IFAI_${upper}_MODEL`] ??
    process.env.IFAI_MODEL ??
    DEFAULT_MODELS[provider] ??
    'qwen2.5';

  const handle = build(provider, model);
  return { provider, model, handle };
}

function build(provider: string, model: string): LanguageModel {
  switch (provider) {
    case 'ollama': {
      const ollama = createOllama({
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
      });
      return ollama(model);
    }
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OPENROUTER_API_KEY is required when IFAI_PROVIDER=openrouter',
        );
      }
      const openrouter = createOpenRouter({
        apiKey,
        ...(process.env.OPENROUTER_BASE_URL
          ? { baseURL: process.env.OPENROUTER_BASE_URL }
          : {}),
      });
      return openrouter.chat(model);
    }
    case 'groq': {
      // Groq's LPU inference is the whole point of this provider — the
      // API is OpenAI-shaped, but throughput per request is dramatically
      // higher than the OpenRouter round-trip through Anthropic/OpenAI.
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error(
          'GROQ_API_KEY is required when IFAI_PROVIDER=groq',
        );
      }
      const groq = createGroq({
        apiKey,
        ...(process.env.GROQ_BASE_URL
          ? { baseURL: process.env.GROQ_BASE_URL }
          : {}),
      });
      return groq(model);
    }
    default:
      throw new Error(
        `Unknown LLM provider "${provider}". ` +
        `Supported: ollama, openrouter, groq.`,
      );
  }
}
