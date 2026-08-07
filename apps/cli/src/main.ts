import * as readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { apply, applyAll, perceive, type Action, type ChainOutcome, type Event, type World } from '@ifai/engine';
import {
  FallbackParser, FallbackNarrator,
  LLMParser, LLMNarrator,
  parserModel, narratorModel, npcModel, describeModel,
  usageSummary, isUsageEnabled,
  type Parser, type Narrator,
} from '@ifai/narrator';
import {
  FallbackDialogueAgent, LLMDialogueAgent, buildNpcContext,
  type DialogueAgent,
} from '@ifai/agents';
import { buildThrenody, detectEasterEgg, hintFor } from '@ifai/content';
import { createWrappingWriter, detectWidth } from './wrap.ts';

/**
 * REPL harness. Two modes, env-driven:
 *
 *   IFAI_LLM=0 (default)  — deterministic parser + narrator. No keys, no
 *                           network. Fast feedback loop for engine work.
 *   IFAI_LLM=1            — LLMParser + LLMNarrator. Per-role provider via
 *                           IFAI_<ROLE>_PROVIDER / IFAI_<ROLE>_MODEL.
 *                           Both gracefully degrade to fallback on error.
 *
 * The narrator streams its output to the terminal token-by-token.
 */
async function main() {
  const llmEnabled = process.env.IFAI_LLM === '1';
  const world  = buildThrenody();

  // Single wrapping sink for all narrated/parser/system output. The
  // readline prompt ("> ") goes straight to stdout to avoid being buffered
  // by the wrapper waiting for whitespace.
  const wrap = createWrappingWriter(detectWidth(), s => stdout.write(s));
  const say  = (s: string) => wrap.write(s);

  let parser:   Parser;
  let narrator: Narrator;
  let agent:    DialogueAgent;

  if (llmEnabled) {
    try {
      const p = parserModel();
      const n = narratorModel();
      const a = npcModel();
      say(
        `[ifai] LLM mode:\n` +
        `         parser   = ${describeModel(p)}\n` +
        `         narrator = ${describeModel(n)}\n` +
        `         npc      = ${describeModel(a)}\n\n`,
      );
    } catch (err) {
      say(`[ifai] LLM configuration error: ${(err as Error).message}\n`);
      say('[ifai] Falling back to deterministic parser/narrator.\n\n');
    }
    parser = new LLMParser();
    narrator = new LLMNarrator(chunk => say(chunk));
    agent = new LLMDialogueAgent();
  } else {
    parser = new FallbackParser();
    narrator = new FallbackNarrator();
    agent = new FallbackDialogueAgent();
  }

  // Opening look. The LLM narrator streams; the fallback returns the full
  // string. We always print the returned string after the stream completes
  // for the LLM case, so we suppress the duplicate by checking instance.
  await renderTurn(world, parser, narrator, agent, llmEnabled, { kind: 'opening' }, say);

  const rl = await createRepl();
  const isTTY = stdin.isTTY === true;
  rl.prompt();

  for await (const rawLine of rl) {
    const trimmed = rawLine.trim();
    if (trimmed === 'quit' || trimmed === 'q') break;
    if (!trimmed) {
      rl.prompt();
      continue;
    }
    // `usage` / `tokens` — meta command. Prints the cumulative LLM
    // usage table and does not spend a turn. Available regardless of
    // whether LLM mode is enabled (harmlessly reports "no calls").
    if (trimmed === 'usage' || trimmed === 'tokens') {
      say(usageSummary() + '\n');
      rl.prompt();
      continue;
    }
    // `help` / `?` — meta command. Prints the verb list; does not
    // spend a turn. Kept deliberately short so a new player can absorb
    // the whole thing at a glance. Meta commands (help, usage, quit,
    // time) go last so they don't compete with story verbs visually.
    if (trimmed === 'help' || trimmed === '?') {
      say(helpText() + '\n');
      rl.prompt();
      continue;
    }
    // `hint` — meta command. Prints a state-aware, in-fiction nudge
    // toward the next useful action. Does not spend a turn (advances
    // no clock time) so a player can safely consult it whenever.
    if (trimmed === 'hint') {
      say(hintFor(world) + '\n');
      rl.prompt();
      continue;
    }
    await renderTurn(world, parser, narrator, agent, llmEnabled, { kind: 'input', input: trimmed }, say);
    if (isGameOver(world)) break;
    rl.prompt();
  }

  wrap.flush();
  rl.close();
  if (isTTY) await saveHistory((rl as unknown as { history: string[] }).history);
  // Final report — only when the user asked for it via IFAI_USAGE.
  // Routed to stderr so it never gets mixed into piped game output.
  if (isUsageEnabled()) {
    process.stderr.write('\n' + usageSummary() + '\n');
  }
}

/**
 * Path used to persist command history across sessions. Overridable via
 * `IFAI_HISTORY_FILE` (set to empty to disable).
 */
function historyFile(): string | undefined {
  if (process.env.IFAI_HISTORY_FILE === '') return undefined;
  return process.env.IFAI_HISTORY_FILE ?? path.join(os.homedir(), '.ifai_history');
}

async function loadHistory(): Promise<string[]> {
  const file = historyFile();
  if (!file) return [];
  try {
    const data = await fs.readFile(file, 'utf8');
    // readline's `history` is newest-first; the file is newest-last so
    // tail/less behaves normally, so we reverse on load.
    return data.split('\n').filter(l => l.length > 0).reverse().slice(0, 500);
  } catch {
    return [];
  }
}

async function saveHistory(history: string[]): Promise<void> {
  const file = historyFile();
  if (!file) return;
  try {
    // readline.history is newest-first; persist newest-last.
    const lines = [...history].reverse().slice(-500);
    await fs.writeFile(file, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  } catch {
    // History persistence is best-effort; never fail the game over it.
  }
}

/**
 * Build the readline interface. On a TTY we enable `terminal: true` so the
 * user gets line editing (left/right arrows, Ctrl-A/E, backspace mid-line)
 * and command history (up/down arrows). History is loaded from and saved
 * to `~/.ifai_history`. When stdin is piped (tests, scripted runs), we
 * use `terminal: false` so the loop reads piped lines without TTY escapes.
 */
async function createRepl(): Promise<readline.Interface> {
  const isTTY = stdin.isTTY === true;
  const history = isTTY ? await loadHistory() : [];
  return readline.createInterface({
    input: stdin,
    output: stdout,
    terminal: isTTY,
    prompt: isTTY ? '> ' : '',
    history,
    historySize: 500,
    removeHistoryDuplicates: true,
  });
}

type Step =
  | { kind: 'opening' }
  | { kind: 'input'; input: string };

async function renderTurn(
  world: ReturnType<typeof buildThrenody>,
  parser: Parser,
  narrator: Narrator,
  agent: DialogueAgent,
  streaming: boolean,
  step: Step,
  say: (s: string) => void,
): Promise<void> {
  if (step.kind === 'opening') {
    const result = apply(world, { kind: 'look' });
    const text = await narrator.narrate(result.events, world, perceive(world));
    if (!streaming) say(text);
    say('\n\n');
    return;
  }

  const perception = perceive(world);
  const parsed = await parser.parse(step.input, perception);
  if (!parsed.ok) {
    say(parsed.reason + '\n\n');
    return;
  }

  const { outcomes } = await applyAll(world, parsed.actions, {
    afterEach: (w, outcome) => runDialogueForOutcome(w, outcome, agent),
  });
  const multi = outcomes.length > 1;

  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i]!;

    // Header for chained turns so the player can attribute prose to a step.
    if (multi) say(`▸ ${summarizeAction(o.action, world)}\n`);

    if (o.status === 'skipped') {
      say('  [did not happen — earlier step failed]\n\n');
      continue;
    }

    // Perceive *after* this action so the narrator sees the world it produced
    // (e.g. the new room after a move).
    const text = await narrator.narrate(o.events, world, perceive(world));
    if (!streaming) say(text);
    say('\n\n');
  }
}

/**
 * Brief one-liner describing an action, used as a header in chained turns.
 * Lookup is best-effort: when an entity is missing (e.g. dropped, given
 * away, or in another room) we fall back to its id.
 */
function summarizeAction(action: Action, world: World): string {
  const nameOf = (id: number): string => {
    const n = world.get(id, 'name');
    return n ? n.value : `#${id}`;
  };
  switch (action.kind) {
    case 'look':      return 'look';
    case 'inventory': return 'inventory';
    case 'wait':      return 'wait';
    case 'time':      return 'time';
    case 'attendSession': return 'attend the session';
    case 'move':      return `go ${action.dir}`;
    case 'goto':      return `go to ${nameOf(action.target)}`;
    case 'take':      return `take ${nameOf(action.target)}`;
    case 'drop':      return `drop ${nameOf(action.target)}`;
    case 'examine':   return `examine ${nameOf(action.target)}`;
    case 'give':      return `give ${nameOf(action.target)} to ${nameOf(action.to)}`;
    case 'present':   return `present ${nameOf(action.target)} to ${nameOf(action.to)}`;
    case 'converse':  {
      const who = nameOf(action.target);
      switch (action.mode) {
        case 'greet': return `greet ${who}`;
        case 'say':   return `say to ${who}`;
        case 'ask':   return `ask ${who} about ${action.topicPhrase}`;
        case 'tell':  return `tell ${who} about ${action.topicPhrase}`;
      }
    }
    // The agent step injects respondAsNpc actions; they are never visible
    // to the player as a chain step (their events render inline). But for
    // exhaustiveness we give them a label.
    case 'respondAsNpc': return `${nameOf(action.speaker)} replies`;
  }
}

/**
 * Per-action hook: if the just-applied action emitted an `addressed`
 * event, build the NPC's context, ask the agent for a response, then
 * dispatch a synthetic `respondAsNpc` action through the engine so the
 * mood/trust/memory updates flow through the rulebook.
 *
 * Returns the events produced by the response, which `applyAll` appends
 * to the original outcome so the narrator renders both as one beat.
 */
async function runDialogueForOutcome(
  world: World,
  outcome: ChainOutcome,
  agent: DialogueAgent,
): Promise<Event[]> {
  const extra: Event[] = [];
  for (const ev of outcome.events) {
    if (ev.kind === 'addressed') {
      const ctx = buildNpcContext(world, ev.target);
      if (!ctx) continue;
      // Easter-egg short-circuit. If the player's ask/tell topic or
      // free-form `say` utterance contains an Earth pop-culture
      // reference (Star Wars, Star Trek, Dune, …), reroute the agent
      // call to easter-egg mode and tag the engine event for audit.
      // The parser still resolved the action normally; we just swap
      // out the agent's intent so it produces an in-character
      // deflection instead of pretending Threnody knows lightsabers.
      const probe =
        ev.mode === 'ask' || ev.mode === 'tell' ? (ev.topicPhrase ?? '')
        : ev.mode === 'say' ? (ev.utterance ?? '')
        : '';
      const egg = probe ? detectEasterEgg(probe) : undefined;
      const exchange = egg
        ? { mode: 'easter-egg' as const, easterEggId: egg.id, easterEggHint: egg.hint }
        : { mode: ev.mode, utterance: ev.utterance, topicPhrase: ev.topicPhrase };
      const response = await agent.respond(world, ctx, exchange);
      const followUp = apply(world, {
        kind: 'respondAsNpc',
        speaker: ev.target,
        audience: ev.speaker,
        payload: response,
        inResponseTo: egg ? `easter-egg:${egg.id}` : ev.mode,
      });
      extra.push(...followUp.events);
    } else if (ev.kind === 'noticed') {
      // Proactive NPC initiates: build their context and ask the agent
      // for an unprompted opening line. Same downstream wiring as
      // `addressed` so mood/trust/memory updates flow through the
      // rulebook the same way.
      const ctx = buildNpcContext(world, ev.observer);
      if (!ctx) continue;
      const response = await agent.respond(world, ctx, { mode: 'approached' });
      const followUp = apply(world, {
        kind: 'respondAsNpc',
        speaker: ev.observer,
        audience: ev.target,
        payload: response,
        inResponseTo: 'approached',
      });
      extra.push(...followUp.events);
    }
  }
  return extra;
}

/**
 * Returns true once the climax has resolved — the CLI breaks the prompt
 * loop on the next iteration so the ending prose is the last thing the
 * player sees. We check the persistent `endingState` singleton rather
 * than scanning events so the test survives chained turns and replays.
 */
function isGameOver(world: World): boolean {
  for (const [, s] of world.entries('endingState')) {
    if (s.resolved !== undefined) return true;
  }
  return false;
}

/**
 * Short verb list shown on `help` / `?`. Grouped by the shape of the
 * command so a new player can scan and try one. Story verbs first,
 * meta commands second, so a new player finds their way through the
 * fiction before the tooling.
 */
function helpText(): string {
  return [
    'You are a junior aide, quietly seconded. The world reads plain English.',
    '',
    'Movement:   look, go <direction>, <direction>  (e.g. "spinward", "up")',
    'Objects:    examine <thing>, take <thing>, drop <thing>, inventory',
    'People:     talk to <person>, ask <person> about <topic>,',
    '            tell <person> about <topic>, give <thing> to <person>',
    'Climax:     present <thing> at <place>  (once you know where)',
    'Waiting:    wait  (advances time), time  (shows the clock)',
    '',
    'Meta:       help, hint, usage / tokens, quit / q',
    '',
    "Tip: verbs can be chained with 'and then' or a comma.",
  ].join('\n');
}


main().catch(err => {
  console.error(err);
  process.exit(1);
});
