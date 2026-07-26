import { moveInto, roomOf } from '../../world.js';
import { defineRule } from '../types.js';

export const takeCheck = defineRule({
  name: 'take:check',
  on: 'take', phase: 'check',
  run: (w, a, ctx) => {
    if (!w.has(a.target, 'name')) return ctx.fail('unknown_target', a.target);
    if (!w.has(a.target, 'portable')) return ctx.fail('not_portable', a.target);
    const player = w.player();
    if (w.get(a.target, 'location')?.holderId === player) {
      return ctx.fail('already_held', a.target);
    }
    if (roomOf(w, a.target) !== roomOf(w, player)) {
      return ctx.fail('not_here', a.target);
    }
    return 'continue';
  },
});

export const takeCarryOut = defineRule({
  name: 'take:carry-out',
  on: 'take', phase: 'carryOut',
  run: (w, a, ctx) => {
    moveInto(w, a.target, w.player());
    ctx.emit({ kind: 'took', target: a.target });
    return 'continue';
  },
});

export const dropCheck = defineRule({
  name: 'drop:check',
  on: 'drop', phase: 'check',
  run: (w, a, ctx) => {
    const player = w.player();
    if (w.get(a.target, 'location')?.holderId !== player) {
      return ctx.fail('not_held', a.target);
    }
    if (roomOf(w, player) === undefined) return ctx.fail('not_here', a.target);
    return 'continue';
  },
});

export const dropCarryOut = defineRule({
  name: 'drop:carry-out',
  on: 'drop', phase: 'carryOut',
  run: (w, a, ctx) => {
    const room = roomOf(w, w.player())!;
    moveInto(w, a.target, room);
    ctx.emit({ kind: 'dropped', target: a.target, into: room });
    return 'continue';
  },
});
