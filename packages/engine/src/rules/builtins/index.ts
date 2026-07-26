import { Rulebook } from '../rulebook.js';
import { lookCarryOut, examineCheck, examineCarryOut, examineSilicaAfter } from './look.js';
import {
  moveCheck, moveCarryOut, gotoCheck, gotoCarryOut,
  proactiveAfterMove, proactiveAfterGoto,
} from './move.js';
import { takeCheck, takeCarryOut, dropCheck, dropCarryOut } from './take.js';
import { giveCheck, giveCarryOut } from './give.js';
import { presentCheck, presentCarryOut, presentMemorialAfter } from './present.js';
import { inventoryCarryOut, waitCarryOut, timeCarryOut, attendSessionCheck, attendSessionCarryOut } from './misc.js';
import { attendSessionOpen } from './session-open.js';
import {
  converseCheck, converseCarryOut,
  respondAsNpcCheck, respondAsNpcCarryOut, respondAsNpcSilicaReward,
} from './converse.js';
import { clockTickRules, timeCost } from './clock.js';

/**
 * Build a fresh rulebook populated with the engine's universal mechanics.
 * Content packages layer their own rules on top via `book.add(rule)`.
 *
 * Conventions for this set:
 *   - every action with preconditions has a `check` rule and exactly one
 *     `carryOut` rule.
 *   - rules use `specificity = 0` (the default); content rules that need
 *     to override these should use any positive value.
 *   - failure events are emitted by `ctx.fail()`, so the only place that
 *     decides the failed-event shape is the driver.
 */
export function defaultRulebook(): Rulebook {
  const book = new Rulebook()
    .add(lookCarryOut)
    .add(examineCheck).add(examineCarryOut).add(examineSilicaAfter)
    .add(moveCheck).add(moveCarryOut)
    .add(gotoCheck).add(gotoCarryOut)
    .add(proactiveAfterMove).add(proactiveAfterGoto)
    .add(takeCheck).add(takeCarryOut)
    .add(dropCheck).add(dropCarryOut)
    .add(giveCheck).add(giveCarryOut)
    .add(presentCheck).add(presentCarryOut).add(presentMemorialAfter)
    .add(inventoryCarryOut)
    .add(waitCarryOut)
    .add(timeCarryOut)
    .add(attendSessionCheck).add(attendSessionCarryOut).add(attendSessionOpen)
    .add(converseCheck).add(converseCarryOut)
    .add(respondAsNpcCheck).add(respondAsNpcCarryOut).add(respondAsNpcSilicaReward);
  for (const r of clockTickRules) book.add(r);
  return book;
}

export {
  lookCarryOut, examineCheck, examineCarryOut, examineSilicaAfter,
  moveCheck, moveCarryOut, gotoCheck, gotoCarryOut,
  proactiveAfterMove, proactiveAfterGoto,
  takeCheck, takeCarryOut, dropCheck, dropCarryOut,
  giveCheck, giveCarryOut,
  presentCheck, presentCarryOut, presentMemorialAfter,
  inventoryCarryOut, waitCarryOut, timeCarryOut,
  attendSessionCheck, attendSessionCarryOut, attendSessionOpen,
  converseCheck, converseCarryOut,
  respondAsNpcCheck, respondAsNpcCarryOut, respondAsNpcSilicaReward,
  clockTickRules, timeCost,
};
