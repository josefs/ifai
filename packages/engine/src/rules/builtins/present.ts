import { moveInto, roomOf } from '../../world.js';
import { pushDialogueMemory } from '../../npc.js';
import { defineRule } from '../types.js';

/**
 * `present X to Y` — the ceremonial sibling of `give`.
 *
 * Mechanically very similar: the player must be holding X and Y must be a
 * same-room NPC (which includes the station AI terminal, modelled as an
 * NPC). The slot semantics are identical: `target` is the payload item,
 * `to` is the recipient.
 *
 * What sets `present` apart is *intent*. Where `give` is "here, take this",
 * `present` is "I am formally putting this forward" — credentials shown to
 * a terminal, an offering laid at the memorial wall, evidence handed up
 * the chain. Content packs hook this with higher-specificity rules to
 * unlock topics, dispatch endings, etc. Keeping it a distinct action
 * means the dialogue agent, narrator, and content rules can all tell the
 * two apart without sniffing item ids.
 *
 * The check is duplicated rather than chained to `give:check` because the
 * failure-reason shape is the same and the rulebook does not currently
 * have a "delegate to another action" primitive. If a third near-clone
 * appears, factor.
 */
export const presentCheck = defineRule({
  name: 'present:check',
  on: 'present', phase: 'check',
  run: (w, a, ctx) => {
    if (!w.has(a.target, 'name')) return ctx.fail('unknown_target', a.target);
    if (!w.has(a.to, 'name'))     return ctx.fail('unknown_target', a.to);
    const player = w.player();
    if (a.to === player)          return ctx.fail('not_recipient', a.to);
    if (w.get(a.target, 'location')?.holderId !== player) {
      return ctx.fail('not_held', a.target);
    }
    // Memorial-wall presentations: the recipient is the room itself
    // (carrying the `memorialWall` marker). The player must be standing
    // in it. No NPC check, no same-room check (the room IS the room).
    if (w.has(a.to, 'memorialWall')) {
      if (roomOf(w, player) !== a.to) return ctx.fail('not_here', a.to);
      return 'continue';
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

export const presentCarryOut = defineRule({
  name: 'present:carry-out',
  on: 'present', phase: 'carryOut',
  run: (w, a, ctx) => {
    // The item physically transfers, mirroring `give`. Content rules that
    // want presentation-only-not-transfer (e.g. a memorial wall that
    // accepts an offering but doesn't actually pocket it) can layer a
    // higher-specificity rule that swaps the holder back, or short-circuit
    // before this rule runs.
    moveInto(w, a.target, a.to);
    ctx.emit({ kind: 'presented', target: a.target, to: a.to });
    // The dialogue-memory push only makes sense for an NPC recipient. A
    // memorial-wall room receives the item silently — the climax driver
    // is the audit trail.
    if (w.has(a.to, 'npc')) {
      const player = w.player();
      const itemName = w.get(a.target, 'name')?.value ?? `entity-${a.target}`;
      pushDialogueMemory(w, a.to, {
        kind: 'heard',
        speakerId: player,
        counterpartId: a.to,
        text: `(the player formally presented the ${itemName})`,
      });
    }
    return 'continue';
  },
});

/**
 * Memorial-wall ledger: each successful `present X to memorialWall`
 * appends X (de-duplicated) to the singleton `endingState`. The climax
 * driver reads this set when the session opens. Fires AFTER carry-out
 * so the item is already in the room, and so a higher-specificity
 * content rule can still veto by failing in check.
 *
 * Finding the singleton: scan for the entity carrying `endingState`.
 * In the canonical arc this lives on the clock entity, but the rule
 * is content-agnostic — any single endingState entity works.
 */
export const presentMemorialAfter = defineRule({
  name: 'present:memorial-ledger',
  on: 'present', phase: 'after',
  specificity: 1,
  when: (w, a) => w.has(a.to, 'memorialWall'),
  run: (w, a, ctx) => {
    let stateEnt: number | undefined;
    let state: { presentedAtWall: number[]; sessionOpened: boolean; resolved?: string } | undefined;
    for (const [eid, s] of w.entries('endingState')) {
      stateEnt = eid;
      state = s as typeof state;
      break;
    }
    if (stateEnt === undefined || !state) return 'continue';
    if (state.presentedAtWall.includes(a.target)) {
      ctx.emit({ kind: 'presentedAtMemorial', item: a.target, wall: a.to });
      return 'continue';
    }
    w.add(stateEnt as any, 'endingState', {
      ...state,
      presentedAtWall: [...state.presentedAtWall, a.target],
    });
    ctx.emit({ kind: 'presentedAtMemorial', item: a.target, wall: a.to });
    return 'continue';
  },
});
