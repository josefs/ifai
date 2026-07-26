/**
 * Lightweight prompt-logging helper for debugging LLM calls during play.
 *
 * Activated by setting `IFAI_DEBUG_PROMPTS=1` in the environment. When
 * active, every LLM call site (parser, narrator, dialogue agent) prints
 * a clearly delineated block to stderr containing the role, model, and
 * the full system + user prompts that were sent.
 *
 * stderr (not stdout) so it never interleaves with the game's narrative
 * output. Use `2>prompts.log` to capture, or run with stderr visible.
 *
 * Levels:
 *   IFAI_DEBUG_PROMPTS=1   — system + user prompts (the common case)
 *   IFAI_DEBUG_PROMPTS=2   — also print the model's response payload
 *                            (callers pass it via `logResponse`)
 */
export function promptsDebugLevel(): number {
  const v = process.env.IFAI_DEBUG_PROMPTS;
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : (v === '0' ? 0 : 1);
}

export function isPromptsDebug(): boolean {
  return promptsDebugLevel() > 0;
}

/**
 * Print the prompt that's about to be sent to the LLM. No-op unless
 * `IFAI_DEBUG_PROMPTS` is set.
 */
export function logPrompt(args: {
  role: string;
  model?: string;
  system: string;
  prompt: string;
}): void {
  if (!isPromptsDebug()) return;
  const banner = '═'.repeat(72);
  const sub = '─'.repeat(72);
  const header = `[${args.role}]${args.model ? `  model=${args.model}` : ''}`;
  const lines = [
    '',
    banner,
    `LLM PROMPT  ${header}`,
    banner,
    'SYSTEM:',
    sub,
    args.system,
    sub,
    'USER:',
    sub,
    args.prompt,
    banner,
    '',
  ];
  process.stderr.write(lines.join('\n'));
}

/**
 * Print the model's response. No-op unless `IFAI_DEBUG_PROMPTS >= 2`.
 * `payload` may be a string (free text) or an object (structured output).
 */
export function logResponse(args: {
  role: string;
  payload: unknown;
}): void {
  if (promptsDebugLevel() < 2) return;
  const sub = '─'.repeat(72);
  const body = typeof args.payload === 'string'
    ? args.payload
    : JSON.stringify(args.payload, null, 2);
  process.stderr.write(`\n[${args.role}] RESPONSE:\n${sub}\n${body}\n${sub}\n\n`);
}
