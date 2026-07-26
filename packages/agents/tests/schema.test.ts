import { describe, it, expect } from 'vitest';
import { DialogueResponseSchema } from '../src/schema.js';

describe('DialogueResponseSchema — speech sanity', () => {
  it('accepts a normal line', () => {
    const r = DialogueResponseSchema.safeParse({ speech: 'Welcome aboard, traveller.' });
    expect(r.success).toBe(true);
  });

  it('accepts a terse in-character deflection', () => {
    expect(DialogueResponseSchema.safeParse({ speech: 'Later.' }).success).toBe(true);
  });

  it('rejects punctuation-only speech', () => {
    for (const s of [':', '...', '—', '?!', '   '.trim() + '.']) {
      const r = DialogueResponseSchema.safeParse({ speech: s });
      expect(r.success, `should reject ${JSON.stringify(s)}`).toBe(false);
    }
  });

  it('rejects empty / whitespace-only speech', () => {
    expect(DialogueResponseSchema.safeParse({ speech: '' }).success).toBe(false);
  });
});
