import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveModel } from '../src/llm/providers.js';

/**
 * Provider resolution is env-driven; these tests set/unset the exact
 * env vars the function reads and assert on the returned metadata.
 * We don't actually invoke the LLM — construction is enough to verify
 * that the SDK factory accepted our config.
 */

const KEYS = [
  'IFAI_PROVIDER', 'IFAI_MODEL',
  'IFAI_PARSER_PROVIDER',   'IFAI_PARSER_MODEL',
  'IFAI_NARRATOR_PROVIDER', 'IFAI_NARRATOR_MODEL',
  'IFAI_NPC_PROVIDER',      'IFAI_NPC_MODEL',
  'IFAI_DIRECTOR_PROVIDER', 'IFAI_DIRECTOR_MODEL',
  'GROQ_API_KEY', 'GROQ_BASE_URL',
  'OPENROUTER_API_KEY',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('resolveModel(groq)', () => {
  it('picks the default groq model when IFAI_*_MODEL is unset', () => {
    process.env.IFAI_NPC_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'sk-test';
    const r = resolveModel('npc');
    expect(r.provider).toBe('groq');
    expect(r.model).toBe('openai/gpt-oss-20b');
    expect(r.handle).toBeTruthy();
  });

  it('honours IFAI_<ROLE>_MODEL over the default', () => {
    process.env.IFAI_NPC_PROVIDER = 'groq';
    process.env.IFAI_NPC_MODEL = 'llama-3.1-8b-instant';
    process.env.GROQ_API_KEY = 'sk-test';
    const r = resolveModel('npc');
    expect(r.model).toBe('llama-3.1-8b-instant');
  });

  it('honours IFAI_MODEL as a general default', () => {
    process.env.IFAI_PROVIDER = 'groq';
    process.env.IFAI_MODEL = 'mixtral-8x7b-32768';
    process.env.GROQ_API_KEY = 'sk-test';
    const r = resolveModel('narrator');
    expect(r.provider).toBe('groq');
    expect(r.model).toBe('mixtral-8x7b-32768');
  });

  it('IFAI_<ROLE>_MODEL wins over IFAI_MODEL', () => {
    process.env.IFAI_PROVIDER = 'groq';
    process.env.IFAI_MODEL = 'llama-3.3-70b-versatile';
    process.env.IFAI_PARSER_MODEL = 'llama-3.1-8b-instant';
    process.env.GROQ_API_KEY = 'sk-test';
    expect(resolveModel('parser').model).toBe('llama-3.1-8b-instant');
    expect(resolveModel('npc').model).toBe('llama-3.3-70b-versatile');
  });

  it('per-role provider overrides IFAI_PROVIDER', () => {
    process.env.IFAI_PROVIDER = 'ollama';
    process.env.IFAI_NPC_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'sk-test';
    expect(resolveModel('npc').provider).toBe('groq');
    expect(resolveModel('parser').provider).toBe('ollama');
  });

  it('accepts GROQ_BASE_URL override without error', () => {
    process.env.IFAI_NPC_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'sk-test';
    process.env.GROQ_BASE_URL = 'https://example.internal/openai/v1';
    expect(() => resolveModel('npc')).not.toThrow();
  });

  it('throws with a clear message when GROQ_API_KEY is missing', () => {
    process.env.IFAI_NPC_PROVIDER = 'groq';
    expect(() => resolveModel('npc')).toThrow(/GROQ_API_KEY/);
  });
});

describe('resolveModel error surface', () => {
  it('unknown provider mentions all supported providers', () => {
    process.env.IFAI_PROVIDER = 'bogus';
    expect(() => resolveModel('npc')).toThrow(/ollama.*openrouter.*groq/);
  });
});
