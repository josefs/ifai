import type { Action, Direction, EntityId, Perception, PerceivedEntity } from '@ifai/engine';
import type { Parser, ParseResult } from './types.js';

const DIR_WORDS: Record<string, Direction> = {
  // Around the ring
  spinward: 'spinward', spin: 'spinward', sp: 'spinward',
  antispinward: 'antispinward', antispin: 'antispinward',
  anti: 'antispinward', as: 'antispinward',
  // Radial (toward hub / toward rim). We avoid the single letter `i`
  // because it conflicts with the `inventory` shortcut.
  inward: 'inward', hubward: 'inward', hub: 'inward',
  outward: 'outward', rimward: 'outward', rim: 'outward',
  // Vertical between decks
  up: 'up', u: 'up', upstairs: 'up',
  down: 'down', d: 'down', downstairs: 'down',
  // Entering/leaving a contained space
  in: 'in', enter: 'in',
  out: 'out', exit: 'out', leave: 'out',
};

const VERB_ALIASES: Record<string, string> = {
  l: 'look', look: 'look', 'look around': 'look',
  i: 'inventory', inv: 'inventory', inventory: 'inventory',
  z: 'wait', wait: 'wait',
  time: 'time', clock: 'time',
  // Climax trigger — the player decides to enter the opening session.
  attend: 'attendSession',
  get: 'take', grab: 'take', take: 'take', pick: 'take',
  drop: 'drop', leave: 'drop', put: 'drop',
  x: 'examine', examine: 'examine', inspect: 'examine', read: 'examine',
  go: 'go', move: 'go', walk: 'go',
  give: 'give', offer: 'give', hand: 'give',
  // "present" / "show" are ceremonial — distinct action so content rules
  // can react to formal presentation differently from a casual handover.
  present: 'present', show: 'present',
  // Conversation verbs. `talk` and `greet` are greetings; `ask`/`tell`
  // take a topic; `say` takes an utterance. `hi`/`hello` are greeting
  // shortcuts that don't take a "to" preposition.
  talk: 'talk', speak: 'talk',
  greet: 'greet',
  hi: 'greet', hello: 'greet', hey: 'greet',
  ask: 'ask', query: 'ask',
  tell: 'tell',
  say: 'say',
};

/**
 * Deterministic verb-noun parser. Used:
 *  - by tests (no network, no keys)
 *  - as a fallback when the LLM parser returns low confidence
 *  - as a "fast path" we may keep even with the LLM enabled, to avoid
 *    burning tokens on `north` / `inv` / `look`.
 *
 * Matching strategy:
 *  - normalize input (lowercase, collapse whitespace, strip articles)
 *  - try a bare direction first (`north`, `n`)
 *  - else split into verb + remainder; alias the verb
 *  - resolve the remainder against the perception's visible entities and
 *    inventory by name, alias, or substring.
 *
 * This is intentionally dumb. The LLM parser will handle anything richer.
 */
export class FallbackParser implements Parser {
  async parse(input: string, perception: Perception): Promise<ParseResult> {
    const raw = input.trim();
    if (!raw) return { ok: false, reason: 'empty input' };

    const clauses = splitClauses(raw);
    const actions: Action[] = [];
    /**
     * The verb head of the most recently successful clause, used to
     * recover coordinated-object input where the player drops the verb
     * after the conjunction: "take the datapad and the badge" splits to
     * ["take the datapad", "the badge"], and we retry "the badge" as
     * "take the badge". Updated only when the head is actually a verb
     * we know about, so retried clauses don't pollute it with nouns.
     */
    let lastVerbHead: string | undefined;
    for (const clause of clauses) {
      let result = this.parseSingle(clause, perception);
      if (!result.ok && lastVerbHead) {
        const retry = this.parseSingle(`${lastVerbHead} ${clause}`, perception);
        if (retry.ok) result = retry;
      }
      if (!result.ok) {
        const reason = clauses.length > 1
          ? `In "${clause}": ${result.reason}`
          : result.reason;
        return { ok: false, reason };
      }
      actions.push(result.action);

      const headOf = clause.trim().toLowerCase().split(/\s+/)[0];
      if (headOf && (VERB_ALIASES[headOf] || DIR_WORDS[headOf])) {
        lastVerbHead = headOf;
      }
    }
    return { ok: true, actions };
  }

  /**
   * Parses a single clause. Note: the fallback parser does NOT advance
   * perception between clauses — it parses each clause against the
   * current perception. That means a clause referring to an entity only
   * visible after an earlier move (e.g. `go up and take the cup` from a
   * different deck) cannot be resolved by the fallback. The LLM parser
   * has the same limitation. This is fine for v1; chains of pure
   * navigation work perfectly.
   */
  private parseSingle(input: string, perception: Perception): SingleParseResult {
    const raw = input.trim().toLowerCase();
    if (!raw) return fail('empty clause');

    const cleaned = stripArticles(raw);

    // bare direction?
    const dir = DIR_WORDS[cleaned];
    if (dir) return ok({ kind: 'move', dir });

    // bare destination name? ("lounge", "neutral lounge", "balcony")
    const bareDest = resolveDestination(cleaned, perception);
    if (bareDest !== undefined) return ok({ kind: 'goto', target: bareDest });

    const [head, ...rest] = cleaned.split(/\s+/);
    let tail = rest.join(' ');
    const verb = VERB_ALIASES[head!] ?? head!;

    switch (verb) {
      case 'look': {
        // "look", "look around" → bare look.
        // "look at X" / "look X" → examine X.
        if (tail.startsWith('at ')) tail = tail.slice(3).trim();
        else if (tail === 'around' || tail === 'round') tail = '';
        if (!tail) return ok({ kind: 'look' });
        const e = resolveEntity(tail, perception, 'any');
        if (!e) return fail(`I don't see "${tail}" here.`);
        return ok({ kind: 'examine', target: e.id });
      }
      case 'inventory': return ok({ kind: 'inventory' });
      case 'wait':      return ok({ kind: 'wait' });
      case 'time':      return ok({ kind: 'time' });
      case 'attendSession': {
        // "attend", "attend the session", "attend session" all map to
        // the same kind — tail is ignored beyond a presence check that
        // the player meant "session" (so "attend khaleth" doesn't pun).
        if (tail === '' || tail === 'session' || tail === 'the session'
            || tail === 'the opening' || tail === 'opening'
            || tail === 'opening session' || tail === 'the opening session') {
          return ok({ kind: 'attendSession' });
        }
        return fail(`Attend what? Try "attend the session".`);
      }
      case 'go': {
        // strip a leading "to": "go to the lounge" -> "lounge"
        if (tail.startsWith('to ')) tail = tail.slice(3).trim();
        const d = DIR_WORDS[tail];
        if (d) return ok({ kind: 'move', dir: d });
        const destId = resolveDestination(tail, perception);
        if (destId !== undefined) return ok({ kind: 'goto', target: destId });
        const exitsHint = perception.room.exits
          .map(e => e.destinationName ? `${e.dir} (${e.destinationName})` : e.dir)
          .join(', ');
        return fail(`Go where? Try one of: ${exitsHint}.`);
      }
      case 'take': {
        // Particle verbs: "pick up X", "grab up X" → "take X".
        if (tail.startsWith('up ')) tail = tail.slice(3).trim();
        const e = resolveEntity(tail, perception, 'room');
        if (!e) return fail(`I don't see "${tail}" here.`);
        return ok({ kind: 'take', target: e.id });
      }
      case 'drop': {
        // "put down X", "set down X", "drop off X" → "drop X".
        if (tail.startsWith('down ')) tail = tail.slice(5).trim();
        else if (tail.startsWith('off ')) tail = tail.slice(4).trim();
        const e = resolveEntity(tail, perception, 'inventory');
        if (!e) return fail(`You aren't carrying "${tail}".`);
        return ok({ kind: 'drop', target: e.id });
      }
      case 'examine': {
        // "look at X" / "look X" already handled by alias; allow
        // stragglers like "examine at X".
        if (tail.startsWith('at ')) tail = tail.slice(3).trim();
        const e = resolveEntity(tail, perception, 'any');
        if (!e) return fail(`I don't see "${tail}" here.`);
        return ok({ kind: 'examine', target: e.id });
      }
      case 'give': {
        // Forms: "give X to Y", "give Y X" (less common — skip for now).
        const m = tail.match(/^(.+?)\s+to\s+(.+)$/);
        if (!m) return fail(`Give what to whom? Try "give X to Y".`);
        const [, gift, recipient] = m;
        const item = resolveEntity(gift!.trim(), perception, 'inventory');
        if (!item) return fail(`You aren't carrying "${gift!.trim()}".`);
        const target = resolveEntity(recipient!.trim(), perception, 'room');
        if (!target) return fail(`You don't see "${recipient!.trim()}" here.`);
        return ok({ kind: 'give', target: item.id, to: target.id });
      }
      case 'present': {
        // Same slot order as `give`: "present X to Y".
        const m = tail.match(/^(.+?)\s+to\s+(.+)$/);
        if (!m) return fail(`Present what to whom? Try "present X to Y".`);
        const [, gift, recipient] = m;
        const item = resolveEntity(gift!.trim(), perception, 'inventory');
        if (!item) return fail(`You aren't carrying "${gift!.trim()}".`);
        const target = resolveEntity(recipient!.trim(), perception, 'room');
        if (!target) return fail(`You don't see "${recipient!.trim()}" here.`);
        return ok({ kind: 'present', target: item.id, to: target.id });
      }
      case 'talk': {
        // "talk to X" / "talk with X" / "talk X". Always a greet.
        if (tail.startsWith('to '))   tail = tail.slice(3).trim();
        if (tail.startsWith('with ')) tail = tail.slice(5).trim();
        const e = resolveEntity(tail, perception, 'room');
        if (!e) return fail(`There's no one called "${tail}" here.`);
        return ok({ kind: 'converse', mode: 'greet', target: e.id });
      }
      case 'greet': {
        // "greet X", "hi X", "hello X". `at` is a stretch but harmless.
        if (tail.startsWith('at ')) tail = tail.slice(3).trim();
        if (!tail) return fail(`Greet whom?`);
        const e = resolveEntity(tail, perception, 'room');
        if (!e) return fail(`There's no one called "${tail}" here.`);
        return ok({ kind: 'converse', mode: 'greet', target: e.id });
      }
      case 'ask': {
        // "ask X about Y", "ask X for Y". The topic phrase is preserved
        // *verbatim* (case + articles) so the dialogue agent can resolve
        // it against the NPC's known facts as the player wrote it.
        const orig = input.trim();
        const m = orig.match(/^(?:ask|query)\s+(.+?)\s+(?:about|for|regarding)\s+(.+)$/i);
        if (!m) return fail(`Ask whom about what? Try "ask Mira about the negotiations".`);
        const whoPhrase = stripArticles(m[1]!.toLowerCase()).trim();
        const topicPhrase = m[2]!.trim();
        const target = resolveEntity(whoPhrase, perception, 'room');
        if (!target) return fail(`There's no one called "${m[1]!.trim()}" here.`);
        return ok({
          kind: 'converse', mode: 'ask',
          target: target.id, topicPhrase,
        });
      }
      case 'tell': {
        // "tell X about Y" — same shape as ask, but mode 'tell'. Without
        // an "about" we can't disambiguate from "say <stuff> to X", so
        // require the preposition.
        const orig = input.trim();
        const m = orig.match(/^tell\s+(.+?)\s+about\s+(.+)$/i);
        if (!m) return fail(`Tell whom about what? Try "tell Mira about the datapad".`);
        const whoPhrase = stripArticles(m[1]!.toLowerCase()).trim();
        const topicPhrase = m[2]!.trim();
        const target = resolveEntity(whoPhrase, perception, 'room');
        if (!target) return fail(`There's no one called "${m[1]!.trim()}" here.`);
        return ok({
          kind: 'converse', mode: 'tell',
          target: target.id, topicPhrase,
        });
      }
      case 'say': {
        // Forms (in priority order):
        //   say "<utterance>" to X        → quoted, explicit recipient
        //   say <utterance> to X          → unquoted, last "to" as splitter
        //   say "<utterance>"             → quoted; needs a single visible NPC
        //   say <utterance>               → bare; needs a single visible NPC
        // Original input is used so the utterance retains case + articles.
        const orig = input.trim();
        const afterVerb = orig.replace(/^say\s+/i, '');

        const tryRecipient = (phrase: string) => {
          const cleanedPhrase = stripArticles(phrase.toLowerCase()).trim();
          return resolveEntity(cleanedPhrase, perception, 'room');
        };

        const quotedTo = afterVerb.match(/^["“'](.+?)["”']\s+to\s+(.+)$/);
        if (quotedTo) {
          const target = tryRecipient(quotedTo[2]!);
          if (!target) return fail(`There's no one called "${quotedTo[2]!.trim()}" here.`);
          return ok({ kind: 'converse', mode: 'say', target: target.id, utterance: quotedTo[1]!.trim() });
        }
        // Greedy left so "say hi to Mira" splits cleanly; for utterances
        // containing "to" the player should use the quoted form.
        const unquotedTo = afterVerb.match(/^(.+)\s+to\s+(\S+(?:\s+\S+)?)$/);
        if (unquotedTo) {
          const target = tryRecipient(unquotedTo[2]!);
          if (target) {
            return ok({ kind: 'converse', mode: 'say', target: target.id, utterance: unquotedTo[1]!.trim() });
          }
          // fall through to bare-utterance handling
        }
        const justQuoted = afterVerb.match(/^["“'](.+?)["”']\s*$/);
        const utterance = (justQuoted ? justQuoted[1]! : afterVerb).trim();
        if (!utterance) return fail(`Say what?`);
        // Bare utterance — auto-route only if exactly one NPC is in the room.
        const npcs = perception.room.visibleEntities;
        if (npcs.length !== 1) {
          return fail(`Say it to whom? Try "say <utterance> to <person>".`);
        }
        return ok({ kind: 'converse', mode: 'say', target: npcs[0]!.id, utterance });
      }
      default:
        return fail(`I don't understand "${input}". Try: look, go <dir>, take <thing>, examine <thing>, talk to <person>, ask <person> about <topic>, inventory, time, wait.`);
    }
  }
}

/**
 * Split a player line into clauses on common conjunctions.
 *
 * Recognised separators (case-insensitive, in priority order so longer
 * forms match first): `and then`, `then`, `;`, `,`, `and`. Whitespace
 * around the separator is consumed.
 *
 * Caveats: word-based separators may bite if a clause legitimately
 * contains those words ("turn and burn"). For v1 this is acceptable —
 * the engine validates each parsed clause and reports the offending one.
 */
function splitClauses(input: string): string[] {
  return input
    .split(/\s+and\s+then\s+|\s+then\s+|\s*;\s*|\s*,\s*|\s+and\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function stripArticles(s: string): string {
  return s.replace(/\b(the|a|an|some)\b/g, '').replace(/\s+/g, ' ').trim();
}

function ok(action: Action): SingleParseResult { return { ok: true, action }; }
function fail(reason: string): SingleParseResult { return { ok: false, reason }; }

type SingleParseResult =
  | { ok: true;  action: Action }
  | { ok: false; reason: string };

type Scope = 'room' | 'inventory' | 'any';

function resolveEntity(
  phrase: string,
  perception: Perception,
  scope: Scope,
): PerceivedEntity | undefined {
  if (!phrase) return undefined;
  const candidates: PerceivedEntity[] = [];
  if (scope !== 'inventory') candidates.push(...perception.room.visibleEntities);
  if (scope !== 'room')      candidates.push(...perception.inventory);

  const exact = candidates.find(e =>
    e.name === phrase || e.aliases.includes(phrase));
  if (exact) return exact;

  const sub = candidates.find(e =>
    e.name.includes(phrase) ||
    phrase.includes(e.name) ||
    e.aliases.some(a => a.includes(phrase) || phrase.includes(a)));
  return sub;
}

/**
 * Match a phrase against the destination names of the current room's exits.
 * Returns the destination room id if found.
 *
 * Matching is case-insensitive substring on either side, so "lounge" hits
 * "neutral lounge" and "go to the observation balcony" works after the
 * caller has stripped articles.
 */
function resolveDestination(
  phrase: string,
  perception: Perception,
): EntityId | undefined {
  if (!phrase) return undefined;
  for (const exit of perception.room.exits) {
    const name = exit.destinationName?.toLowerCase();
    if (!name) continue;
    if (name === phrase || name.includes(phrase) || phrase.includes(name)) {
      return exit.destinationId;
    }
  }
  return undefined;
}

// silence unused import warnings under verbatimModuleSyntax: false
export type { EntityId };
