import type { Event, World, Perception, EntityId } from '@ifai/engine';
import type { Narrator } from './types.js';

/**
 * Template-based narrator. Produces serviceable prose with no LLM. The LLM
 * narrator (later) will share this signature and may delegate to this one
 * for trivial events to save tokens.
 */
export class FallbackNarrator implements Narrator {
  async narrate(events: Event[], world: World, perception: Perception): Promise<string> {
    const out: string[] = [];
    for (const ev of events) out.push(this.renderEvent(ev, world, perception));
    return out.filter(Boolean).join('\n\n');
  }

  private renderEvent(ev: Event, world: World, p: Perception): string {
    switch (ev.kind) {
      case 'looked':
        return renderLook(p);
      case 'moved':
        return renderLook(p);
      case 'took':
        return `You take the ${nameOf(world, ev.target)}.`;
      case 'dropped':
        return `You drop the ${nameOf(world, ev.target)}.`;
      case 'examined': {
        const desc = world.get(ev.target, 'description')?.text;
        return desc ?? `It looks like an ordinary ${nameOf(world, ev.target)}.`;
      }
      case 'gave':
        return `You hand the ${nameOf(world, ev.target)} to ${nameOf(world, ev.to)}.`;
      case 'presented':
        return `You present the ${nameOf(world, ev.target)} to ${nameOf(world, ev.to)}.`;
      case 'inventoryListed':
        if (ev.items.length === 0) return 'You are empty-handed.';
        return 'You are carrying:\n' +
          ev.items.map(i => `  - ${nameOf(world, i)}`).join('\n');
      case 'waited':
        return 'Time passes.';
      case 'timeChecked':
        return renderTimeCheck(ev);
      case 'addressed':
        return renderAddressed(ev, world);
      case 'noticed':
        // Internal trigger for the dialogue agent layer; the NPC's actual
        // line arrives as a separate `npcSpoke` event in the same outcome.
        return '';
      case 'npcSpoke':
        return `${nameOf(world, ev.speaker)}: "${ev.speech}"`;
      case 'silicaReady':
        return `${nameOf(world, ev.target)} shifts faintly, as if a register has opened. A clearer chime forms in your chest.`;
      case 'silicaGifted':
        return `${nameOf(world, ev.donor)} extends a sliver — a ${nameOf(world, ev.item)} — and lets it rest in your palm.`;
      case 'presentedAtMemorial':
        return `You lay the ${nameOf(world, ev.item)} against the wall, where the etched names absorb its weight.`;
      case 'sessionOpened':
        return 'A long, layered chime sounds through the station. The opening session begins.';
      case 'endingResolved':
        return renderEnding(ev.id);
      case 'failed':
        return renderFailure(ev, world);
    }
  }
}

function renderAddressed(
  ev: Extract<Event, { kind: 'addressed' }>,
  world: World,
): string {
  const target = nameOf(world, ev.target);
  switch (ev.mode) {
    case 'greet': return `You catch ${target}'s eye.`;
    case 'ask':   return `You ask ${target} about ${ev.topicPhrase ?? 'it'}.`;
    case 'tell':  return `You tell ${target} about ${ev.topicPhrase ?? 'it'}.`;
    case 'say':   return `You say to ${target}, "${ev.utterance ?? ''}"`;
  }
}

function renderLook(p: Perception): string {
  const lines: string[] = [];
  lines.push(`== ${capitalize(p.room.name)} ==`);
  if (!p.room.lit) {
    lines.push('It is pitch dark. You can\'t see a thing.');
    return lines.join('\n');
  }
  if (p.room.description) lines.push(p.room.description);
  if (p.room.visibleEntities.length) {
    lines.push('You can see: ' +
      p.room.visibleEntities.map(e => e.name).join(', ') + '.');
  }
  if (p.room.exits.length) {
    lines.push('Exits: ' + p.room.exits.map(formatExit).join(', ') + '.');
  } else {
    lines.push('There are no obvious exits.');
  }
  const timeLine = renderTimeStatus(p);
  if (timeLine) lines.push(timeLine);
  return lines.join('\n');
}

/**
 * One-line, deterministic time-pressure surfacing for the fallback
 * narrator. Mirrors what the LLM narrator weaves naturally — kept terse so
 * it doesn't compete with room flavour. Only emitted when a `gameTime` is
 * present on the perception (test worlds without a clock are unaffected).
 */
function renderTimeStatus(p: Perception): string | undefined {
  const t = p.gameTime;
  if (!t) return undefined;
  if (t.sessionStarted) return 'The opening session has begun.';
  const m = t.minutesUntilSession;
  if (m >= 60) {
    const hours = Math.floor(m / 60);
    const mins  = m % 60;
    if (mins === 0) return `Session opens in ${hours} hour${hours === 1 ? '' : 's'}.`;
    return `Session opens in ${hours}h ${mins}m.`;
  }
  return `Session opens in ${m} minute${m === 1 ? '' : 's'}.`;
}

/**
 * Deterministic rendering of an explicit `time` command. Exact numbers —
 * the player asked for the clock, give them the clock.
 *
 * Phrasing matrix:
 *   tracked: false                         -> "Time isn't being tracked here."
 *   sessionStarted, overshoot 0            -> "The opening session has just begun."
 *   sessionStarted, overshoot > 0          -> "The opening session began N {min|h}{...} ago."
 *   !sessionStarted, minutes < 60          -> "N minutes until the opening session."
 *   !sessionStarted, exactly N hours       -> "N hours until the opening session."
 *   !sessionStarted, mixed                 -> "Nh Mm until the opening session."
 */
function renderTimeCheck(
  ev: Extract<Event, { kind: 'timeChecked' }>,
): string {
  if (!ev.tracked) return "Time isn't being tracked here.";
  const opening = ev.openingSessionAt ?? 0;
  const minutes = ev.minutes ?? 0;
  if (ev.sessionStarted) {
    const overshoot = minutes - opening;
    if (overshoot <= 0) return 'The opening session has just begun.';
    return `The opening session began ${formatDuration(overshoot)} ago.`;
  }
  const m = ev.minutesUntilSession ?? 0;
  return `${formatDuration(m)} until the opening session.`;
}

function formatDuration(m: number): string {
  if (m <= 0) return '0 minutes';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const hours = Math.floor(m / 60);
  const mins  = m % 60;
  const hPart = `${hours} hour${hours === 1 ? '' : 's'}`;
  if (mins === 0) return hPart;
  const mPart = `${mins} minute${mins === 1 ? '' : 's'}`;
  return `${hPart} ${mPart}`;
}

function formatExit(e: { dir: string; destinationName?: string }): string {
  return e.destinationName ? `${e.dir} (${e.destinationName})` : e.dir;
}

function renderFailure(
  ev: Extract<Event, { kind: 'failed' }>,
  world: World,
): string {
  const t = ev.target !== undefined ? nameOf(world, ev.target) : undefined;
  switch (ev.reason) {
    case 'no_exit':         return 'You can\'t go that way.';
    case 'not_here':        return `There is no ${t ?? 'such thing'} here.`;
    case 'not_portable':    return `The ${t} won't budge.`;
    case 'already_held':    return `You already have the ${t}.`;
    case 'not_held':        return `You aren't carrying the ${t}.`;
    case 'not_recipient':   return `You can't give anything to ${t ?? 'that'}.`;
    case 'not_listening':   return `${t ?? 'They'} doesn't seem inclined to talk.`;
    case 'refused':         return `${t ?? 'They'} declines.`;
    case 'unknown_target':  return 'You can\'t see any such thing.';
    case 'dark':            return 'It\'s too dark to make out details.';
    case 'unknown_action':  return 'Nothing happens.';
  }
}

function nameOf(world: World, id: EntityId): string {
  return world.get(id, 'name')?.value ?? `entity-${id}`;
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/**
 * Closing paragraph keyed on the resolved ending id. The four canonical
 * arc endings get specific prose; any unrecognised id falls back to a
 * generic curtain-call so a content bug doesn't render as empty silence.
 */
function renderEnding(id: string): string {
  switch (id) {
    case 'vorthi-truth':
      return [
        'You give the names: Iren first, then the War-Crest envoy whose hand struck.',
        'Hearth-faction Vorthi sign the ceasefire. Mira concedes more than she',
        'wanted to. The peace is fragile. It is real.',
        '',
        '== The opening session: a Vorthi-truth ceasefire ==',
      ].join('\n');
    case 'human-truth':
      return [
        "You give the names: Iren first, then the Reach hand that erased her.",
        "The human observers sign; the Vorthi do not. Mira does not look at you",
        "again. Aslin will. He will use you again.",
        '',
        '== The opening session: a human-truth signing ==',
      ].join('\n');
    case 'procedural':
      return [
        'You present credentials and nothing more. The session opens on schedule.',
        'Names are read. Blame is "regrettable circumstances." The talks close',
        'with no resolution. Threnody catalogues the dead anyway.',
        '',
        '== The opening session: procedural compliance ==',
      ].join('\n');
    case 'walkout':
      return [
        'You stand at the wall with empty hands. The chime sounds; the session',
        'opens without you. The Vorthi walk out at minute fourteen. There is',
        'no ceasefire. Mira does not speak to you again.',
        '',
        '== The opening session: walkout ==',
      ].join('\n');
    default:
      return `== The opening session ends: ${id} ==`;
  }
}
