import { resolveModel, type ProviderResolution, type Role } from './providers.js';

/**
 * Role-aware named models. Each role can be configured independently via
 * env vars (see providers.ts), so you can — for example — run the parser
 * locally on a small model while the narrator calls a stronger hosted one:
 *
 *   IFAI_PARSER_PROVIDER=ollama       IFAI_PARSER_MODEL=qwen2.5:7b
 *   IFAI_NARRATOR_PROVIDER=openrouter IFAI_NARRATOR_MODEL=anthropic/claude-3.5-sonnet
 *
 * Resolution is lazy and cached per role so the env is read once per process.
 */
const cache = new Map<Role, ProviderResolution>();

function memo(role: Role): ProviderResolution {
  const hit = cache.get(role);
  if (hit) return hit;
  const r = resolveModel(role);
  cache.set(role, r);
  return r;
}

export function parserModel():   ProviderResolution { return memo('parser');   }
export function narratorModel(): ProviderResolution { return memo('narrator'); }
export function npcModel():      ProviderResolution { return memo('npc');      }
export function directorModel(): ProviderResolution { return memo('director'); }

/** For CLI banners and logs. */
export function describeModel(r: ProviderResolution): string {
  return `${r.provider}:${r.model}`;
}
