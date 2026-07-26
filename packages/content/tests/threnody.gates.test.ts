import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';
import { apply, moveInto } from '@ifai/engine';

/**
 * Step 6: hard-gates on Threnody's memorial records. The dialogue agent
 * is free to emit `revealedTopicsToPlayer: ['iren-vass-record']` at any
 * time — the engine must drop it unless the credentials badge has been
 * formally presented (i.e. currently sits in the terminal's container).
 */
function findByName(w: ReturnType<typeof buildThrenody>, name: string): number {
  for (let i = 0; i < 10_000; i++) {
    if (w.get(i, 'name')?.value === name) return i;
  }
  throw new Error(`entity not found: ${name}`);
}

describe('Threnody topic gates', () => {
  it('blocks iren-vass-record before the badge is presented', () => {
    const w = buildThrenody();
    const terminal = findByName(w, 'station terminal');
    const player   = findByName(w, 'you');
    const r = apply(w, {
      kind: 'respondAsNpc', speaker: terminal, audience: player,
      payload: {
        speech: 'I am sorry, that record requires credentials.',
        revealedTopicsToPlayer: ['iren-vass-record'],
      },
    });
    expect(w.get(player, 'knows')?.facts['iren-vass-record']).toBeUndefined();
    const spoke = r.events.find(e => e.kind === 'npcSpoke');
    expect(spoke).toBeDefined();
    if (spoke?.kind !== 'npcSpoke') throw new Error('unreachable');
    expect(spoke.blockedTopics).toContain('iren-vass-record');
  });

  it('allows iren-vass-record once the badge has been presented (held by terminal)', () => {
    const w = buildThrenody();
    const terminal    = findByName(w, 'station terminal');
    const player      = findByName(w, 'you');
    const credentials = findByName(w, 'credentials badge');
    // Simulate the player having presented the badge: it now lives in
    // the terminal's container. We do this by direct moveInto since
    // we're testing the gate, not the present action.
    moveInto(w, credentials, terminal);

    apply(w, {
      kind: 'respondAsNpc', speaker: terminal, audience: player,
      payload: {
        speech: 'Releasing the record.',
        revealedTopicsToPlayer: ['iren-vass-record'],
      },
    });
    const fact = w.get(player, 'knows')?.facts['iren-vass-record'];
    expect(fact?.text).toMatch(/Iren Vass/);
  });

  it('also gates aslin-keer-record on the badge presentation', () => {
    const w = buildThrenody();
    const terminal = findByName(w, 'station terminal');
    const player   = findByName(w, 'you');
    apply(w, {
      kind: 'respondAsNpc', speaker: terminal, audience: player,
      payload: {
        speech: '...',
        revealedTopicsToPlayer: ['aslin-keer-record'],
      },
    });
    expect(w.get(player, 'knows')?.facts['aslin-keer-record']).toBeUndefined();
  });

  it('does not gate non-climactic Threnody facts (e.g. the-station)', () => {
    const w = buildThrenody();
    const terminal = findByName(w, 'station terminal');
    const player   = findByName(w, 'you');
    apply(w, {
      kind: 'respondAsNpc', speaker: terminal, audience: player,
      payload: {
        speech: 'A station of names.',
        revealedTopicsToPlayer: ['the-station'],
      },
    });
    expect(w.get(player, 'knows')?.facts['the-station']).toBeDefined();
  });
});
