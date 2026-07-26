import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';

describe('buildThrenody — Contested Casualty items', () => {
  const w = buildThrenody();

  function findByName(name: string): number | undefined {
    for (let i = 0; i < 10_000; i++) {
      const n = w.get(i, 'name');
      if (n?.value === name) return i;
    }
    return undefined;
  }

  function carrierOf(itemId: number): number | undefined {
    for (let i = 0; i < 10_000; i++) {
      const c = w.get(i, 'container');
      if (c?.contents.includes(itemId)) return i;
    }
    return undefined;
  }

  const carrierByItem: Array<{ item: string; carrier: string; topicKey: string }> = [
    { item: "Iren's coin",          carrier: 'Khaleth',              topicKey: 'iren-coin'       },
    { item: 'breath-mask',          carrier: 'Khaleth',              topicKey: 'breath-mask'     },
    { item: 'chime-fragment',       carrier: 'Saen-of-Three-Notes',  topicKey: 'chime-fragment'  },
    { item: 'off-record recording', carrier: 'Aslin Keer',           topicKey: 'the-recording'   },
  ];

  it('every new item is portable, has a description, and is held by the right NPC', () => {
    for (const { item, carrier } of carrierByItem) {
      const itemId = findByName(item);
      expect(itemId, `${item} should exist`).toBeDefined();
      expect(w.get(itemId!, 'portable'), `${item} should be portable`).toBeDefined();
      expect(w.get(itemId!, 'description')?.text?.length, `${item} description`).toBeGreaterThan(20);

      const carrierId = findByName(carrier);
      expect(carrierId, `${carrier} should exist`).toBeDefined();
      expect(carrierOf(itemId!), `${item} should be held by ${carrier}`).toBe(carrierId);
    }
  });

  it('every carrier holds a matching `knows` fact for what they carry', () => {
    for (const { carrier, topicKey } of carrierByItem) {
      const facts = w.get(findByName(carrier)!, 'knows')?.facts ?? {};
      expect(Object.keys(facts), `${carrier} should hold ${topicKey}`).toContain(topicKey);
    }
  });

  it("Iren's coin and the breath-mask are stable, distinct entities held by Khaleth", () => {
    const coin = findByName("Iren's coin");
    const mask = findByName('breath-mask');
    expect(coin).not.toBe(mask);
    const khaleth = findByName('Khaleth')!;
    const contents = w.get(khaleth, 'container')?.contents ?? [];
    expect(contents).toContain(coin);
    expect(contents).toContain(mask);
  });
});
