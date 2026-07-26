import { describe, it, expect } from 'vitest';
import { buildSilicaBlock } from '../src/llm-agent.js';
import type { NpcContext, Exchange } from '../src/types.js';

function ctx(silica?: { readyToSpeak: boolean }): NpcContext {
  return {
    id: 1, name: 'Saen', persona: 'p', species: 'silica',
    mood: 'attendant', trust: 50, facts: {}, recentDialogue: [],
    roomBrief: '',
    ...(silica ? { silicaProtocol: silica } : {}),
  };
}

const TELL: Exchange = { mode: 'tell', topicPhrase: 'x' };
const ASK:  Exchange = { mode: 'ask',  topicPhrase: 'x' };

describe('buildSilicaBlock', () => {
  it('returns null when no silicaProtocol present', () => {
    expect(buildSilicaBlock(ctx(), TELL)).toBeNull();
  });

  it('pre-examined: chime-only regardless of mode', () => {
    const block = buildSilicaBlock(ctx({ readyToSpeak: false }), TELL)!;
    expect(block).toMatch(/chime/i);
    expect(block).toMatch(/revealedTopicsToPlayer to \[\]/);
    expect(block).not.toMatch(/may confirm/i);
  });

  it('post-examine + tell mode: licenses one-claim confirmation', () => {
    const block = buildSilicaBlock(ctx({ readyToSpeak: true }), TELL)!;
    expect(block).toMatch(/at most ONE/);
    expect(block).toMatch(/⟂/);
  });

  it('post-examine + ask mode: chime register only, no reveals', () => {
    const block = buildSilicaBlock(ctx({ readyToSpeak: true }), ASK)!;
    expect(block).toMatch(/chime register only/);
    expect(block).not.toMatch(/at most ONE/);
    expect(block).toMatch(/revealedTopicsToPlayer to \[\]/);
  });
});
