import { roomOf, moveInto } from '../../world.js';
import {
  setNpcMood, adjustNpcTrust, pushDialogueMemory, learnTopic,
} from '../../npc.js';
import { defineRule } from '../types.js';

/**
 * Conversation rules.
 *
 * The split between `converse` and `respondAsNpc` keeps the LLM strictly
 * out of the engine: `converse` is what the player commands; the engine
 * verifies access and emits an `addressed` event. The agent layer reads
 * that event, calls the LLM, and dispatches `respondAsNpc` back through
 * the engine so all state changes flow through the rulebook (and can be
 * intercepted by content-author rules at higher specificity).
 *
 * See ARCHITECTURE.md → "Conversation & NPC agents" for the full pipeline.
 */

export const converseCheck = defineRule({
  name: 'converse:check',
  on: 'converse', phase: 'check',
  run: (w, a, ctx) => {
    if (!w.has(a.target, 'name')) return ctx.fail('unknown_target', a.target);
    const player = w.player();
    if (a.target === player) return ctx.fail('not_listening', a.target);
    if (roomOf(w, a.target) !== roomOf(w, player)) {
      return ctx.fail('not_here', a.target);
    }
    if (!w.has(a.target, 'npc')) {
      return ctx.fail('not_listening', a.target);
    }
    return 'continue';
  },
});

export const converseCarryOut = defineRule({
  name: 'converse:carry-out',
  on: 'converse', phase: 'carryOut',
  run: (w, a, ctx) => {
    const speaker = w.player();
    // Build the event with only the fields relevant to the mode so the
    // narrator and agent layer don't have to handle stray undefineds.
    //
    // First-encounter escalation: if the player greets a proactive NPC
    // for the first time (empty dialogueMemory), promote the interaction
    // to a `noticed` event — the same shape the after-move rule uses
    // for room-entry greetings. The CLI turns `noticed` into an
    // `approached` exchange, which is what surfaces mission briefings.
    // Without this promotion the player who enters the room and *then*
    // types `talk to Mira` would get a bare "Yes?" acknowledgement,
    // because the greet-mode agent contract is explicitly "acknowledge,
    // do not volunteer".
    if (a.mode === 'greet') {
      const shouldEscalate =
        w.get(a.target, 'proactive')?.greetOnEntry === true &&
        (w.get(a.target, 'dialogueMemory')?.entries.length ?? 0) === 0;
      if (shouldEscalate) {
        ctx.emit({
          kind: 'noticed', observer: a.target, target: speaker,
          trigger: 'enteredRoom',
        });
      } else {
        ctx.emit({ kind: 'addressed', speaker, target: a.target, mode: 'greet' });
      }
    } else if (a.mode === 'say') {
      ctx.emit({
        kind: 'addressed', speaker, target: a.target, mode: 'say',
        utterance: a.utterance,
      });
    } else {
      // ask / tell
      ctx.emit({
        kind: 'addressed', speaker, target: a.target, mode: a.mode,
        topicPhrase: a.topicPhrase,
      });
    }
    return 'continue';
  },
});

/**
 * `respondAsNpc` — the agent's reply, funnelled through the rulebook so
 * mood/trust/memory updates emit a uniform `npcSpoke` event and are
 * subject to engine-side clamping.
 *
 * The check rule rejects malformed payloads (missing speech, non-NPC
 * speaker). It does NOT validate the agent's *content* — that's the
 * agent's responsibility — only invariants the engine cares about.
 */
export const respondAsNpcCheck = defineRule({
  name: 'respondAsNpc:check',
  on: 'respondAsNpc', phase: 'check',
  run: (w, a, ctx) => {
    if (!w.has(a.speaker, 'npc')) return ctx.fail('not_listening', a.speaker);
    if (!w.has(a.audience, 'name')) return ctx.fail('unknown_target', a.audience);
    if (typeof a.payload.speech !== 'string' || a.payload.speech.trim() === '') {
      return ctx.fail('refused', a.speaker);
    }
    return 'continue';
  },
});

export const respondAsNpcCarryOut = defineRule({
  name: 'respondAsNpc:carry-out',
  on: 'respondAsNpc', phase: 'carryOut',
  run: (w, a, ctx) => {
    const { speaker, audience, payload } = a;

    // Memory: log what the NPC said and what the audience heard so the
    // agent has both sides of the exchange next time.
    pushDialogueMemory(w, speaker, {
      kind: 'said', speakerId: speaker, counterpartId: audience,
      text: payload.speech,
    });

    if (payload.npcMood) setNpcMood(w, speaker, payload.npcMood);

    let trustAfter: number | undefined;
    if (typeof payload.trustDelta === 'number' && payload.trustDelta !== 0) {
      trustAfter = adjustNpcTrust(w, speaker, payload.trustDelta);
    }

    // Reveal topics: copy each named fact from the speaker's knows.facts
    // into the audience's. Unknown topics are silently skipped so a
    // hallucinating model can't poison the audience's knowledge.
    //
    // Hard-gating: each topic the agent wants to reveal is run through
    // the speaker's `topicGates` if any. Gates returning false drop the
    // reveal silently (recorded on the event as `blockedTopics` for
    // debug). This is the engine-side backstop against the LLM leaking
    // climactic facts; the agent prompt's tone-shaping remains the
    // first line of defence.
    const revealed: string[] = [];
    const blocked: string[] = [];
    if (payload.revealedTopicsToPlayer?.length) {
      const speakerKnows = w.get(speaker, 'knows');
      const gates = w.get(speaker, 'topicGates')?.gates;
      const silica = w.get(speaker, 'silicaProtocol');
      // Silica binary-search filtering (drops reveals defensively before
      // they reach learnTopic). The topicGates below still run too — see
      // the docstring on `silicaProtocol`.
      const silicaAllowed = pickSilicaAllowedReveals(
        silica,
        payload.revealedTopicsToPlayer,
        a.inResponseTo,
      );
      for (const topicId of payload.revealedTopicsToPlayer) {
        if (silica && !silicaAllowed.has(topicId)) {
          blocked.push(topicId);
          continue;
        }
        const fact = speakerKnows?.facts[topicId];
        if (!fact) continue;
        const gate = gates?.[topicId];
        if (gate && !gate(w, audience)) {
          blocked.push(topicId);
          continue;
        }
        learnTopic(w, audience, topicId, fact);
        revealed.push(topicId);
      }
    }

    // The NPC may also learn new topics (rare; e.g. the player teaches them).
    if (payload.npcLearnedTopics) {
      for (const [topicId, fact] of Object.entries(payload.npcLearnedTopics)) {
        learnTopic(w, speaker, topicId, fact);
      }
    }

    const npc = w.get(speaker, 'npc');
    ctx.emit({
      kind: 'npcSpoke',
      speaker, audience,
      speech: payload.speech,
      ...(npc?.mood ? { moodAfter: npc.mood } : {}),
      ...(trustAfter !== undefined ? { trustAfter } : {}),
      ...(revealed.length ? { revealedTopicsToPlayer: revealed } : {}),
      ...(blocked.length  ? { blockedTopics: blocked } : {}),
    });
    return 'continue';
  },
});

/**
 * Compute which of a payload's `revealedTopicsToPlayer` entries are
 * permitted to leak from a silica-protocol speaker on this turn. Returns
 * an empty set if the speaker has no silicaProtocol component (caller
 * then short-circuits and ignores the silica filter).
 *
 * Rules, in order:
 *   1. If !readyToSpeak: nothing leaks.
 *   2. If inResponseTo !== 'tell': nothing leaks (binary-search is a
 *      tell-only mechanic — ask/greet/say all produce chime-only replies).
 *   3. Restrict to `claimTopicIds` (the engine-side allowlist of
 *      eligible binary-search claims).
 *   4. Cap at one previously-unrevealed claim per turn — already-revealed
 *      claims are de-duped silently. This prevents a verbose model from
 *      collapsing the puzzle in one exchange.
 */
function pickSilicaAllowedReveals(
  silica: import('../../components.js').ComponentMap['silicaProtocol'] | undefined,
  requested: string[],
  mode: string | undefined,
): Set<string> {
  if (!silica) return new Set();
  if (!silica.readyToSpeak) return new Set();
  if (mode !== 'tell') return new Set();
  const eligible = new Set(silica.claimTopicIds);
  const already = new Set(silica.revealedClaims);
  const out = new Set<string>();
  for (const t of requested) {
    if (!eligible.has(t)) continue;
    if (already.has(t)) continue;
    out.add(t);
    if (out.size >= 1) break;
  }
  return out;
}

/**
 * Silica reward: when a binary-search NPC's distinct-revealed claim
 * count reaches `rewardThreshold`, transfer the chime-fragment item
 * (if registered) to the audience and flip `rewarded`. The reward
 * fires at most once. Runs in the `after` phase so the carry-out's
 * reveal mutations are visible.
 */
export const respondAsNpcSilicaReward = defineRule({
  name: 'respondAsNpc:silica-reward',
  on: 'respondAsNpc', phase: 'after',
  specificity: 1,
  when: (w, a) => !!w.get(a.speaker, 'silicaProtocol'),
  run: (w, a, ctx) => {
    const proto = w.get(a.speaker, 'silicaProtocol')!;
    if (proto.rewarded) return 'continue';

    // Recompute revealed-claims from the audience's current knowledge.
    // The carry-out has already copied learned facts into knows.facts,
    // so intersecting with claimTopicIds gives the current progress.
    const audienceFacts = w.get(a.audience, 'knows')?.facts ?? {};
    const distinctRevealed = proto.claimTopicIds.filter(id => audienceFacts[id]);

    if (distinctRevealed.length !== proto.revealedClaims.length) {
      w.add(a.speaker, 'silicaProtocol', { ...proto, revealedClaims: distinctRevealed });
    }

    if (distinctRevealed.length < proto.rewardThreshold) return 'continue';
    if (proto.chimeFragmentId === undefined) return 'continue';

    moveInto(w, proto.chimeFragmentId, a.audience);
    w.add(a.speaker, 'silicaProtocol', {
      ...proto, revealedClaims: distinctRevealed, rewarded: true,
    });
    ctx.emit({
      kind: 'silicaGifted',
      donor: a.speaker, recipient: a.audience, item: proto.chimeFragmentId,
    });
    return 'continue';
  },
});
