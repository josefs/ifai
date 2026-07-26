import { describe, it, expect } from 'vitest';
import type { Perception } from '@ifai/engine';
import { validateAgainstPerception } from '../src/llm/parser-llm.js';

const perception: Perception = {
  room: {
    id: 1,
    name: 'cabin',
    description: 'A cabin.',
    exits: [{ dir: 'out', destinationId: 2, destinationName: 'corridor' }],
    visibleEntities: [
      { id: 10, name: 'datapad', aliases: [], portable: true },
    ],
    lit: true,
  },
  inventory: [],
};

/**
 * The LLM parser validates the first action's ids against the current
 * perception. When the LLM hallucinates an id (e.g. picks the room id
 * because the player typed "look at the delegation seating chart"),
 * the validator rejects the action. These tests pin down what the
 * validator considers in-perception vs out-of-perception.
 *
 * The in-fiction user-facing message comes from the fallback parser
 * (re-used by LLMParser when validation fails); that integration is
 * exercised elsewhere.
 */
describe('LLMParser validateAgainstPerception', () => {
  it('accepts examine targeting a visible entity', () => {
    const r = validateAgainstPerception(
      { kind: 'examine', target: 10 }, perception,
    );
    expect(r.ok).toBe(true);
  });

  it('rejects examine targeting the room id (hallucination)', () => {
    const r = validateAgainstPerception(
      { kind: 'examine', target: 1 }, perception,
    );
    expect(r.ok).toBe(false);
  });

  it('rejects examine targeting a wholly unknown id', () => {
    const r = validateAgainstPerception(
      { kind: 'examine', target: 999 }, perception,
    );
    expect(r.ok).toBe(false);
  });

  it('rejects present targeting an out-of-perception recipient', () => {
    const r = validateAgainstPerception(
      { kind: 'present', target: 10, to: 999 }, perception,
    );
    expect(r.ok).toBe(false);
  });
});
