/**
 * Token & timing tracking for LLM calls.
 *
 * All three LLM call sites (parser, narrator, dialogue) funnel their
 * post-call usage numbers into `recordUsage`. The tracker is a process-
 * global singleton — there is only one game in flight per process, and
 * tests can call `resetUsage()` between cases.
 *
 * We deliberately do NOT compute cost. The AI SDK does not expose
 * cost in its usage payload, and hardcoding a per-model price table
 * would rot the moment a provider retunes their pricing. Users who
 * care about spend can multiply the token counts here by whatever
 * their current provider is charging.
 *
 * Levels (controlled by env var `IFAI_USAGE`):
 *   unset / 0 — tracking is still done (it's ~free) but nothing is shown
 *   1         — print a summary table to stderr at exit / on demand
 *   2         — also print a one-line stderr note after every LLM call
 *
 * The tracker deliberately does NOT depend on any AI SDK types — it
 * takes plain numbers. This keeps it usable from any provider and
 * keeps the module cheap to import.
 */

export interface UsageRecord {
  role:         string;
  provider:     string;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  durationMs:   number;
}

const records: UsageRecord[] = [];

export function usageLevel(): number {
  const v = process.env.IFAI_USAGE;
  if (!v) return 0;
  if (v === '0') return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function isUsageEnabled(): boolean {
  return usageLevel() > 0;
}

/**
 * Record a completed LLM call. Silently no-ops if both token counts
 * are missing (some providers omit usage in error paths).
 */
export function recordUsage(r: UsageRecord): void {
  if (r.inputTokens === 0 && r.outputTokens === 0) return;
  records.push(r);
  if (usageLevel() >= 2) {
    process.stderr.write(
      `[usage] ${r.role} ${r.provider}:${r.model} ` +
      `in=${r.inputTokens} out=${r.outputTokens} ` +
      `total=${r.inputTokens + r.outputTokens} ${r.durationMs}ms\n`,
    );
  }
}

export function resetUsage(): void {
  records.length = 0;
}

export function getUsageRecords(): readonly UsageRecord[] {
  return records;
}

interface AggregatedRow {
  key:          string;   // "role @ provider:model"
  calls:        number;
  inputTokens:  number;
  outputTokens: number;
  durationMs:   number;
}

function aggregate(rs: readonly UsageRecord[]): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>();
  for (const r of rs) {
    const key = `${r.role} @ ${r.provider}:${r.model}`;
    const existing = map.get(key);
    if (existing) {
      existing.calls        += 1;
      existing.inputTokens  += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.durationMs   += r.durationMs;
    } else {
      map.set(key, {
        key,
        calls:        1,
        inputTokens:  r.inputTokens,
        outputTokens: r.outputTokens,
        durationMs:   r.durationMs,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Render a human-readable summary table. Safe to call any time; returns
 * a short "no LLM calls" line when nothing has been recorded.
 */
export function usageSummary(): string {
  if (records.length === 0) {
    return 'LLM usage: no calls recorded.';
  }
  const rows = aggregate(records);
  const totalIn    = rows.reduce((s, r) => s + r.inputTokens,  0);
  const totalOut   = rows.reduce((s, r) => s + r.outputTokens, 0);
  const totalMs    = rows.reduce((s, r) => s + r.durationMs,   0);
  const totalCalls = rows.reduce((s, r) => s + r.calls,        0);

  const headers = ['role @ provider:model', 'calls', 'in', 'out', 'total', 'time'];
  const body = rows.map(r => [
    r.key,
    fmtNum(r.calls),
    fmtNum(r.inputTokens),
    fmtNum(r.outputTokens),
    fmtNum(r.inputTokens + r.outputTokens),
    `${(r.durationMs / 1000).toFixed(1)}s`,
  ]);
  const totals = [
    'TOTAL',
    fmtNum(totalCalls),
    fmtNum(totalIn),
    fmtNum(totalOut),
    fmtNum(totalIn + totalOut),
    `${(totalMs / 1000).toFixed(1)}s`,
  ];

  const all = [headers, ...body, totals];
  const widths = headers.map((_, col) =>
    Math.max(...all.map(row => row[col]!.length)),
  );
  const pad = (row: string[]) => row.map((cell, i) => {
    // Right-align numeric columns (all but the first).
    return i === 0 ? cell.padEnd(widths[i]!) : cell.padStart(widths[i]!);
  }).join('  ');
  const separator = widths.map(w => '─'.repeat(w)).join('  ');

  return [
    'LLM usage this session:',
    pad(headers),
    separator,
    ...body.map(pad),
    separator,
    pad(totals),
  ].join('\n');
}
