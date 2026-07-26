import { describe, it, expect } from 'vitest';
import { FallbackParser, type Parser } from '../src/index.js';
import type { Perception } from '@ifai/engine';

function makePerception(): Perception {
  const mira = { id: 10, name: 'Mira', aliases: ['mira voss'], portable: false };
  const terminal = { id: 11, name: 'station terminal', aliases: ['terminal', 'threnody'], portable: false };
  return {
    room: {
      id: 1, name: 'lounge', description: 'A lounge.',
      exits: [], visibleEntities: [mira, terminal], lit: true,
    },
    inventory: [],
  };
}

async function parseOne(p: Parser, input: string) {
  const r = await p.parse(input, makePerception());
  if (!r.ok) throw new Error(`parse failed: ${r.reason}`);
  expect(r.actions.length).toBe(1);
  return r.actions[0]!;
}

describe('FallbackParser conversation verbs', () => {
  const p = new FallbackParser();

  it('parses "talk to mira" as greet', async () => {
    const a = await parseOne(p, 'talk to mira');
    expect(a.kind).toBe('converse');
    if (a.kind === 'converse') {
      expect(a.mode).toBe('greet');
      expect(a.target).toBe(10);
    }
  });

  it('parses "greet mira" as greet', async () => {
    const a = await parseOne(p, 'greet mira');
    if (a.kind === 'converse') expect(a.mode).toBe('greet');
  });

  it('parses "hi mira" as greet', async () => {
    const a = await parseOne(p, 'hi mira');
    if (a.kind === 'converse') expect(a.mode).toBe('greet');
  });

  it('parses "ask mira about the negotiations" preserving topic phrase', async () => {
    const a = await parseOne(p, 'ask mira about the negotiations');
    if (a.kind === 'converse' && a.mode === 'ask') {
      expect(a.topicPhrase).toBe('the negotiations');
      expect(a.target).toBe(10);
    } else {
      throw new Error('expected ask');
    }
  });

  it('parses "tell mira about the datapad" preserving topic', async () => {
    const a = await parseOne(p, 'tell mira about the datapad');
    if (a.kind === 'converse' && a.mode === 'tell') {
      expect(a.topicPhrase).toBe('the datapad');
    } else {
      throw new Error('expected tell');
    }
  });

  it('parses quoted "say" with utterance preserved verbatim', async () => {
    // Splitter limitation: commas split clauses, so utterances can't
    // contain commas in v1. Quoted form preserves casing and articles.
    const a = await parseOne(p, 'say "Hello Ambassador" to mira');
    if (a.kind === 'converse' && a.mode === 'say') {
      expect(a.utterance).toBe('Hello Ambassador');
    } else {
      throw new Error('expected say');
    }
  });

  it('resolves terminal via alias "threnody"', async () => {
    const a = await parseOne(p, 'ask threnody about cameras');
    if (a.kind === 'converse' && a.mode === 'ask') {
      expect(a.target).toBe(11);
      expect(a.topicPhrase).toBe('cameras');
    } else {
      throw new Error('expected ask');
    }
  });
});
