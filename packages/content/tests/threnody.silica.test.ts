import { describe, it, expect } from 'vitest';
import { buildThrenody } from '../src/index.js';

describe('Saen silica protocol', () => {
  const world = buildThrenody();
  function findByName(name: string): number {
    for (let i = 0; i < 10_000; i++) {
      if (world.get(i, 'name')?.value === name) return i;
    }
    throw new Error(`not found: ${name}`);
  }
  const saen = findByName('Saen-of-Three-Notes');

  it('Saen has a silicaProtocol with all claim topics in knows', () => {
    const proto = world.get(saen, 'silicaProtocol');
    expect(proto).toBeDefined();
    expect(proto!.readyToSpeak).toBe(false);
    expect(proto!.rewarded).toBe(false);
    expect(proto!.claimTopicIds.length).toBeGreaterThanOrEqual(5);
    const facts = world.get(saen, 'knows')?.facts ?? {};
    for (const id of proto!.claimTopicIds) {
      expect(Object.keys(facts), `${id} should be a known fact`).toContain(id);
    }
  });

  it('rewardThreshold is achievable (≤ claimTopicIds length)', () => {
    const proto = world.get(saen, 'silicaProtocol')!;
    expect(proto.rewardThreshold).toBeLessThanOrEqual(proto.claimTopicIds.length);
    expect(proto.rewardThreshold).toBeGreaterThan(0);
  });

  it('every claim topic is gated by readyToSpeak', () => {
    const proto = world.get(saen, 'silicaProtocol')!;
    const gates = world.get(saen, 'topicGates')?.gates ?? {};
    for (const id of proto.claimTopicIds) {
      expect(gates[id], `${id} should have a topic gate`).toBeDefined();
      // While !readyToSpeak the gate must deny.
      expect(gates[id]!(world, 0 as any)).toBe(false);
    }
  });

  it('chimeFragmentId points at an entity with a name', () => {
    const proto = world.get(saen, 'silicaProtocol')!;
    expect(proto.chimeFragmentId).toBeDefined();
    expect(world.get(proto.chimeFragmentId!, 'name')?.value).toBe('chime-fragment');
  });
});
