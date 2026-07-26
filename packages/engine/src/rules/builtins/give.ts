import { moveInto, roomOf } from '../../world.js';
import { pushDialogueMemory } from '../../npc.js';
import { defineRule } from '../types.js';

/**
 * `give X to Y` — first transitive verb, validating the rule engine's
 * shape for actions with two participants.
 *
 * The check rule encodes universal preconditions:
 *   - the player must be holding X
 *   - the recipient Y must exist and be in the same room
 *   - Y must be an actor (we use the `npc` component as the proxy for
 *     "can be given things" — eventually a dedicated `actor` capability
 *     might be cleaner)
 *
 * Content packages are expected to layer **higher-specificity check
 * rules** on top of this for narrative-specific reactions, e.g.
 *   "Mira refuses anything that isn't her credentials" or
 *   "the station AI accepts a datapad and emits a 'transferred' event".
 */
export const giveCheck = defineRule({
  name: 'give:check',
  on: 'give', phase: 'check',
  run: (w, a, ctx) => {
    if (!w.has(a.target, 'name')) return ctx.fail('unknown_target', a.target);
    if (!w.has(a.to, 'name'))     return ctx.fail('unknown_target', a.to);
    const player = w.player();
    if (a.to === player)          return ctx.fail('not_recipient', a.to);
    if (w.get(a.target, 'location')?.holderId !== player) {
      return ctx.fail('not_held', a.target);
    }
    if (roomOf(w, a.to) !== roomOf(w, player)) {
      return ctx.fail('not_here', a.to);
    }
    if (!w.has(a.to, 'npc')) {
      return ctx.fail('not_recipient', a.to);
    }
    return 'continue';
  },
});

export const giveCarryOut = defineRule({
  name: 'give:carry-out',
  on: 'give', phase: 'carryOut',
  run: (w, a, ctx) => {
    moveInto(w, a.target, a.to);
    ctx.emit({ kind: 'gave', target: a.target, to: a.to });
    // Push a memory entry on the recipient so the dialogue agent sees
    // the transfer on the next ask/tell. Without this, asking the NPC
    // about the object you just handed them looks identical to asking
    // before — they have no record of receiving it. Phrased as a
    // parenthetical action so the agent reads it as "stage direction"
    // rather than a spoken line.
    const player = w.player();
    const itemName = w.get(a.target, 'name')?.value ?? `entity-${a.target}`;
    pushDialogueMemory(w, a.to, {
      kind: 'heard',
      speakerId: player,
      counterpartId: a.to,
      text: `(the player handed you the ${itemName})`,
    });
    return 'continue';
  },
});
