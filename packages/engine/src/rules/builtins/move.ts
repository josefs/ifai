import type { Direction, EntityId } from '../../components.js';
import { World, moveInto, roomOf } from '../../world.js';
import { defineRule } from '../types.js';

export const moveCheck = defineRule({
  name: 'move:check',
  on: 'move', phase: 'check',
  run: (w, a, ctx) => {
    const room = roomOf(w, w.player());
    if (room === undefined) return ctx.fail('no_exit');
    const exits = w.get(room, 'exits');
    if (!exits || exits.to[a.dir] === undefined) return ctx.fail('no_exit');
    return 'continue';
  },
});

export const moveCarryOut = defineRule({
  name: 'move:carry-out',
  on: 'move', phase: 'carryOut',
  run: (w, a, ctx) => {
    const player = w.player();
    const from = roomOf(w, player)!;
    const to = w.get(from, 'exits')!.to[a.dir]!;
    moveInto(w, player, to);
    ctx.emit({ kind: 'moved', from, to, dir: a.dir });
    return 'continue';
  },
});

/**
 * `goto` is "move to an adjacent room id"; the engine resolves which exit
 * leads there. We don't run a real pathfinder; if the target isn't directly
 * reachable from the current room we fail with `no_exit`. (Multi-step
 * travel could be implemented later as a `before` rule that expands the
 * action into a queue of `move` actions.)
 */
function findExitTo(w: World, target: EntityId):
  { dir: Direction; dest: EntityId } | undefined {
  const room = roomOf(w, w.player());
  if (room === undefined) return undefined;
  const exits = w.get(room, 'exits');
  if (!exits) return undefined;
  for (const [d, dest] of Object.entries(exits.to) as [Direction, EntityId][]) {
    if (dest === target) return { dir: d, dest };
  }
  return undefined;
}

export const gotoCheck = defineRule({
  name: 'goto:check',
  on: 'goto', phase: 'check',
  run: (w, a, ctx) => {
    if (!findExitTo(w, a.target)) return ctx.fail('no_exit', a.target);
    return 'continue';
  },
});

export const gotoCarryOut = defineRule({
  name: 'goto:carry-out',
  on: 'goto', phase: 'carryOut',
  run: (w, a, ctx) => {
    const hit = findExitTo(w, a.target)!;
    const player = w.player();
    const from = roomOf(w, player)!;
    moveInto(w, player, hit.dest);
    ctx.emit({ kind: 'moved', from, to: hit.dest, dir: hit.dir });
    return 'continue';
  },
});

/**
 * Proactive NPCs greet the player when they walk in. Runs in the `after`
 * phase so all carryOut state changes have settled. Emits a `noticed`
 * event for each proactive NPC in the destination room that hasn't
 * exchanged dialogue with the player yet — the dialogue agent layer
 * picks that up and produces an unprompted opening line.
 *
 * "First encounter" is detected via empty `dialogueMemory.entries`,
 * which is what the agent layer would consult anyway. Keeping the
 * trigger one-shot avoids spamming greetings on every re-entry; if the
 * conversation has already happened, the player presumably doesn't
 * need to be re-prompted.
 */
function emitProactiveGreetings(w: World, ctx: { emit: (e: import('../../events.js').Event) => void }): void {
  const player = w.player();
  const room = roomOf(w, player);
  if (room === undefined) return;
  const here = w.get(room, 'container')?.contents ?? [];
  for (const eid of here) {
    if (eid === player) continue;
    const proactive = w.get(eid, 'proactive');
    if (!proactive?.greetOnEntry) continue;
    if (!w.has(eid, 'npc')) continue;
    const memory = w.get(eid, 'dialogueMemory');
    if (memory && memory.entries.length > 0) continue;
    ctx.emit({ kind: 'noticed', observer: eid, target: player, trigger: 'enteredRoom' });
  }
}

export const proactiveAfterMove = defineRule({
  name: 'proactive:after-move',
  on: 'move', phase: 'after',
  run: (w, _a, ctx) => { emitProactiveGreetings(w, ctx); return 'continue'; },
});

export const proactiveAfterGoto = defineRule({
  name: 'proactive:after-goto',
  on: 'goto', phase: 'after',
  run: (w, _a, ctx) => { emitProactiveGreetings(w, ctx); return 'continue'; },
});
