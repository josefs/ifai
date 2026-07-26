import { describe, it, expect } from 'vitest';
import { sanitizeSpeech } from '../src/llm-agent.js';

describe('sanitizeSpeech', () => {
  it('leaves a normal line untouched', () => {
    expect(sanitizeSpeech('Welcome aboard.', 'Aslin')).toBe('Welcome aboard.');
  });

  it('strips a leading bare colon', () => {
    expect(sanitizeSpeech(': I\'m not the one to ask.', 'Aslin'))
      .toBe('I\'m not the one to ask.');
  });

  it('strips a leading speaker prefix', () => {
    expect(sanitizeSpeech('Aslin: I observe and translate.', 'Aslin'))
      .toBe('I observe and translate.');
  });

  it('strips speaker-prefix case-insensitively', () => {
    expect(sanitizeSpeech('aslin: hello.', 'Aslin')).toBe('hello.');
  });

  it('strips both name AND a stray colon if both appear', () => {
    expect(sanitizeSpeech('Aslin: : I think so.', 'Aslin'))
      .toBe('I think so.');
  });

  it('strips a single pair of surrounding quotes', () => {
    expect(sanitizeSpeech('"Welcome."', 'Mira')).toBe('Welcome.');
    expect(sanitizeSpeech('\u201CWelcome.\u201D', 'Mira')).toBe('Welcome.');
  });

  it('does not strip an interior colon', () => {
    expect(sanitizeSpeech('The rule is simple: do not lie.', 'Mira'))
      .toBe('The rule is simple: do not lie.');
  });

  it('leaves a leading em-dash alone (a legitimate dialogue style)', () => {
    expect(sanitizeSpeech('— a fine evening for it.', 'Mira'))
      .toBe('— a fine evening for it.');
  });

  it('handles a name with diacritics or hyphens safely', () => {
    expect(sanitizeSpeech('Saen-of-Three-Notes: it rings.', 'Saen-of-Three-Notes'))
      .toBe('it rings.');
  });
});
