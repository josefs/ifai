import { streamText } from 'ai';
import type { Event, Perception, World, EntityId } from '@ifai/engine';
import type { Narrator } from '../types.js';
import { narratorModel } from './models.js';
import { buildNarratorSystem } from './prompts.js';
import { FallbackNarrator } from '../narrator-fallback.js';
import { logPrompt, logResponse } from './debug.js';

/**
 * LLM-backed narrator. Streams prose via the AI SDK and falls back to the
 * deterministic template narrator if the model errors. Events are resolved
 * to entity *names* before being shown to the model so the model never has
 * to look up ids — it just renders.
 *
 * Whitelisting: the model is told (via the user prompt) which entity names
 * it may mention. Combined with the system prompt's "do not introduce
 * entities" rule, this catches most hallucinated NPCs/items.
 *
 * Exits: deliberately woven into prose, not appended as a separate line.
 * The LLM receives each exit's direction and destination name in the
 * perception JSON and is instructed to mention them naturally inside the
 * room description ("a corridor curves spinward toward the lounge"). The
 * trade-off versus a deterministic Exits: line is voice over rigour;
 * we accept that the LLM may occasionally fluff a direction.
 */
export class LLMNarrator implements Narrator {
  private fallback = new FallbackNarrator();

  /** If provided, partial tokens are emitted here as they arrive. */
  constructor(private onToken?: (chunk: string) => void) {}

  async narrate(events: Event[], world: World, perception: Perception): Promise<string> {
    if (events.length === 0) return '';

    const emit = (s: string) => { if (this.onToken) this.onToken(s); };

    // `timeChecked` is the response to an explicit player query for the
    // clock. The player wants exact numbers, not paraphrased prose, so we
    // always render it through the deterministic fallback — even in LLM
    // mode. Pull these events out, render them up front, and let the LLM
    // handle whatever else is left. (In practice the `time` command emits
    // only this event, but chains like "time then look spinward" are
    // valid and should still work.)
    const timeEvents = events.filter((e): e is Extract<Event, { kind: 'timeChecked' }> =>
      e.kind === 'timeChecked');
    const restEvents = events.filter(e => e.kind !== 'timeChecked');

    let prefix = '';
    if (timeEvents.length > 0) {
      prefix = await this.fallback.narrate(timeEvents, world, perception);
      if (prefix) emit(prefix);
    }
    if (restEvents.length === 0) return prefix;
    if (prefix) emit('\n\n');

    try {
      const { handle } = narratorModel();
      // Slim the perception once and share it between the system prompt
      // (which gates conditional sections on perception fields) and the
      // user prompt (which embeds the perception JSON). This keeps the
      // two prompts in lockstep — e.g. if `gameTime` is stripped from
      // the user prompt, the GAME TIME rules must also be stripped
      // from the system prompt, otherwise the model is told to weave
      // in a time it can't see and will fabricate one.
      const showsRoom = restEvents.some(e => e.kind === 'looked' || e.kind === 'moved');
      const perceptionForPrompt = stripEntityDescriptions(showsRoom
        ? trimGameTime(perception)
        : slimPerception(perception));
      const userPrompt = buildUserPrompt(restEvents, world, perceptionForPrompt);
      const systemPrompt = buildNarratorSystem(restEvents, perceptionForPrompt);
      logPrompt({ role: 'narrator', system: systemPrompt, prompt: userPrompt });
      const result = streamText({
        model:  handle,
        system: systemPrompt,
        prompt: userPrompt,
      });

      const chunks: string[] = [];
      for await (const delta of result.textStream) {
        chunks.push(delta);
        emit(delta);
      }
      // Surface stream-level errors. textStream completes silently on
      // provider failures; awaiting the final text promise is what throws.
      await result.text;

      const body = chunks.join('');
      logResponse({ role: 'narrator', payload: body });
      return prefix ? `${prefix}\n\n${body}` : body;
    } catch {
      const text = await this.fallback.narrate(restEvents, world, perception);
      if (text) emit(text);
      return prefix ? (text ? `${prefix}\n\n${text}` : prefix) : text;
    }
  }
}

function buildUserPrompt(
  events: Event[],
  world: World,
  perception: Perception,
): string {
  const entityNames = collectAllowedNames(world, perception);
  const resolved = events.map(ev => resolveEvent(ev, world));

  return [
    'Render the following engine events as prose, in order.',
    '',
    'Entity names you may mention (do not invent others):',
    JSON.stringify(entityNames),
    '',
    'Current perception (state after the events):',
    JSON.stringify(perception, null, 2),
    '',
    'Events:',
    JSON.stringify(resolved, null, 2),
  ].join('\n');
}

/**
 * A perception with the room's description, exits, and game-time
 * stripped out.
 *
 * Used when the events of this turn do not include `looked` or `moved`.
 * The LLM has nothing to do with those fields on take/drop/dialogue
 * turns, and showing them invites either repetition (re-describing the
 * room every action) or stray time mentions on the wrong events. The
 * room name and visible-entity list are preserved so the model still
 * has spatial context and an entity whitelist.
 */
function slimPerception(p: Perception): Perception {
  const { gameTime: _gameTime, ...rest } = p;
  return {
    ...rest,
    room: {
      ...p.room,
      description: '',
      exits: [],
    },
  };
}

/**
 * Trim the `gameTime` payload down to just the two fields the narrator
 * needs to phrase a time clause: how long until the session opens, and
 * whether it has already started.
 *
 * The raw `PerceivedGameTime` has four numbers — `minutes`,
 * `openingSessionAt`, `minutesUntilSession`, `sessionStarted`. Showing
 * all four to the LLM was confusing it ("which number do I use? what's
 * the difference between `minutes` and `minutesUntilSession`?") and was
 * occasionally causing it to pick `minutes` (elapsed) instead of
 * `minutesUntilSession` (remaining) — narrating early-game turns as if
 * the deadline were imminent. Leaving only the two semantic fields
 * removes the ambiguity.
 */
function trimGameTime(p: Perception): Perception {
  if (!p.gameTime) return p;
  return {
    ...p,
    gameTime: {
      minutesUntilSession: p.gameTime.minutesUntilSession,
      sessionStarted:      p.gameTime.sessionStarted,
    } as Perception['gameTime'],
  };
}

/**
 * The parser LLM needs per-entity `description` fields so it can resolve
 * "look at the seating chart" → examine the datapad whose description
 * names it. The narrator does NOT need them — events already carry the
 * authored description for any `examined` event, and the room's own
 * description gives ambient texture for look/move. Stripping these
 * fields keeps the narrator prompt focused (and short).
 */
function stripEntityDescriptions(p: Perception): Perception {
  const strip = ({ description: _d, ...rest }: Perception['inventory'][number]) => rest;
  return {
    ...p,
    room: { ...p.room, visibleEntities: p.room.visibleEntities.map(strip) },
    inventory: p.inventory.map(strip),
  };
}

function resolveEvent(ev: Event, world: World): unknown {
  const name = (id: EntityId) => world.get(id, 'name')?.value ?? `entity-${id}`;
  switch (ev.kind) {
    case 'looked':           return { kind: ev.kind, room: name(ev.room) };
    case 'moved':            return { kind: ev.kind, from: name(ev.from), to: name(ev.to), dir: ev.dir };
    case 'took':             return { kind: ev.kind, target: name(ev.target) };
    case 'dropped':          return { kind: ev.kind, target: name(ev.target), into: name(ev.into) };
    case 'examined': {
      const desc = world.get(ev.target, 'description')?.text;
      return { kind: ev.kind, target: name(ev.target), description: desc };
    }
    case 'gave':             return { kind: ev.kind, target: name(ev.target), to: name(ev.to) };
    case 'presented':        return { kind: ev.kind, target: name(ev.target), to: name(ev.to) };
    case 'inventoryListed':  return { kind: ev.kind, items: ev.items.map(name) };
    case 'waited':           return { kind: ev.kind };
    case 'timeChecked':      return { kind: ev.kind, tracked: ev.tracked };
    case 'addressed':
      return {
        kind: ev.kind,
        speaker: name(ev.speaker),
        target: name(ev.target),
        mode: ev.mode,
        ...(ev.utterance   !== undefined ? { utterance:   ev.utterance   } : {}),
        ...(ev.topicPhrase !== undefined ? { topicPhrase: ev.topicPhrase } : {}),
      };
    case 'npcSpoke':
      return {
        kind: ev.kind,
        speaker: name(ev.speaker),
        audience: name(ev.audience),
        speech: ev.speech,
        ...(ev.moodAfter  !== undefined ? { moodAfter:  ev.moodAfter  } : {}),
        ...(ev.trustAfter !== undefined ? { trustAfter: ev.trustAfter } : {}),
        // revealedTopicsToPlayer is engine bookkeeping (topic ids the player
        // now `knows`). It is intentionally NOT forwarded to the narrator —
        // the speech itself already contains the reveal, and surfacing the
        // raw ids tempts the model to echo them ("you make a mental note of
        // the datapad and Iren Vass").
      };
    case 'silicaReady':
      return { kind: ev.kind, target: name(ev.target) };
    case 'silicaGifted':
      return {
        kind: ev.kind,
        donor: name(ev.donor),
        recipient: name(ev.recipient),
        item: name(ev.item),
      };
    case 'presentedAtMemorial':
      return { kind: ev.kind, item: name(ev.item), wall: name(ev.wall) };
    case 'sessionOpened':
      return { kind: ev.kind, atMinute: ev.atMinute };
    case 'endingResolved':
      return { kind: ev.kind, id: ev.id };
    case 'failed':
      return {
        kind: ev.kind,
        action: ev.action,
        reason: ev.reason,
        ...(ev.target !== undefined ? { target: name(ev.target) } : {}),
      };
  }
}

function collectAllowedNames(world: World, p: Perception): string[] {
  const names = new Set<string>([p.room.name]);
  for (const e of p.room.visibleEntities) names.add(e.name);
  for (const e of p.inventory)            names.add(e.name);
  for (const exit of p.room.exits) {
    if (exit.destinationName) names.add(exit.destinationName);
  }
  for (const [, n] of world.entries('name')) names.add(n.value);
  return [...names];
}
