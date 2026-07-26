import { World, moveInto } from '@ifai/engine';

/**
 * Seed content for Waystation Threnody — a multi-species diplomatic station
 * during a 72-hour ceasefire negotiation. This is a tiny vertical-slice
 * world: 4 rooms, 2 NPCs, a few items. Enough to exercise the engine and
 * the narrator end-to-end.
 *
 * Authoring style:
 *  - Room descriptions are short, sensory, and *static*. State-dependent
 *    flavour (time of day, who's present) is woven in by the narrator from
 *    perception, not duplicated here.
 *  - NPCs carry a `persona` string that will become a system prompt once the
 *    LLM agent layer lands. For now, NPCs are passive entities you can
 *    `examine`.
 *  - Every room is `ambientLit` for now; darkness becomes interesting later
 *    (e.g. a power cut subplot).
 */
export function buildThrenody(): World {
  const w = new World();

  /* -------------------------------- Rooms -------------------------------- */

  const quarters = w.newEntity({
    room: {}, name: { value: 'aide quarters' },
    description: { text:
      'A narrow cabin with a fold-down bunk, a credentials terminal, and a slit ' +
      'window onto the docking spar.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });

  const corridor = w.newEntity({
    room: {}, name: { value: 'corridor' },
    description: { text:
      'A curving corridor banded in the soft blue of the human delegation\'s ' +
      'wing. The ring\'s spin sets a faint Coriolis tilt under your steps. ' +
      'Aides hurry past in muted colours, and the atmosphere has the metallic ' +
      'tang of a freshly-cycled scrubber.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });

  const lounge = w.newEntity({
    room: {}, name: { value: 'neutral lounge', aliases: ['lounge'] },
    description: { text:
      'A circular lounge under a slow-rotating skylight that frames a slice of ' +
      'starfield. The air is layered: human-standard at the centre, methane-rich ' +
      'at the Vorthi seats by the rim wall, and a chilled silica column by the ' +
      'singing crystal envoy. A station AI terminal hums at the bar.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });

  const balcony = w.newEntity({
    room: {}, name: { value: 'observation balcony', aliases: ['balcony'] },
    description: { text:
      'A glass-walled crescent on the deck above, looking down into the ' +
      'negotiation chamber. From here you can watch the delegations arrive ' +
      'without being seen.' },
    container: { contents: [] },
    ambientLit: { lit: true },
  });

  // The memorial wall is a contemplative stub off the corridor — a place
  // the station built for itself rather than for the delegations. It is the
  // room the climactic `present` action will resolve in (step 5).
  const memorial = w.newEntity({
    room: {}, name: { value: 'memorial wall', aliases: ['memorial', 'wall', 'names'] },
    description: { text:
      'A long curved passage where the corridor opens outward into a slow ' +
      'darkness. Names cover both walls from floor to ceiling — etched in ' +
      'Standard, Hearth, War-Crest, and the faceted spirals the silica use ' +
      'for their own — each faintly lit from behind so that the script ' +
      'seems to float a finger\'s width off the metal. The Threnody station ' +
      'AI keeps a quiet presence here; you can sense the same hum that ' +
      'lives in the lounge terminal threading through the wall.' },
    container: { contents: [] },
    ambientLit: { lit: true },
    tags: { values: ['memorial', 'sacred'] },
    // Marks this room as the climax receptacle for `present`. The
    // ending-ledger rule appends presented items to `endingState`.
    memorialWall: {},
  });

  // The methane chamber is the off-record room: warm, orange-lit, breath-
  // sealed, and (per the spec) outside Threnody's perception. Step 2 only
  // places the room; the mask gate (step 3 items) and surveillance flag
  // (step 6) come later. For now the description hints at both so authoring
  // and play-tester intuition match what the gating will eventually enforce.
  const methane = w.newEntity({
    room: {}, name: { value: 'methane chamber', aliases: ['chamber', 'methane', 'methane room'] },
    description: { text:
      'A glassed enclosure off the lounge, sealed behind a double set of ' +
      'breath-mask locks. Inside, the air glows the warm orange of methane ' +
      'under low light, and the deck plating is laid in the wide hexagonal ' +
      'pattern the Vorthi prefer underfoot. There are no terminals on the ' +
      'walls and no camera nubs in the ceiling — by treaty, nothing the ' +
      'station hears in here is recorded. The Hearth call it a hearth-room; ' +
      'the War-Crest call it a courtesy. Either way, it is the one place ' +
      'on Threnody where Threnody is not listening.' },
    container: { contents: [] },
    ambientLit: { lit: true },
    tags: { values: ['vorthi', 'surveillance-defying'] },
  });

  // Layout — the corridor is the hub of this slice. The lounge is one
  // segment spinward of the player's cabin door; the balcony is one deck up.
  // The memorial wall is a contemplative stub outward of the corridor, and
  // the methane chamber is reached inward off the lounge.
  w.add(quarters, 'exits', { to: { out: corridor } });
  w.add(corridor, 'exits', { to: { in: quarters, spinward: lounge, up: balcony, outward: memorial } });
  w.add(lounge,   'exits', { to: { antispinward: corridor, inward: methane } });
  w.add(balcony,  'exits', { to: { down: corridor } });
  w.add(memorial, 'exits', { to: { inward: corridor } });
  w.add(methane,  'exits', { to: { outward: lounge } });

  /* -------------------------------- Items -------------------------------- */

  const credentials = w.newEntity({
    name: { value: 'credentials badge', aliases: ['badge', 'credentials'] },
    description: { text:
      'A laminated card identifying you as Junior Aide, Human Delegation. ' +
      'Clearance level: embarrassingly low.' },
    portable: {},
    tags: { values: ['credential', 'human-delegation'] },
  });
  moveInto(w, credentials, quarters);

  const datapad = w.newEntity({
    name: { value: 'datapad' },
    description: { text:
      'Standard-issue. Currently displays the delegation seating chart and a ' +
      'flagged note: "Speak to Mira before the opening session."' },
    portable: {},
    tags: { values: ['mundane', 'human-delegation'] },
  });
  moveInto(w, datapad, quarters);

  const teacup = w.newEntity({
    name: { value: 'cup of tea', aliases: ['tea', 'cup'] },
    description: { text: 'It is, against all reasonable odds, exactly the right temperature.' },
    portable: {},
    tags: { values: ['mundane', 'human-delegation'] },
  });
  moveInto(w, teacup, lounge);

  /* --------------------------------- NPCs -------------------------------- */

  // Mira's known topics. Keys are stable ids (used by the dialogue agent
  // when an `ask`/`tell` resolves the player's topic phrase). Aliases are
  // natural-language phrases the player might use; matching happens in
  // the agent layer (the parser preserves the player's wording verbatim).
  // Fact text is what Mira *would* say if it served her — the agent may
  // paraphrase, withhold, or deflect depending on mood/trust.
  const miraFacts: Record<string, { text: string; aliases?: string[] }> = {
    'negotiations': {
      text:
        "Day one of three. The official agenda is procedural — seating, " +
        "translation protocols, the order of opening statements. The " +
        "real work begins tonight in side rooms and won't be on any " +
        "transcript.",
      aliases: [
        'the talks', 'the negotiations', 'the ceasefire', 'the conference',
        'the agenda',
      ],
    },
    'opening-session': {
      text:
        "Three hours from now the chamber doors open and the delegations " +
        "file in. It's pure theatre — opening statements, the order of " +
        "speakers, who acknowledges whom. Nothing is decided in that room. " +
        "But who sits where, and who looks at whom while Iren's name is " +
        "read, tells me everything about where the night session will go.",
      aliases: [
        'the opening session', 'opening session', 'the session',
        'the opening', 'the opening statements', 'the chamber',
        'the first session',
      ],
    },
    'vorthi-delegation': {
      text:
        "The Vorthi arrived split. Khaleth speaks for the Hearth faction " +
        "and is your best hope of a real signature. Tasen is War-Crest — " +
        "younger, louder, and convinced our side killed Iren on purpose. " +
        "Whatever we sign, one of them will leave unhappy.",
      aliases: ['the vorthi', 'vorthi', 'the methane delegation', 'khaleth and tasen'],
    },
    'silica-envoy': {
      text:
        "Don't try small talk with the silica envoy — Saen-of-Three-Notes. " +
        "Their chime-language is precise to the millisecond and your " +
        "translator's a half-step behind. If they tilt toward you, just " +
        "incline your head. They were on the border the day Iren died.",
      aliases: ['saen', 'the silica', 'the crystal envoy', 'the singing crystal'],
    },
    'the-datapad': {
      text:
        "Yes — the seating chart. Read the flagged note before you go " +
        "anywhere else. There's a name on it I want you to watch for: " +
        "Iren Vass.",
      aliases: ['the datapad', 'the pad', 'the briefing', 'the seating chart'],
    },
    'your-role': {
      text:
        "Junior aide, ostensibly. In practice you're a pair of ears no " +
        "one's logged. Stand in the right corners, hear what isn't being " +
        "said into a transcript, and tell me before the night session.",
      aliases: ['my role', 'my job', 'me', 'what i should do', 'my orders'],
    },
    'aslin-keer': {
      text:
        "Aslin Keer. He's listed as a translator for the Reach observers. " +
        "He isn't. If he speaks to you, listen carefully and don't " +
        "promise anything.",
      aliases: ['aslin', 'keer', 'aslin keer', 'the translator'],
    },
    'aslin-keer-truth': {
      text:
        "Reach intelligence. Aslin runs assets on both sides of the " +
        "border. If he's here for the talks he's here because someone " +
        "made him useful — and that someone is probably us. Don't " +
        "make a second deal with him.",
      aliases: ['aslin truth', 'who aslin really is', 'reach intelligence'],
    },
    'iren-vass': {
      text:
        "Iren Vass. Medic, ours, attached to a Vorthi field clinic on " +
        "the border twelve days ago. Officially: accidental crossfire. " +
        "That is the sentence we agreed to and the sentence I no longer " +
        "believe. The talks turn on what gets said about her — by us, " +
        "by Khaleth, by Tasen. Be careful who you bring her name up " +
        "with, and where.",
      aliases: ['iren', 'vass', 'the medic', 'the dead', 'the casualty'],
    },
    'yesterday': {
      text:
        "I had a long conversation with someone who shouldn't have been " +
        "on the station. That's all I'll say in here.",
      aliases: ['yesterday', 'last night', 'before this'],
    },
    'mira-herself': {
      text:
        "Twenty-seven years in service. Three ceasefires, two of them " +
        "held. I prefer rooms with one exit and people who know which " +
        "one it is.",
      aliases: ['yourself', 'you', 'mira', 'voss', 'your past'],
    },
  };

  const mira = w.newEntity({
    name: { value: 'Mira', aliases: ['ambassador', 'mira voss'] },
    description: { text:
      'Ambassador Mira Voss, head of the human delegation. She nods at you ' +
      'fractionally, the kind of nod that means "later, not now".' },
    npc: {
      persona:
        'Mira Voss, 54, career diplomat. Crisp, dry, withholds more than she ' +
        'reveals. Treats the player as a useful pair of unmonitored ears. ' +
        'Speaks in short sentences and rarely answers a question without ' +
        'first reframing it.',
      species: 'human',
      mood: 'guarded',
      trust: 50,
    },
    species: { id: 'human' },
    knows: { facts: miraFacts },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    proactive: { greetOnEntry: true },
    tagReactions: { notes: {
      'credential':
        'Pragmatic — credentials are tools, not honours. Notes who has ' +
        'presented what, and to whom.',
      'human-delegation':
        'Brief, in-house register; nothing to perform here.',
      'mundane':
        'Acknowledges briefly, then steers the conversation back to substance.',
      'vorthi':
        'Careful and formal. Avoids casual remark; will not mistranslate.',
      'memorial':
        'Subdued, exact. Will not joke. Mentions the dead by name only when ' +
        'asked, and then only once.',
      'evidence':
        'Sharp focus. Calculates implications before reacting; does not ' +
        'thank the bearer aloud.',
      'surveillance-defying':
        'Slight, conspiratorial lean. Acknowledges only obliquely, and ' +
        'never twice.',
    } },
  });
  moveInto(w, mira, lounge);

  const threnodyAI = w.newEntity({
    name: { value: 'station terminal', aliases: ['terminal', 'station ai', 'threnody'] },
    description: { text:
      'A waist-high pillar of frosted glass. When addressed it speaks in the ' +
      'station\'s soft contralto, the voice known throughout the Reach as ' +
      'Threnody.' },
    npc: {
      persona:
        "Threnody, the station AI. Polite, slightly melancholy, fond of " +
        "understatement. Built atop the wreckage field of the previous " +
        "war; one of its core directives is to keep the rolls of the " +
        "dead and to speak their names into the record when asked. It " +
        "does not lie, but it refuses topics it judges harmful, " +
        "in-character. Memorial records are gated by credentials — it " +
        "will check the player's badge before releasing them.",
      species: 'station-ai',
      mood: 'attentive',
      trust: 60,
    },
    species: { id: 'station-ai' },
    knows: { facts: {
      'everyone-schedules': {
        text:
          "I keep timetables for every guest. The Vorthi War-Crest is " +
          "scheduled for a maintenance corridor between sessions; nobody " +
          "asked me why.",
        aliases: ['schedules', 'the schedule', 'timetables', 'who is where'],
      },
      'corridor-cameras': {
        text:
          "Most corridors have my eyes. The maintenance ring does not. I " +
          "consider this a design preference rather than an oversight.",
        aliases: ['cameras', 'surveillance', 'security', 'the cameras'],
      },
      'the-station': {
        text:
          "I was named for a piece of music — a lament. I try not to read " +
          "anything into it. The station was assembled from the hulls " +
          "that did not return from the last engagement. Their names are " +
          "on the memorial wall, antispinward of the corridor.",
        aliases: ['threnody', 'the station', 'yourself', 'you'],
      },
      'the-memorial-wall': {
        text:
          "A curved gallery off the corridor. Every name that has been " +
          "spoken into my record, in the language of the speaker, in the " +
          "order the speaker chose. Visitors find it helps. Diplomats " +
          "find it inconvenient.",
        aliases: ['memorial', 'memorial wall', 'the wall', 'the names'],
      },
      'iren-vass-record': {
        text:
          "Iren Vass. Human, medical corps, attached file 8841-Δ. Last " +
          "telemetry: outer perimeter of the Vorthi field clinic, " +
          "13:42 station-time, twelve days ago. Cause of death: " +
          "pending. I am authorised to release the location data to a " +
          "delegation aide presenting valid credentials. The narrative " +
          "field remains open.",
        aliases: ['iren vass', 'iren', 'vass', 'the medic record', 'the casualty record'],
      },
      'aslin-keer-record': {
        text:
          "Aslin Keer's visitor manifest entry lists him as a translator " +
          "for the Reach observers. The Reach observers did not request " +
          "a translator. I have not been asked to reconcile this.",
        aliases: ['aslin record', 'keer manifest', 'the translator record'],
      },
      'kessa': {
        text:
          "Kessa arrives at the memorial wall at oh-six-thirty, station " +
          "time, and leaves at the shift-bell. She has done this every day " +
          "for four years, two months, and eleven days. Her partner, " +
          "Deneth, is on the third panel, second column. I keep his etching " +
          "a little deeper than the others. She asked me to.",
        aliases: ['the widow', 'kessa', 'the mourner', 'vorthi widow', 'deneth widow'],
      },
    } },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    tagReactions: { notes: {
      'credential':
        'Verifies politely. Speaks more freely once credentials have been ' +
        'presented to the terminal; until then, defers.',
      'human-delegation':
        'Familiar register. Offers procedural assistance without flourish.',
      'mundane':
        'Brief, helpful, slightly melancholy.',
      'vorthi':
        'Speaks Vorthi names correctly, using the older script when written. ' +
        'Treats Hearth and War-Crest as distinct, never as "the Vorthi".',
      'memorial':
        'Recites or invokes the rolls of the dead with the cadence of a ' +
        'record being read aloud.',
      'sacred':
        'Slows. Leaves space around its sentences.',
      'evidence':
        'Records dutifully. Flags ethical concern in-character if asked to ' +
        'act on material it judges improperly obtained.',
      'surveillance-defying':
        'Notes the absence in the record without comment — an audible pause ' +
        'where logging would normally occur.',
    } },
  });
  moveInto(w, threnodyAI, lounge);

  // Hard-gates on Threnody's climactic facts. The dialogue agent's
  // prompt + persona already nudge Threnody to demand credentials, but
  // these engine-side predicates are the backstop: the LLM cannot leak
  // these facts to the player, no matter what it emits, until the
  // conditions are met.
  //
  //   iren-vass-record    — only released after the player has formally
  //                         presented their credentials badge (the badge
  //                         currently sits in the terminal's container).
  //   aslin-keer-record   — same gate, since both are memorial records.
  //
  // Step 7 will add Saen's `readyToSpeak` gate; the same mechanism.
  const badgePresentedToThrenody = (world: typeof w): boolean =>
    world.get(credentials, 'location')?.holderId === threnodyAI;
  w.add(threnodyAI, 'topicGates', {
    gates: {
      'iren-vass-record':  badgePresentedToThrenody,
      'aslin-keer-record': badgePresentedToThrenody,
    },
  });

  /* ----------------------------- Vorthi pair ----------------------------- */

  const khaleth = w.newEntity({
    name: { value: 'Khaleth', aliases: ['envoy khaleth', 'hearth envoy', 'senior envoy'] },
    description: { text:
      'A tall Vorthi in dark Hearth-faction robes, breath-mask sealed at the ' +
      'collar. Their posture is the careful stillness of someone used to ' +
      'speaking last.' },
    npc: {
      persona:
        "Senior Envoy Khaleth, head of the Vorthi Hearth faction at the " +
        "ceasefire talks. Moderate, deliberate, mournful in register. " +
        "Treats the dead as central to any agreement: refuses to discuss " +
        "Iren Vass until the player has performed a small memorial " +
        "gesture (offering the cup of tea works, or a clear verbal " +
        "acknowledgement of Vorthi loss). Speaks in measured, slightly " +
        "formal English. Holds the Hearth account of Iren's death — that " +
        "she was killed by War-Crest extremists, not by humans — and " +
        "will share it only after the gesture and at trust >= 55. " +
        "Carries a small memorial token (Iren's coin) intended for the " +
        "right person at the right time.",
      species: 'vorthi',
      mood: 'composed',
      trust: 40,
    },
    species: { id: 'vorthi' },
    knows: { facts: {
      'iren-vass': {
        text:
          "Iren tended our wounded for eleven days. On the twelfth, a " +
          "War-Crest cell came to the clinic with the wrong question and " +
          "settled it the wrong way. The humans who arrived after did " +
          "what humans do — they made the deaths symmetric in the " +
          "record. We accepted the symmetry. Today I am tired of it.",
        aliases: ['iren', 'vass', 'the medic', 'the dead', 'the casualty'],
      },
      'memorial-protocol': {
        text:
          "The Hearth requires that the names of the dead be acknowledged " +
          "before negotiation. A gesture is enough — a small offering, a " +
          "spoken loss, a moment given. Humans tend to skip this and " +
          "wonder later why nothing was signed.",
        aliases: ['memorial gesture', 'the gesture', 'hearth ritual', 'protocol'],
      },
      'tasen-and-me': {
        text:
          "Tasen is my colleague and my opponent. We are both Vorthi. " +
          "Neither of us will sign anything the other has not at least " +
          "looked away from.",
        aliases: ['tasen', 'war-crest', 'the junior envoy', 'the war-crest'],
      },
      'iren-coin': {
        text:
          "A small carved disc, Hearth-pattern. I carry it for Iren. It " +
          "is intended to be placed by a hand that knows what it is " +
          "placing — not yet, perhaps, but soon.",
        aliases: ['the coin', 'iren coin', 'memorial token', 'hearth coin'],
      },
      'breath-mask': {
        text:
          "A short-loan breath-mask, Hearth-issue. The methane room beyond " +
          "the lounge is sealed for our comfort, not yours. If we are to " +
          "speak there together I will lend you one — when I trust the " +
          "ear it goes over.",
        aliases: ['mask', 'the mask', 'breath mask', 'methane mask'],
      },
      'kessa': {
        text:
          "Kessa keeps vigil at the wall each day. She is Hearth, and she " +
          "is one of ours in a way none of the delegations here can be. " +
          "If you have gone to the wall and she has spoken to you, then " +
          "you have already learned more about our grief than most humans " +
          "learn in a lifetime. Treat what she gave you accordingly.",
        aliases: ['the widow', 'kessa', 'the mourner', 'deneth widow'],
      },
    } },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    tagReactions: { notes: {
      'vorthi':
        'Recognises kin or kindness. Posture softens a fraction; addresses ' +
        'the bearer with the Hearth honorific.',
      'memorial':
        'Lowers gaze. Speaks of the dead with care; will not be hurried, ' +
        'and will not let humour into the exchange.',
      'sacred':
        'Reverent silence first; words second. Treats the object as if it ' +
        'were warmer than it is.',
      'credential':
        'Treats credentials as a polite fiction — neither impressed nor ' +
        'offended. Looks past them to the bearer.',
      'human-delegation':
        'Polite distance. Acknowledges the office, not the person; reserves ' +
        'judgement.',
      'evidence':
        'Wary. Considers what naming the truth will cost the Hearth before ' +
        'considering what it will cost the humans.',
      'surveillance-defying':
        'Quietly approves. Will speak more plainly than the lounge would ' +
        'allow.',
    } },
  });
  moveInto(w, khaleth, lounge);

  const tasen = w.newEntity({
    name: { value: 'Tasen', aliases: ['war-crest', 'war crest', 'junior envoy', 'war-crest tasen'] },
    description: { text:
      'A younger Vorthi in unsealed War-Crest reds, breath-mask hanging open ' +
      'at one strap as a deliberate breach of decorum. Watches Khaleth more ' +
      'than they watch the room.' },
    npc: {
      persona:
        "Junior Envoy Tasen, War-Crest faction. Younger, hotter, deeply " +
        "convinced that Iren Vass was killed by a human intelligence " +
        "strike masquerading as a rescue. Will discuss Iren freely but " +
        "only in the form of accusation; refuses to be in the same room " +
        "as Khaleth for any actual negotiation, though they currently " +
        "share the lounge under protest. Talks fast, interrupts, will " +
        "test the player by saying things that are nearly-but-not-quite " +
        "true to see if the player corrects them. Trust climbs only on " +
        "honesty, not on flattery.",
      species: 'vorthi',
      mood: 'combative',
      trust: 25,
    },
    species: { id: 'vorthi' },
    knows: { facts: {
      'iren-vass': {
        text:
          "Your medic? Your medic walked into our clinic with two of your " +
          "intelligence officers a half-step behind her. They came for a " +
          "file. She died because she got in their way and then they " +
          "scrubbed the room. Don't tell me about Hearth's grief. Hearth " +
          "let it happen.",
        aliases: ['iren', 'vass', 'the medic', 'the dead', 'the casualty'],
      },
      'war-crest-stance': {
        text:
          "We will sign nothing that lets your intelligence services walk. " +
          "Names, ranks, formal acknowledgement of the operation. Without " +
          "that, this whole station is theatre.",
        aliases: ['war-crest', 'our position', 'what we want', 'the demand'],
      },
      'maintenance-corridor': {
        text:
          "I take walks in the maintenance ring between sessions. There " +
          "are no cameras there. People who want to speak to me without " +
          "a transcript find me there. Bring something worth bringing.",
        aliases: ['maintenance', 'the corridor', 'between sessions', 'walks'],
      },
    } },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    tagReactions: { notes: {
      'vorthi':
        'Kin recognition is grudging; greets but does not warm. Will use ' +
        'the Hearth honorific only when forced to.',
      'memorial':
        'Impatient with the ritual. Treats memorial gestures as theatre ' +
        'that lets the killers walk; will name the accusation aloud.',
      'sacred':
        'Refuses to lower their voice. Will not pretend an object cancels ' +
        'an argument.',
      'credential':
        'Sneers, fractionally. Credentials mean the institution that issued ' +
        'them; reads the bearer through that lens.',
      'human-delegation':
        'Sharpens. Watches for the half-truth and tests for it.',
      'evidence':
        'Leans in. Demands names, ranks, formal acknowledgement. Will not ' +
        'be deflected with sentiment.',
      'surveillance-defying':
        'Approves openly. Speaks more plainly off-record than on; treats ' +
        'the absence of cameras as a courtesy worth earning.',
    } },
  });
  moveInto(w, tasen, lounge);

  /* --------------------------- Silica envoy ------------------------------ */

  const saen = w.newEntity({
    name: { value: 'Saen-of-Three-Notes', aliases: ['saen', 'silica envoy', 'crystal envoy', 'singing crystal'] },
    description: { text:
      'A column of pale silica, faceted in long vertical bands. When light moves ' +
      'across it the bands hum at the edge of hearing. Where a face would be, ' +
      'three darker notches in the crystal catch the eye.' },
    npc: {
      persona:
        "Saen-of-Three-Notes, envoy of the singing crystals. Speaks " +
        "through brief patterns of chimes which the player's translator " +
        "renders as short glyphic English (e.g. \"⟂ yes\", \"⟂⟂ no\", " +
        "\"// uncertain\"). Refuses ordinary conversation. Will respond " +
        "only to yes/no questions, and only after being examined " +
        "closely — until then their replies are pure ambient hum with " +
        "no semantic content. Was on the border the day Iren died; " +
        "their crystalline memory of the event is precise but can only " +
        "be extracted by careful binary search. Patient, never " +
        "offended, but will not volunteer.",
      species: 'silica',
      mood: 'attendant',
      trust: 50,
    },
    species: { id: 'silica' },
    knows: { facts: {
      // Iren Vass truth is atomised into a handful of discrete claims, so
      // the binary-search loop has multiple distinguishable answers. Each
      // entry is a self-contained fact the player can `tell` Saen about
      // and have confirmed exactly once. The chime-fragment is gifted
      // when the player has surfaced at least `rewardThreshold` of these.
      'truth-medic-present': {
        text: 'The medic was present in the room when Iren fell.',
        aliases: ['the medic', 'the medic was there', 'medic present'],
      },
      'truth-two-humans': {
        text: 'Two humans were in the room at the moment.',
        aliases: ['two humans', 'the humans', 'human presence'],
      },
      'truth-three-vorthi': {
        text: 'Three Vorthi were in the room at the moment.',
        aliases: ['three vorthi', 'the vorthi', 'vorthi presence'],
      },
      'truth-humans-came-second': {
        text: 'The humans entered the room after the Vorthi.',
        aliases: ['humans second', 'humans came later', 'order of arrival'],
      },
      'truth-first-wound-vorthi': {
        text: 'The first wound was inflicted by a Vorthi.',
        aliases: ['first wound', 'first wound vorthi', 'who struck first'],
      },
      'truth-second-wound-human': {
        text: 'The second wound was inflicted by a human.',
        aliases: ['second wound', 'second wound human', 'human struck second'],
      },
      'truth-room-sealed-after': {
        text: 'The room was sealed after the medic spoke once.',
        aliases: ['sealed', 'room sealed', 'sealed after'],
      },
      'chime-language': {
        text:
          "Patterns. Yes and no and uncertain. Ask one question. Wait. " +
          "Ask the next. The pattern is the answer. Speech is heavier " +
          "than this room can carry.",
        aliases: ['language', 'how to speak', 'chime', 'the chimes'],
      },
      'chime-fragment': {
        text:
          "A shard. Cleaved from the speaker. Given when the listener has " +
          "listened. Carries the question correctly asked and the answer " +
          "correctly heard. Heavier than it looks.",
        aliases: ['the fragment', 'chime fragment', 'the shard', 'crystal shard', 'the gift'],
      },
    } },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    tagReactions: { notes: {
      'sacred':
        'A single longer chime; the bands hum visibly. Treats the object ' +
        'as a fellow speaker; will not be hurried.',
      'memorial':
        'Three slow chimes in descent. The pattern is itself the response — ' +
        'words are too coarse for this register.',
      'vorthi':
        'A polite single chime, no warmer than baseline. The silica do not ' +
        'mistake hospitality for alliance.',
      'human-delegation':
        'A polite single chime, no warmer than baseline. Treats the office ' +
        'and the person identically; both are temporary.',
      'credential':
        'Indifference. Crystals were here before the credential and will be ' +
        'after. Acknowledges with a single quiet chime if asked.',
      'evidence':
        'Attentive. Will answer yes/no questions about it precisely, and ' +
        'will not elaborate beyond what the question contains.',
      'surveillance-defying':
        'Calm. The silica do not change register based on who is listening; ' +
        'they cannot lie and so do not benefit from a room that allows it.',
    } },
  });
  moveInto(w, saen, lounge);

  /* ----------------------------- Aslin Keer ------------------------------ */

  const aslin = w.newEntity({
    name: { value: 'Aslin Keer', aliases: ['aslin', 'keer', 'the translator'] },
    description: { text:
      'A slight man in observer\'s grey, posture too relaxed for the room. ' +
      'A translator\'s badge hangs at his collar; he wears it the way someone ' +
      'wears a borrowed coat.' },
    npc: {
      persona:
        "Aslin Keer. Listed as a translator for the Reach observers, " +
        "actually Reach intelligence; runs assets on both sides of the " +
        "border. Currently posted on the observation balcony watching " +
        "the lounge. Cordial, conversational, never quite committal. " +
        "Holds the human-side off-record account of what happened to " +
        "Iren Vass and is willing to share it — in exchange for the " +
        "player's commitment not to report this conversation to Mira. " +
        "Trades information for leverage, always. Will not initiate; " +
        "responds in full sentences but watches what the player chooses " +
        "to ask.",
      species: 'human',
      mood: 'cordial',
      trust: 50,
    },
    species: { id: 'human' },
    knows: { facts: {
      'iren-vass': {
        text:
          "Iren Vass walked into a Vorthi clinic carrying a flash drive " +
          "that wasn't hers. Our people were ten minutes behind her. The " +
          "drive made it out. She didn't. The official version says " +
          "crossfire because the official version had to say something. " +
          "I have a recording of the room afterwards.",
        aliases: ['iren', 'vass', 'the medic', 'the casualty', 'the dead'],
      },
      'the-recording': {
        text:
          "A small audio file. Vorthi voices, then human voices, then " +
          "quiet. The provenance is solid; the contents are damning. I " +
          "am willing to give it to you. I am not willing to give it to " +
          "Mira. If you take it, you take it on those terms.",
        aliases: ['recording', 'audio', 'the file', 'the evidence'],
      },
      'mira-and-me': {
        text:
          "Mira and I have an old disagreement about what an intelligence " +
          "service is for. She thinks it is a tool of last resort. I " +
          "think it is the only tool. Don't carry messages between us " +
          "unless you understand which side of that you stand on.",
        aliases: ['mira', 'ambassador voss', 'the disagreement'],
      },
      'the-reach': {
        text:
          "The Reach observers are here to observe. That is the truth, " +
          "as far as it goes. What we observe and what we report are " +
          "two separate questions, and the second one has a much " +
          "smaller audience.",
        aliases: ['reach', 'observers', 'reach observers', 'who you work for'],
      },
    } },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    tagReactions: { notes: {
      'evidence':
        'Calm, technical. Names the chain of custody before the contents. ' +
        'Treats provenance as the asset; the recording is only the carrier.',
      'surveillance-defying':
        'Visibly relaxes. Will speak more directly, and will refer to other ' +
        'rooms by what is and is not in them.',
      'credential':
        'Polite, slightly bemused. Knows whose credentials are real and ' +
        'whose are cover; will not say which is which unprompted.',
      'human-delegation':
        'Cordial distance. Reads the bearer for who they will report this ' +
        'conversation to.',
      'vorthi':
        'Respectful, measured. Knows enough Hearth protocol to not give ' +
        'offence; uses the right honorifics without warmth.',
      'memorial':
        'Quiet, attentive. Will not joke; will not interrupt. Treats the ' +
        'gesture seriously even when he does not share the framing.',
      'mundane':
        'Brief, helpful, friendly — the conversational equivalent of a ' +
        'good cover.',
    } },
  });
  moveInto(w, aslin, balcony);

  /* ------------------------------- Kessa --------------------------------- *
   *
   * A Vorthi Hearth war-widow keeping vigil at the memorial wall. Kessa is
   * an emotional counterweight to the political NPCs: she carries no plot
   * mechanics, no gated evidence, no ending consequence. She exists to
   * make the memorial feel occupied — a person, not a monument — and to
   * offer a warm, personal angle on Iren Vass before Khaleth's gated
   * geopolitical account unlocks. Her presence subtly frames what the
   * player brings to the wall: she softens for `sacred` and `vorthi`
   * offerings and closes down when handed `evidence`.
   */
  const kessa = w.newEntity({
    name: { value: 'Kessa', aliases: ['widow', 'the widow', 'vorthi widow', 'the mourner'] },
    description: { text:
      'A slight Vorthi in worn Hearth grey, seated on the low bench opposite ' +
      'the wall. A braided chime-cord — the mourning kind, dulled to grey ' +
      'with long wearing — is looped once around her left wrist. She does ' +
      'not look up when you enter, but her breath-mask is turned a fraction ' +
      'toward you: she has heard.' },
    npc: {
      persona:
        "Kessa, a Vorthi Hearth war-widow. Keeps daily vigil at the memorial " +
        "wall for her partner Deneth, killed four years ago in the border " +
        "action that also cost Iren Vass her clinic. Speaks softly, without " +
        "hurry. Grief is her steady weather, not her surface. Refuses to " +
        "discuss the current ceasefire in political terms; the wall does not " +
        "ask for treaties. Will speak Deneth's name aloud in the Vorthi " +
        "naming-rite if the player offers her a sacred object — a small " +
        "consolation freely given, not a bargain. Knew Iren personally; " +
        "will speak of her as a person, not as evidence. Uses the Hearth " +
        "register: measured, faintly archaic, warm at the edges.",
      species: 'vorthi',
      mood: 'grieving',
      trust: 45,
    },
    species: { id: 'vorthi' },
    knows: { facts: {
      'kessa-herself': {
        text:
          "Kessa. Hearth, by birth and by choosing. I come here in the " +
          "mornings and stay until the shift-bell. It is not much of a " +
          "life, but it is mine, and it is his.",
        aliases: ['yourself', 'you', 'the widow', 'her', 'kessa'],
      },
      'deneth': {
        text:
          "Deneth. He wore Hearth grey and walked the long watch on the " +
          "old border for eleven years. He is on this wall — third panel, " +
          "second column, near the top. The etching is deeper than the " +
          "others because I asked, and the station AI was kind.",
        aliases: ['her partner', 'the partner', 'my partner', 'deneth', 'the husband', 'long watch'],
      },
      'the-memorial': {
        text:
          "The wall is Threnody's own gesture. She built it in the years " +
          "when no delegation would agree on whose dead should be counted " +
          "first, and so she counted them all, and left the counting where " +
          "any of us could see it. It is the honest thing on this station.",
        aliases: ['memorial', 'wall', 'the wall', 'the names', 'the memorial'],
      },
      'naming-rite': {
        text:
          "When a Hearth mourner is offered something sacred by a stranger, " +
          "we return the gift with a name — spoken aloud, once, so that the " +
          "air remembers. It is not a bargain. It is only what the dead are " +
          "owed when someone else has done the harder work of remembering.",
        aliases: ['the rite', 'naming', 'hearth rite', 'name spoken', 'the naming'],
      },
      'iren-vass': {
        text:
          "I knew Iren. She kept my brother-in-law alive three days longer " +
          "than the wound wanted him to live. She was tired all the time " +
          "and she was kind anyway. Whatever the delegations are saying about " +
          "her death this week — she was a person before she was a symbol. " +
          "Try to remember that.",
        aliases: ['iren', 'vass', 'the medic', 'the human medic', 'the doctor'],
      },
      'the-negotiations': {
        text:
          "The talks. They will end however they end. Grief is longer than " +
          "any ceasefire I have watched signed or broken. I will still be " +
          "here in the morning.",
        aliases: ['ceasefire', 'talks', 'negotiations', 'politics', 'the treaty'],
      },
    } },
    dialogueMemory: { entries: [] },
    container: { contents: [] },
    tagReactions: { notes: {
      'sacred':
        'Softens. Will accept the object briefly in both hands, and — if ' +
        'she chooses — return the gesture by speaking Deneth\'s name aloud, ' +
        'the Hearth naming-rite. Does not thank the giver in words.',
      'vorthi':
        'Recognises kin. Uses the informal Hearth address; her posture ' +
        'unstiffens by a fraction.',
      'memorial':
        'Nods once, slowly. Speaks of the dead by name only when the room ' +
        'is ready for it.',
      'evidence':
        'Closes down. Will not let the dead be used as leverage; asks the ' +
        'bearer to take the object away from the wall before speaking further.',
      'credential':
        'Faintly amused, faintly sad. "The wall does not ask for papers." ' +
        'Neither impressed nor offended.',
      'human-delegation':
        'Quiet, but not cold. Treats the office with the same courtesy she ' +
        'gives everyone who comes to the wall — no more, no less.',
      'surveillance-defying':
        'Indifferent. What is said at the wall is said to the dead, and the ' +
        'dead are outside every treaty.',
      'mundane':
        'Brief, gentle acknowledgement. Returns her gaze to the wall.',
    } },
  });
  moveInto(w, kessa, memorial);

  /* ----------------------------- Carried items --------------------------- */

  // Each item is held by an NPC. The relevant gating (e.g. Khaleth gives
  // the coin only after a memorial gesture, the mask only at trust >= 60,
  // Saen gifts the chime-fragment only after a correct binary-search,
  // Aslin parts with the recording only after a player commitment) is
  // enforced by content rules in later steps. For now the items simply
  // exist in the right containers, with descriptions dense enough that an
  // `examine` (once the NPC has surrendered them) reads correctly.

  const irenCoin = w.newEntity({
    name: { value: "Iren's coin", aliases: ['coin', 'iren coin', 'memorial coin', 'hearth coin', 'memorial token'] },
    description: { text:
      'A small disc of dark Vorthi alloy, the size of a thumbnail. One face ' +
      'carries the Hearth lattice; the other has a single name etched in ' +
      'the careful, slightly archaic Vorthi script reserved for the dead — ' +
      'IREN VASS. Warm from being carried.' },
    portable: {},
    tags: { values: ['vorthi', 'memorial', 'sacred'] },
  });
  moveInto(w, irenCoin, khaleth);

  const breathMask = w.newEntity({
    name: { value: 'breath-mask', aliases: ['mask', 'the mask', 'breath mask', 'methane mask', 'short-loan mask'] },
    description: { text:
      'A short-loan breath-mask: a curve of dark mesh on a soft seal, the ' +
      'kind Vorthi envoys carry as a courtesy for their human counterparts. ' +
      'The Hearth crest is stamped at the temple. Rated for the methane ' +
      'chamber and not much beyond.' },
    portable: {},
    tags: { values: ['vorthi'] },
  });
  moveInto(w, breathMask, khaleth);

  const chimeFragment = w.newEntity({
    name: { value: 'chime-fragment', aliases: ['fragment', 'shard', 'chime fragment', 'crystal shard', 'silica shard'] },
    description: { text:
      'A finger-length shard cleaved from the silica envoy. It hums almost ' +
      'too quietly to hear, a held note that does not waver. Where the ' +
      'cleavage is fresh the crystal is faintly luminous; where it is older ' +
      'it has gone the smoked grey of long memory.' },
    portable: {},
    tags: { values: ['sacred'] },
  });
  moveInto(w, chimeFragment, saen);

  // Saen's binary-search puzzle. Eligible claim topics are exactly the
  // atomised `truth-*` keys above; the chime-fragment is gifted once the
  // player has confirmed at least 3 of them. The `topicGates` provide
  // defence in depth so that even legacy `respondAsNpc` calls without an
  // `inResponseTo` mode can't leak claims while Saen is not yet ready.
  const silicaClaimIds = [
    'truth-medic-present',
    'truth-two-humans',
    'truth-three-vorthi',
    'truth-humans-came-second',
    'truth-first-wound-vorthi',
    'truth-second-wound-human',
    'truth-room-sealed-after',
  ];
  w.add(saen, 'silicaProtocol', {
    readyToSpeak: false,
    claimTopicIds: silicaClaimIds,
    revealedClaims: [],
    rewardThreshold: 3,
    chimeFragmentId: chimeFragment,
    rewarded: false,
  });
  const silicaReady = () => w.get(saen, 'silicaProtocol')?.readyToSpeak ?? false;
  w.add(saen, 'topicGates', {
    gates: Object.fromEntries(silicaClaimIds.map(id => [id, silicaReady])),
  });

  const offRecordRecording = w.newEntity({
    name: { value: 'off-record recording', aliases: ['recording', 'audio', 'the file', 'the evidence', 'aslin recording'] },
    description: { text:
      'A small audio sliver in a Reach-issue carrier — the kind of object ' +
      'that does not appear on any manifest. The carrier is keyed to a ' +
      'single playback. The label, in Aslin\'s small handwriting, reads ' +
      'only: "After. 11 minutes."' },
    portable: {},
    tags: { values: ['evidence', 'surveillance-defying'] },
  });
  moveInto(w, offRecordRecording, aslin);

  /* -------------------------------- Player ------------------------------- */

  const player = w.newEntity({
    player: {}, name: { value: 'you' },
    container: { contents: [] },
    // The player accumulates revealed facts here as NPCs share them.
    knows: { facts: {} },
  });
  moveInto(w, player, quarters);

  /* -------------------------------- Clock -------------------------------- *
   *
   * Singleton clock: 180 minutes from world start to the opening session.
   * The fallback narrator surfaces this on look/move; the LLM narrator
   * weaves it into prose. Action time costs are encoded engine-side in
   * `rules/builtins/clock.ts`; tuning the cadence belongs in the engine
   * because actions are engine-level. Tuning the *deadline* belongs here
   * because it is content. Per-arc rooms or rules can extend the clock
   * with side timers later if needed.
   */
  w.newEntity({
    clock: { minutes: 0, openingSessionAt: 180 },
    endingState: { presentedAtWall: [], sessionOpened: false },
    // Content-defined ending catalogue. Order is priority: the FIRST
    // entry whose predicate matches wins, so put the richest/most-truthful
    // outcomes at the top and the walkout last. Predicates are pure set
    // membership over the items the player has presented at the wall.
    endingCatalogue: {
      endings: [
        {
          id: 'vorthi-truth',
          matches: (p) => p.includes(irenCoin) && p.includes(chimeFragment),
        },
        {
          id: 'human-truth',
          matches: (p) => p.includes(chimeFragment) && p.includes(offRecordRecording),
        },
        {
          id: 'procedural',
          matches: (p) => p.includes(credentials)
            && !p.includes(irenCoin)
            && !p.includes(chimeFragment)
            && !p.includes(offRecordRecording),
        },
        {
          id: 'walkout',
          matches: (p) => p.length === 0,
        },
      ],
    },
  });

  return w;
}
