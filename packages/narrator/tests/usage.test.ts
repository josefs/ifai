import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  recordUsage, resetUsage, usageSummary,
  usageLevel, isUsageEnabled, getUsageRecords,
} from '../src/llm/usage.js';

describe('usage tracker', () => {
  beforeEach(() => {
    resetUsage();
    delete process.env.IFAI_USAGE;
  });
  afterEach(() => {
    resetUsage();
    delete process.env.IFAI_USAGE;
  });

  it('returns a "no calls" summary when nothing has been recorded', () => {
    expect(usageSummary()).toMatch(/no calls/i);
  });

  it('records calls and totals them in the summary', () => {
    recordUsage({
      role: 'parser', provider: 'groq', model: 'openai/gpt-oss-20b',
      inputTokens: 500, outputTokens: 100, durationMs: 800,
    });
    recordUsage({
      role: 'narrator', provider: 'groq', model: 'llama-3.3-70b-versatile',
      inputTokens: 1200, outputTokens: 300, durationMs: 1500,
    });
    const report = usageSummary();
    expect(report).toContain('parser @ groq:openai/gpt-oss-20b');
    expect(report).toContain('narrator @ groq:llama-3.3-70b-versatile');
    expect(report).toContain('TOTAL');
    // Totals: in 500+1200=1,700, out 100+300=400, total 2,100.
    expect(report).toMatch(/1,700/);
    expect(report).toMatch(/2,100/);
  });

  it('does not mention cost or dollars in the report', () => {
    recordUsage({
      role: 'parser', provider: 'groq', model: 'openai/gpt-oss-20b',
      inputTokens: 500, outputTokens: 100, durationMs: 800,
    });
    const report = usageSummary();
    expect(report).not.toMatch(/\$/);
    expect(report).not.toMatch(/cost/i);
  });

  it('aggregates repeat calls with the same role/provider/model', () => {
    for (let i = 0; i < 3; i++) {
      recordUsage({
        role: 'parser', provider: 'groq', model: 'openai/gpt-oss-20b',
        inputTokens: 100, outputTokens: 20, durationMs: 500,
      });
    }
    expect(getUsageRecords()).toHaveLength(3);
    const report = usageSummary();
    // A single row for the (role, provider:model), calls column = 3.
    const parserLines = report.split('\n').filter(l =>
      l.includes('parser @ groq:openai/gpt-oss-20b'));
    expect(parserLines).toHaveLength(1);
    // The consolidated line should show 300 input tokens, 60 output.
    expect(parserLines[0]).toMatch(/300/);
    expect(parserLines[0]).toMatch(/60/);
  });

  it('does not record calls where both token counts are zero', () => {
    recordUsage({
      role: 'parser', provider: 'groq', model: 'openai/gpt-oss-20b',
      inputTokens: 0, outputTokens: 0, durationMs: 100,
    });
    expect(getUsageRecords()).toHaveLength(0);
  });

  it('usageLevel parses IFAI_USAGE correctly', () => {
    delete process.env.IFAI_USAGE;
    expect(usageLevel()).toBe(0);
    expect(isUsageEnabled()).toBe(false);

    process.env.IFAI_USAGE = '1';
    expect(usageLevel()).toBe(1);
    expect(isUsageEnabled()).toBe(true);

    process.env.IFAI_USAGE = '2';
    expect(usageLevel()).toBe(2);

    process.env.IFAI_USAGE = '0';
    expect(usageLevel()).toBe(0);
    expect(isUsageEnabled()).toBe(false);
  });
});
