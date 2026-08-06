import { describe, it, expect } from 'vitest';
import { World, moveInto } from '@ifai/engine';
import { FallbackDialogueAgent } from '../src/index.js';
import type { NpcContext } from '../src/index.js';

function makeCtx(): NpcContext {
  return {
    id: 1, name: 'Mira', persona: 'p', species: 'human',
    mood: 'guarded', trust: 50,
    facts: {
      'negotiations': { text: 'About the talks.', aliases: ['the talks', 'the conference'] },
      'the-datapad': { text: 'About the pad.', aliases: ['the pad', 'datapad'] },
    },
    recentDialogue: [],
    roomBrief: 'lounge',
  };
}

describe('FallbackDialogueAgent', () => {
  const agent = new FallbackDialogueAgent();
  const w = new World();

  it('greet returns pure spoken speech (no name prefix, no embedded quotes)', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'greet' });
    expect(r.speech.length).toBeGreaterThan(0);
    // Fallback speech must never embed the speaker's own name or the
    // `"..."` render wrapping — those belong to the narrator layer.
    expect(r.speech).not.toMatch(/^Mira[:\s]/);
    expect(r.speech).not.toContain('"');
    expect(r.revealedTopicsToPlayer).toBeUndefined();
  });

  it('responds to approached with an unprompted opener', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'approached' });
    expect(r.speech.length).toBeGreaterThan(0);
    expect(r.revealedTopicsToPlayer).toBeUndefined();
  });

  it('delivers a `briefing` fact verbatim on approached when authored', async () => {
    const ctx: NpcContext = {
      ...makeCtx(),
      facts: {
        ...makeCtx().facts,
        briefing: {
          text: 'Listen carefully. The mission: X. The deadline: three hours. First step: talk to Y.',
          aliases: ['the briefing'],
        },
      },
    };
    const r = await agent.respond(w, ctx, { mode: 'approached' });
    expect(r.speech).toBe(
      'Listen carefully. The mission: X. The deadline: three hours. First step: talk to Y.',
    );
  });

  it('matches an ask via direct topic id', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'ask', topicPhrase: 'negotiations' });
    expect(r.speech).toBe('About the talks.');
    expect(r.revealedTopicsToPlayer).toEqual(['negotiations']);
    expect(r.usedFactKeys).toEqual(['negotiations']);
  });

  it('matches an ask via alias', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'ask', topicPhrase: 'the talks' });
    expect(r.revealedTopicsToPlayer).toEqual(['negotiations']);
  });

  it('declines unknown topics in-character (no hallucination)', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'ask', topicPhrase: 'the weather' });
    expect(r.revealedTopicsToPlayer).toBeUndefined();
    expect(r.speech).toMatch(/not the one/i);
    expect(r.speech).not.toContain('"');
  });

  it('tell mode acknowledges without revealing', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'tell', topicPhrase: 'the pad' });
    expect(r.usedFactKeys).toEqual(['the-datapad']);
    expect(r.revealedTopicsToPlayer).toBeUndefined();
  });

  it('easter-egg mode returns the hint as pure speech (no name prefix, no quotes)', async () => {
    const hint = "Sounds like a galaxy far, far away — and I haven't been there.";
    const r = await agent.respond(w, makeCtx(), {
      mode: 'easter-egg',
      easterEggId: 'star-wars',
      easterEggHint: hint,
    });
    expect(r.speech).toBe(hint);
    expect(r.speech).not.toMatch(/^Mira[:\s]/);
    expect(r.speech).not.toContain('"');
    expect(r.usedFactKeys).toBeUndefined();
    expect(r.revealedTopicsToPlayer).toBeUndefined();
  });

  it('easter-egg mode falls back to a generic confused line when hint is missing', async () => {
    const r = await agent.respond(w, makeCtx(), { mode: 'easter-egg', easterEggId: 'star-wars' });
    expect(r.speech).toMatch(/don't know/i);
    expect(r.speech).not.toContain('"');
  });
});
