import { roomOf } from '../../world.js';
import { perceive } from '../../perception.js';
import { defineRule } from '../types.js';

export const lookCarryOut = defineRule({
  name: 'look:carry-out',
  on: 'look', phase: 'carryOut',
  run: (w, _a, ctx) => {
    const room = roomOf(w, w.player());
    if (room === undefined) return ctx.fail('not_here');
    ctx.emit({ kind: 'looked', room });
    return 'continue';
  },
});

export const examineCheck = defineRule({
  name: 'examine:check',
  on: 'examine', phase: 'check',
  run: (w, a, ctx) => {
    if (!w.has(a.target, 'name')) return ctx.fail('unknown_target', a.target);
    const player = w.player();
    const playerRoom = roomOf(w, player);
    const targetRoom = roomOf(w, a.target);
    const heldByPlayer = w.get(a.target, 'location')?.holderId === player;
    if (!heldByPlayer && playerRoom !== targetRoom) {
      return ctx.fail('not_here', a.target);
    }
    if (!heldByPlayer && !perceive(w).room.lit) {
      return ctx.fail('dark', a.target);
    }
    return 'continue';
  },
});

export const examineCarryOut = defineRule({
  name: 'examine:carry-out',
  on: 'examine', phase: 'carryOut',
  run: (_w, a, ctx) => {
    ctx.emit({ kind: 'examined', target: a.target });
    return 'continue';
  },
});

/**
 * Silica readiness flip: examining a silica-protocol NPC for the first
 * time enables semantic chime responses. Subsequent examinations are a
 * no-op (no event re-emitted).
 */
export const examineSilicaAfter = defineRule({
  name: 'examine:silica-ready',
  on: 'examine', phase: 'after',
  specificity: 1,
  when: (w, a) => {
    const p = w.get(a.target, 'silicaProtocol');
    return !!p && !p.readyToSpeak;
  },
  run: (w, a, ctx) => {
    const proto = w.get(a.target, 'silicaProtocol')!;
    w.add(a.target, 'silicaProtocol', { ...proto, readyToSpeak: true });
    ctx.emit({ kind: 'silicaReady', target: a.target });
    return 'continue';
  },
});
