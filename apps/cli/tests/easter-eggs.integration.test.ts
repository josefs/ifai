import { describe, it, expect } from 'vitest';
import { World } from '@ifai/engine';
import { detectEasterEgg } from '@ifai/content';
import { FallbackDialogueAgent } from '@ifai/agents';
import type { NpcContext } from '@ifai/agents';

/**
 * End-to-end shape test for the easter-egg pipeline.
 *
 * We don't drive the CLI binary — instead we stitch together the same
 * three steps the CLI's `runDialogueForOutcome` does:
 *   1. Detect an egg on the player's raw topicPhrase / utterance.
 *   2. Build an `easter-egg` Exchange with the resolved hint.
 *   3. Hand it to the dialogue agent and assert the response.
 *
 * If this contract holds, the CLI's short-circuit (which is a literal
 * three-line branch around these calls) will produce the expected
 * dialogue for every Mira/Aslin/Saen/Threnody alike.
 */
function makeMira(): NpcContext {
  return {
    id: 1,
    name: 'Mira',
    persona: 'Veteran negotiator. Guarded.',
    species: 'human',
    mood: 'guarded',
    trust: 50,
    facts: {},
    recentDialogue: [],
    roomBrief: 'the lounge',
  };
}

describe('Easter-egg dialogue pipeline (fallback path)', () => {
  const agent = new FallbackDialogueAgent();
  const w = new World();

  it('player asks Mira about lightsabers → in-character Star Wars deflection', async () => {
    const phrase = 'lightsabers';
    const egg = detectEasterEgg(phrase);
    expect(egg?.id).toBe('star-wars');
    const r = await agent.respond(w, makeMira(), {
      mode: 'easter-egg',
      easterEggId: egg!.id,
      easterEggHint: egg!.hint,
    });
    expect(r.speech).toBe(egg!.hint);
    expect(r.speech).not.toContain('"');
    // No reveals leak through the deflection path.
    expect(r.revealedTopicsToPlayer).toBeUndefined();
    expect(r.usedFactKeys).toBeUndefined();
  });

  it('player tells Mira about warp drive → Star Trek deflection', async () => {
    const phrase = 'about warp drive and beam me up';
    const egg = detectEasterEgg(phrase);
    expect(egg?.id).toBe('star-trek');
    const r = await agent.respond(w, makeMira(), {
      mode: 'easter-egg',
      easterEggId: egg!.id,
      easterEggHint: egg!.hint,
    });
    expect(r.speech).toBe(egg!.hint);
    expect(r.speech).toContain('Delta quadrant');
  });

  it('player says "open the pod bay doors" → HAL deflection', async () => {
    const utt = 'open the pod bay doors';
    const egg = detectEasterEgg(utt);
    expect(egg?.id).toBe('hal-9000');
    const r = await agent.respond(w, makeMira(), {
      mode: 'easter-egg',
      easterEggId: egg!.id,
      easterEggHint: egg!.hint,
    });
    expect(r.speech).toMatch(/dave/i);
  });

  it('off-theme reference does NOT short-circuit (player asks about Spider-Man)', async () => {
    const phrase = 'spider-man';
    expect(detectEasterEgg(phrase)).toBeUndefined();
    // Without an egg, the CLI would dispatch the normal ask path.
    // We sanity-check that path still produces the standard decline
    // because Mira has no facts about spider-man.
    const r = await agent.respond(w, makeMira(), { mode: 'ask', topicPhrase: phrase });
    expect(r.speech).toMatch(/not the one/i);
  });

  it('off-theme fantasy reference (Frodo) does NOT short-circuit', () => {
    expect(detectEasterEgg('hello frodo')).toBeUndefined();
    expect(detectEasterEgg('gandalf')).toBeUndefined();
    expect(detectEasterEgg('hogwarts')).toBeUndefined();
  });
});
