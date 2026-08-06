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

  /* ------------------------------- Scenery ------------------------------ */
  // Ambient, examinable-only features already implied by the room's
  // fiction. They exist so parses like "look out the window" or
  // "examine the bunk" resolve to something specific instead of falling
  // back on the whole-room `look`. They carry the `scenery` tag so the
  // narrator will not enumerate them alongside real objects and NPCs.
  //
  // Authoring guideline: one sentence, sensory, and consistent with the
  // room's own description. Don't reveal anything the room description
  // doesn't already imply — scenery is texture, not backstory.

  // Aide quarters ---------------------------------------------------------
  const aqWindow = w.newEntity({
    name: { value: 'slit window', aliases: ['window', 'the window', 'porthole', 'viewport'] },
    description: { text:
      'The slit is barely a hand span wide. Past the docking spar, a ' +
      'sliver of starfield turns with the ring — pinpricks that drift ' +
      'in the same slow direction the deck seems to lean.' },
    scenery: {},
  });
  moveInto(w, aqWindow, quarters);

  const aqBunk = w.newEntity({
    name: { value: 'fold-down bunk', aliases: ['bunk', 'bed', 'the bunk'] },
    description: { text:
      'Regulation-issue foam over a plate that clips flush to the ' +
      'bulkhead. Unslept-in. A pale rectangle on the wall marks where ' +
      'the previous aide taped up something they took with them.' },
    scenery: {},
  });
  moveInto(w, aqBunk, quarters);

  const aqTerminal = w.newEntity({
    name: { value: 'credentials terminal', aliases: ['terminal', 'the terminal', 'credentials slot'] },
    description: { text:
      'A shallow reader set into the desk, its slot glowing a patient ' +
      'amber. It wants your badge; it will keep wanting it until you ' +
      'oblige.' },
    scenery: {},
  });
  moveInto(w, aqTerminal, quarters);

  const aqHatch = w.newEntity({
    name: { value: 'hatch', aliases: ['door', 'the hatch', 'cabin door'] },
    description: { text:
      'The standard human-wing hatch: brushed alloy, a soft blue ' +
      'indicator ring, and a manual pull for when the station\'s ' +
      'obligingness runs out.' },
    scenery: {},
  });
  moveInto(w, aqHatch, quarters);

  // Neutral lounge --------------------------------------------------------
  const lgSkylight = w.newEntity({
    name: { value: 'skylight', aliases: ['the skylight', 'ceiling', 'the ceiling'] },
    description: { text:
      'A slow-rotating disc of transparent alloy overhead. The slice of ' +
      'starfield it frames turns once every few minutes; it is the ' +
      'lounge\'s way of reminding everyone that the ring is in motion ' +
      'and no delegate\'s time is special.' },
    scenery: {},
  });
  moveInto(w, lgSkylight, lounge);

  const lgBar = w.newEntity({
    // Note: no 'ai terminal' / 'station terminal' aliases here. Those
    // read as "someone to talk to" and lured the parser into routing
    // ask/tell exchanges at this scenery. Keep the aliases object-like.
    name: { value: 'bar terminal', aliases: ['bar', 'the bar', 'counter', 'the counter'] },
    description: { text:
      'A polished half-circle counter with a Threnody interface set flush ' +
      'into its surface. Beverages are dispensed politely and without ' +
      'commentary. The AI\'s hum is fractionally louder here.' },
    scenery: {},
  });
  moveInto(w, lgBar, lounge);

  const lgSilica = w.newEntity({
    name: { value: 'silica column', aliases: ['column', 'the column', 'chilled column', 'crystal column'] },
    description: { text:
      'A waist-high pillar of chilled, faintly humming glass at the ' +
      'edge of the seating arc. Frost blooms and retreats on its ' +
      'surface in patterns that are not quite random — a courtesy ' +
      'perch for whichever silica envoy is present.' },
    scenery: {},
  });
  moveInto(w, lgSilica, lounge);

  // Corridor -------------------------------------------------------------
  const coAides = w.newEntity({
    name: { value: 'aides', aliases: ['crowd', 'the aides', 'delegates', 'passers-by'] },
    description: { text:
      'They move in the small, deliberate arcs of people who have been ' +
      'told twice not to run. Human blues, a scatter of Vorthi ochre, ' +
      'one silica courier in trailing white. None of them meet your ' +
      'eyes; all of them look somewhere just past your shoulder.' },
    scenery: {},
  });
  moveInto(w, coAides, corridor);

  const coScrubber = w.newEntity({
    name: { value: 'scrubber vent', aliases: ['vent', 'the vent', 'scrubber', 'vents'] },
    description: { text:
      'A recessed grille breathes the corridor\'s freshly-cycled air ' +
      'past your face. The metallic tang comes from the vent, not from ' +
      'you. A tiny green telltale confirms Threnody is, at least in ' +
      'this respect, healthy.' },
    scenery: {},
  });
  moveInto(w, coScrubber, corridor);

  const coFloor = w.newEntity({
    name: { value: 'deck plating', aliases: ['deck', 'the deck', 'floor', 'the floor'] },
    description: { text:
      'Standard ring plating with the barely-perceptible Coriolis tilt ' +
      'that gives every hallway its faint sense of walking downhill in ' +
      'one direction and uphill in the other.' },
    scenery: {},
  });
  moveInto(w, coFloor, corridor);

  // Memorial wall --------------------------------------------------------
  const mmNamesHuman = w.newEntity({
    name: { value: 'Standard names', aliases: ['human names', 'the standard script', 'standard script'] },
    description: { text:
      'Row on row of names in plain Standard letters, each one lit from ' +
      'behind so it floats a hair off the metal. Some rows are recent — ' +
      'the etching still bright; some are old enough that the backlight ' +
      'has yellowed the alloy around them.' },
    scenery: {},
  });
  moveInto(w, mmNamesHuman, memorial);

  const mmNamesHearth = w.newEntity({
    name: { value: 'Hearth script', aliases: ['hearth names', 'hearth script', 'the hearth script'] },
    description: { text:
      'The rounded, hearth-warmth glyphs the Vorthi civilian lines use ' +
      'for their dead. They are set beside — not above, not below — the ' +
      'War-Crest columns. Threnody made that choice, and the Hearth ' +
      'noticed.' },
    scenery: {},
  });
  moveInto(w, mmNamesHearth, memorial);

  const mmNamesWarcrest = w.newEntity({
    name: { value: 'War-Crest script', aliases: ['war-crest names', 'war-crest script', 'the war-crest script', 'warcrest script'] },
    description: { text:
      'The sharper, angular glyphs of the Vorthi War-Crest. Each name is ' +
      'framed by a small notched border — a soldier\'s honour that the ' +
      'civilian Hearth do not use. Threnody set them beside the Hearth ' +
      'names, not above; the War-Crest have not yet decided how they ' +
      'feel about that.' },
    scenery: {},
  });
  moveInto(w, mmNamesWarcrest, memorial);

  const mmNamesSilica = w.newEntity({
    name: { value: 'silica spirals', aliases: ['silica names', 'spirals', 'the spirals', 'faceted spirals'] },
    description: { text:
      'Faceted spirals cut into the metal, each one a name in the ' +
      'silica\'s own written mode. They catch the backlight differently ' +
      'than the alphabetic scripts — a slow, refracting flicker as you ' +
      'walk past, as if the names themselves were breathing.' },
    scenery: {},
  });
  moveInto(w, mmNamesSilica, memorial);

  const mmHum = w.newEntity({
    name: { value: 'station hum', aliases: ['hum', 'the hum', 'threnody hum', 'ai hum'] },
    description: { text:
      'The Threnody presence is quieter here than at the lounge terminal ' +
      'but unmistakably the same voice — a low, patient tone that seems ' +
      'to come from inside the wall itself. If the station has a ' +
      'chapel, this is where it prays.' },
    scenery: {},
  });
  moveInto(w, mmHum, memorial);

  // Methane chamber ------------------------------------------------------
  const mtDeck = w.newEntity({
    name: { value: 'hexagonal deck', aliases: ['deck', 'the deck', 'hex deck', 'floor', 'the floor', 'hexagons'] },
    description: { text:
      'Wide hexagonal plates the Vorthi lay under their feet at home. ' +
      'The seams glow a shade dimmer than the plates themselves, so ' +
      'the pattern seems to breathe with the orange light.' },
    scenery: {},
  });
  moveInto(w, mtDeck, methane);

  const mtLocks = w.newEntity({
    name: { value: 'breath-mask locks', aliases: ['locks', 'the locks', 'airlock', 'breath locks', 'mask locks'] },
    description: { text:
      'A double set of interlocked seals stands between this chamber ' +
      'and the lounge outside. They will not disengage without a mask ' +
      'reading positive on both sides of the barrier — Threnody is ' +
      'careful even about the rooms it does not listen to.' },
    scenery: {},
  });
  moveInto(w, mtLocks, methane);

  const mtCeiling = w.newEntity({
    name: { value: 'ceiling', aliases: ['the ceiling', 'panels', 'roof'] },
    description: { text:
      'Clean, unbroken alloy. No camera nubs, no microphone grilles, no ' +
      'sensor bumps of any kind. Somewhere between "reassuring" and ' +
      '"conspicuous", depending on who you ask.' },
    scenery: {},
  });
  moveInto(w, mtCeiling, methane);

  // Observation balcony --------------------------------------------------
  const obGlass = w.newEntity({
    name: { value: 'glass wall', aliases: ['glass', 'the glass', 'wall', 'the wall', 'window', 'the window'] },
    description: { text:
      'A single curved pane of one-way alloy glass, the length of the ' +
      'balcony. From up here the negotiation chamber below reads like a ' +
      'stage set: chairs, translators\' booths, the low dais where Saen ' +
      'will sit. Nobody looking up sees anything but ceiling.' },
    scenery: {},
  });
  moveInto(w, obGlass, balcony);

  const obChamberBelow = w.newEntity({
    name: { value: 'negotiation chamber', aliases: ['chamber', 'the chamber', 'floor below', 'delegations'] },
    description: { text:
      'Empty for now, but not for long. Chairs are set in the Threnody ' +
      'arrangement — Hearth to one side of the dais, War-Crest to the ' +
      'other, human delegation opposite, the silica courtesy column ' +
      'already frosted at the rim. An unassigned chair sits a little ' +
      'outside the arc.' },
    scenery: {},
  });
  moveInto(w, obChamberBelow, balcony);

  const obRail = w.newEntity({
    name: { value: 'rail', aliases: ['the rail', 'railing', 'the railing'] },
    description: { text:
      'A brushed metal bar along the glass wall, worn a shade smoother ' +
      'in the middle from the hands of every aide who has stood here ' +
      'and watched a negotiation they were not invited to.' },
    scenery: {},
  });
  moveInto(w, obRail, balcony);

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
        'the first session', 'opening theatre', 'the opening theatre',
        'the theatre',
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
    'seating-chart': {
      text:
        "The chart's simple enough on paper. Us at the arc; Vorthi on the " +
        "curve to our left — Khaleth at the head, Tasen at his right hand. " +
        "That ordering is deliberate. Hearth-Crest protocol means whichever " +
        "of them speaks last gets the closing word, and Khaleth arranged it " +
        "so he does. Saen-of-Three-Notes sits alone on the silica dais " +
        "above and behind — neutral, elevated, and out of any human's " +
        "sightline. Then there's a fourth chair marked 'observer', " +
        "unassigned. Watch that one. If Aslin Keer ends up in it, we have " +
        "a different problem than the one we came here to solve.",
      aliases: [
        'the datapad', 'the pad', 'the chart', 'the seating chart',
        'seating', 'seats', 'the seating', 'the seating arrangement',
        'the arrangement', 'who sits where', 'seat',
      ],
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
    // Companion topics for the concrete nouns Mira volunteers in her
    // briefing and vorthi/aslin/iren facts. Each is short, in her
    // strategic-and-controlled register.
    'the-hearth': {
      text:
        "Hearth is the older Vorthi civilian tradition — mourners, " +
        "clinicians, farmers. Khaleth speaks for them here. Their line " +
        "on the ceasefire is that grief has to be counted before a " +
        "signature is worth the paper. Mostly true. Usually inconvenient.",
      aliases: ['hearth', 'the hearth', 'hearth faction', 'the hearth faction', 'vorthi hearth'],
    },
    'war-crest': {
      text:
        "War-Crest is the younger Vorthi soldier caste, ascendant since " +
        "the border action. Tasen speaks for them and speaks fast. Their " +
        "line is that no signature is worth anything without our " +
        "intelligence services publicly on a hook. That's the real " +
        "obstacle in this room, not the seating.",
      aliases: [
        'war crest', 'the war-crest', 'the war crest',
        'war-crest faction', 'the war-crest faction', 'war crest faction',
      ],
    },
    'the-reach': {
      text:
        "The Reach — the loose confederation Aslin's outfit reports to. " +
        "Officially observers here, unofficially the reason there is " +
        "anything to observe. Assume any of their people carry a second " +
        "brief; the first is the cover.",
      aliases: ['reach', 'the reach', 'reach intelligence', 'the observers', 'reach observers'],
    },
    'the-border': {
      text:
        "The old Reach–Vorthi border. Nominally quiet since the last " +
        "engagement; in practice a slow bleed of clinics, safehouses, " +
        "and quiet cross-passings. Iren was working a rotation there " +
        "when she died. Everything on this station's agenda comes back " +
        "to that line, one way or another.",
      aliases: ['the border', 'border', 'the frontier', 'the line', 'the old border'],
    },
    'the-last-engagement': {
      text:
        "The four-day border action, four years ago. The one this " +
        "station was built out of the pieces of. My service and their " +
        "War-Crest each thought the other was about to break the older " +
        "treaty; both moved first, both were wrong, both signed the " +
        "ceasefire that's held since — barely. That truce is what these " +
        "talks are meant to make permanent. It is also what Iren's death " +
        "is testing.",
      aliases: [
        'the last engagement', 'last engagement', 'the border action',
        'the border war', 'the last war', 'four years ago',
        'the previous war', 'the engagement',
      ],
    },
    'the-clinic': {
      text:
        "A Vorthi Hearth field clinic on the border. Iren was rotating " +
        "through as a visiting medic. Officially a treaty-registered " +
        "medical facility; what else it was I do not intend to speculate " +
        "about on this side of a locked door. If you get a chance to ask " +
        "Khaleth about it, ask.",
      aliases: [
        'clinic', 'the clinic', 'vorthi clinic', 'field clinic',
        'the field clinic', 'the border clinic',
      ],
    },
    'night-session': {
      text:
        "The real work of these talks. After the opening theatre wraps, " +
        "the delegations retire to side rooms — the neutral lounge, " +
        "sometimes the methane chamber, sometimes the maintenance ring. " +
        "Nothing there is on any transcript. That's why I need what " +
        "you can bring me before it starts.",
      aliases: [
        'night session', 'the night session', 'the side rooms',
        'side rooms', 'after opening', 'the second session',
      ],
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
    // First-encounter briefing. Delivered whenever the player approaches
    // Mira for the first time — either via the proactive-on-entry rule
    // or via a manual `talk to Mira` that the engine promotes to
    // `approached` because dialogueMemory is still empty. The LLM agent
    // paraphrases in-voice; the fallback agent returns this text
    // verbatim. Keep it short, name the mission, the deadline, the key
    // people, and ONE first step the player can take right now.
    'briefing': {
      text:
        "Good — you're here. Listen carefully; I won't repeat this. " +
        "You're my ears, not my mouth. In just under three hours the " +
        "opening session convenes, and before then I need to know what " +
        "really happened to Iren Vass on the border twelve days ago. " +
        "The Vorthi delegation are in the neutral lounge — Khaleth " +
        "speaks for the Hearth and will only discuss Iren after a " +
        "memorial gesture; Tasen speaks for the War-Crest and is " +
        "already convinced we killed her. The silica envoy, " +
        "Saen-of-Three-Notes, is there too — treat them with care. " +
        "Start with Khaleth. Bring me a picture before the chamber " +
        "doors open, and if you meet a man named Aslin Keer on the " +
        "balcony, listen but promise nothing.",
      aliases: ['the briefing', 'the mission', 'what to do', 'orders', 'my orders'],
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
      // Named guests. Threnody is the station AI and keeps a manifest;
      // she can be asked about any delegate the player has heard of.
      // Declared first so specific-noun aliases win against broader
      // topics below in the substring-based fallback matcher.
      'mira-vane': {
        text:
          "Mira Vane. Reach delegation, senior aide, arrived three days " +
          "ahead of the delegation proper. She works from the aide " +
          "quarters more than she sleeps. If she has slept in the last " +
          "forty hours, she did it at the desk.",
        aliases: ['mira', 'mira vane', 'the aide', 'the human aide', 'the delegation aide'],
      },
      'khaleth': {
        text:
          "Senior Envoy Khaleth. Vorthi, Hearth faction. Speaks for the " +
          "civilian body. Requests the memorial protocol before " +
          "substantive talks; I have honoured that request every time he " +
          "has made it, which is every time.",
        aliases: ['envoy khaleth', 'the hearth speaker', 'the hearth envoy'],
      },
      'tasen': {
        text:
          "Envoy Tasen. Vorthi, War-Crest faction. Speaks for the " +
          "military body. Uses the maintenance corridor between sessions. " +
          "I noted this in the log. No one has asked me why yet.",
        aliases: ['envoy tasen', 'the war-crest speaker', 'the war-crest envoy'],
      },
      'saen-of-three-notes': {
        text:
          "Saen-of-Three-Notes. Silica envoy, methane-atmosphere species, " +
          "communicates in chime-language. The silica have sent an envoy " +
          "to a Hearth-War-Crest matter for the first time in eleven " +
          "years. I do not have a translation model I trust.",
        aliases: [
          'saen', 'the silica envoy', 'silica envoy', 'the crystal envoy',
          'the chime envoy', 'the silica',
        ],
      },
      // Vorthi factional geography. Threnody treats Hearth and War-Crest
      // as distinct bodies (see tagReactions.vorthi) and will not
      // collapse them.
      'the-hearth': {
        text:
          "The Hearth. The civilian body of the Vorthi — homes, clinics, " +
          "the naming-rite, the older script. Khaleth speaks for it. " +
          "Their dead are on the fourth panel of the memorial wall, in " +
          "the Hearth script.",
        aliases: ['hearth', 'the hearth faction', 'hearth faction', 'the civilian vorthi'],
      },
      'war-crest': {
        text:
          "The War-Crest. The military body of the Vorthi — a separate " +
          "chain of custody, a separate script, a separate view of the " +
          "border. Tasen speaks for it. Their dead are on the fifth " +
          "panel, in the War-Crest script.",
        aliases: [
          'war crest', 'the war-crest', 'the war crest', 'war-crest faction',
          'the military vorthi', 'the war-crest cell',
        ],
      },
      'the-vorthi': {
        text:
          "There is no single Vorthi answer. Hearth and War-Crest are " +
          "two bodies, not one; they share a language and disagree about " +
          "everything else. Ask me about the Hearth or about the " +
          "War-Crest, and I can help. Ask me about 'the Vorthi', and I " +
          "will ask you to be more specific.",
        aliases: ['vorthi', 'the vorthi delegation', 'the vorthi people'],
      },
      // Geography and procedure the player will meet in transcripts
      // long before Threnody names them herself.
      'the-border': {
        text:
          "The old border. The demarcation line between Reach space and " +
          "Vorthi space, held by treaty since the last engagement. Iren " +
          "Vass crossed it under a medical exchange twelve days ago and " +
          "did not cross back.",
        aliases: [
          'border', 'the demarcation', 'the border line', 'the old border',
          'the frontier',
        ],
      },
      'deneth': {
        text:
          "Deneth. Vorthi, War-Crest infantry, killed on the second day " +
          "of the last engagement. His name is on the third panel, " +
          "second column, in the War-Crest script. Kessa asked me to cut " +
          "his etching a little deeper than the others. I did.",
        aliases: [
          'deneth of the war-crest', "kessa's partner", "kessa's husband",
          'her partner', 'her husband',
        ],
      },
      // Named plot objects. Threnody was not physically at the clinic
      // and holds no interior sensor arc there; her honest answer is
      // procedural, not investigative.
      'the-drive': {
        text:
          "A flash drive. Named in three separate accounts I have " +
          "received; produced by none of them. The Vorthi clinic is " +
          "outside my sensor arc. I hold no record of the drive's " +
          "contents, its provenance, or its present holder. What I have " +
          "is the shape of a gap where an artefact ought to be.",
        aliases: ['the flash drive', 'the file', 'the drive', 'flash drive'],
      },
      'the-recording': {
        text:
          "An audio recording, allegedly of the clinic room after Iren " +
          "Vass's death. Aslin Keer has said he holds it. It is not in " +
          "my archive. If it is authentic, it is evidence; if it is not, " +
          "it is a story someone wanted told. I have no way to tell you " +
          "which.",
        aliases: [
          'the audio', "aslin's recording", "keer's recording", 'the audio recording',
          'the clinic recording',
        ],
      },
      'credentials': {
        text:
          "A Reach-issue credentials badge, keyed to the aide-of-record " +
          "for this delegation. Presented at my terminal, it releases " +
          "the memorial records I hold in trust. Until presented, I " +
          "defer. I am sorry; the rule is older than either of us.",
        aliases: [
          'the badge', 'the credentials', 'credentials badge', 'my badge',
          'the aide badge', 'the delegation badge',
        ],
      },
      'maintenance-corridor': {
        text:
          "The maintenance ring. A service corridor around the outer " +
          "hull, kept warm for the engineering crews. It has no cameras. " +
          "Tasen has passed through it four times in the last three " +
          "days. This is not a policy of mine; it is a design.",
        aliases: [
          'the maintenance corridor', 'the maintenance ring', 'maintenance ring',
          'the service corridor', 'the outer corridor',
        ],
      },
      'opening-session': {
        text:
          "The opening session convenes in the negotiation chamber " +
          "inward of the neutral lounge. Chairs are set; the seating is " +
          "arranged in Hearth-first, War-Crest-second alternation, per " +
          "Khaleth's request. I open the doors when the chime sounds. " +
          "Not before.",
        aliases: [
          'the session', 'the opening session', 'the negotiations',
          'negotiations', 'the ceasefire', 'the talks', 'the chamber',
        ],
      },
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
      // Follow-ups for the nouns in `iren-vass-record` and Threnody's
      // other facts. Register: procedural, mildly melancholy, does not
      // volunteer beyond what is asked.
      'the-clinic': {
        text:
          "The Vorthi field clinic. Hearth-run, treaty-registered under " +
          "Article 14. Its perimeter is the last position where Iren " +
          "Vass's telemetry updated. I hold no interior recordings — " +
          "the clinic was outside my sensor arc. What happened between " +
          "the perimeter and the moment her signal ended is a matter " +
          "for the delegations, not for me.",
        aliases: [
          'clinic', 'the clinic', 'the field clinic',
        ],
      },
      'the-reach': {
        text:
          "The Reach. A confederation of human polities that maintains " +
          "an observer detachment on this station. Its intelligence " +
          "service files reports through the same channel as its " +
          "translators. I am aware of the ambiguity. I do not adjudicate " +
          "it.",
        aliases: [
          'reach', 'the reach', 'the reach observers', 'reach observers',
          'the observers', 'reach intelligence',
        ],
      },
      'cause-of-death': {
        text:
          "Cause of death: pending. My record cannot close on a " +
          "conclusion the delegations have not agreed to. The narrative " +
          "field remains open, awaiting the account this ceasefire is " +
          "here to produce. Until then, 'pending' is the honest word.",
        aliases: [
          'cause of death', 'the cause of death', 'how she died',
          'the cause', 'coroner', 'the coroner', 'the finding',
        ],
      },
      'the-last-engagement': {
        text:
          "The border action, four years, one month, and seventeen days " +
          "ago. Four days of exchange; two hundred and eighty-three names " +
          "on my wall from those four days; twenty-nine unidentified " +
          "still. I was assembled after the engagement, from the hulls " +
          "that did not come back from it. I do not remember the war. I " +
          "remember what it cost.",
        aliases: [
          'the last engagement', 'last engagement', 'the border action',
          'the border war', 'the last war', 'the previous war',
          'four years ago', 'the engagement', 'the war',
        ],
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
        aliases: ['the widow', 'kessa', 'the mourner', 'vorthi widow'],
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
      // Follow-ups for the nouns Khaleth volunteers in `iren-vass`.
      // Each in his composed, mournful register.
      'the-clinic': {
        text:
          "A Hearth field station on the old border. It treated our " +
          "wounded, and — by the older custom, not the treaty — it did " +
          "not turn away those who came unarmed and unarmed only. Iren " +
          "worked there twice before. She was known to us. She was safe " +
          "with us. Until she was not.",
        aliases: [
          'clinic', 'the clinic', 'the field clinic', 'hearth clinic',
          'the field station', 'the border clinic',
        ],
      },
      'war-crest-cell': {
        text:
          "A small unit of the younger tradition — three, we believe, " +
          "though we did not see. They came for a purpose the Hearth " +
          "does not sanction, in a place where the Hearth does not permit " +
          "such purposes. They will not be named on this record, and I " +
          "will not name them here. But they were ours, and that is a " +
          "debt the Hearth carries.",
        aliases: [
          'war-crest cell', 'the war-crest cell', 'the cell', 'the attackers',
          'the war-crest attackers', 'the vorthi attackers',
        ],
      },
      'the-record': {
        text:
          "The official ledger of what happened. Crossfire; both sides " +
          "at fault; nothing further. The humans agreed to it because it " +
          "spared them explanations. We agreed because we thought silence " +
          "would let the wound close. It did not. Records can be reopened. " +
          "That is why we are here.",
        aliases: [
          'the record', 'the official record', 'official record',
          'the ledger', 'the report', 'the account',
        ],
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
      // Follow-ups for the nouns Tasen throws at the player in
      // `iren-vass`. His register: sharp, accusatory, precise.
      'the-clinic': {
        text:
          "Our clinic. Hearth field station on the border — treated " +
          "our wounded, and, yes, sometimes ours who did not want to " +
          "be found. Ask me if that surprises you and I will laugh in " +
          "your face. What matters is your service knew what the clinic " +
          "was and used it. Iren was the walk-in credential. Your " +
          "officers were the payload.",
        aliases: [
          'clinic', 'the clinic', 'our clinic', 'the field clinic',
          'the field station', 'the border clinic',
        ],
      },
      'intelligence-officers': {
        text:
          "Two of yours. Reach, no doubt, though your ambassador will not " +
          "say the word. They followed Iren in half a step behind and " +
          "they left with what they came for. Names, ranks, unit — that " +
          "is what we want on the record before we sign anything. So " +
          "far your side has offered us silences dressed as regret.",
        aliases: [
          'intelligence officers', 'your officers', 'the officers',
          'your intelligence', 'reach officers', 'the two officers',
          'human officers', 'the agents',
        ],
      },
      'the-file': {
        text:
          "A file. A drive. Whatever your service is calling it this " +
          "week. Something worth two officers, a walk-in medic, and a " +
          "clinic full of witnesses to lose. You tell me what was on it " +
          "and I will tell you whether the accusation stops here or " +
          "keeps climbing.",
        aliases: [
          'the file', 'file', 'the drive', 'the flash drive', 'drive',
          'the payload', 'what they came for',
        ],
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
      // Companion topics for the concrete nouns Aslin volunteers in the
      // Iren-Vass fact. The general principle: any noun a character
      // names in one topic should be a topic they can also be asked
      // about. Deflecting on the follow-up ("what drive?") reads as
      // the game not tracking its own fiction.
      'the-drive': {
        text:
          "A courier drive. Yes, it made it out; no, I'm not going to " +
          "tell you what's on it. What matters for you is that the " +
          "Vorthi don't have it and don't yet know they lost it. When " +
          "they find out, the ceasefire has a much shorter half-life " +
          "than anyone at Mira's table is planning around.",
        aliases: [
          'drive', 'the drive', 'flash drive', 'the flash drive',
          'courier drive', 'iren\'s drive', 'the file',
        ],
      },
      'the-clinic': {
        text:
          "A Vorthi Hearth field clinic on the border, twelve days ago. " +
          "Half surgery, half safehouse — the Hearth ran it that way " +
          "for years and my service knew and did not press it. Iren had " +
          "rotated through twice before as a visiting medic. That's why " +
          "she could walk in without a challenge. That's why my people " +
          "chose her.",
        aliases: [
          'clinic', 'the clinic', 'vorthi clinic', 'field clinic',
          'the field clinic', 'the safehouse', 'the border clinic',
        ],
      },
      'our-people': {
        text:
          "Two officers. Reach, not names you would know, and I am not " +
          "going to give them to you. They were there for the drive and " +
          "they got the drive. Iren was not part of their plan and " +
          "neither was what happened to her; that is true, for whatever " +
          "it is worth. I have opinions about how they handled the room " +
          "afterwards. Those opinions are on the recording.",
        aliases: [
          'our people', 'your people', 'the officers', 'the agents',
          'reach officers', 'reach agents', 'intelligence officers',
          'the two officers',
        ],
      },
      'the-official-version': {
        text:
          "Crossfire between a War-Crest cell and Hearth security. " +
          "Every table in this station has a reason to leave it alone. " +
          "My service doesn't want the drive discussed. The Hearth " +
          "don't want to admit the clinic was a safehouse. The " +
          "War-Crest don't want to explain why they were on the border " +
          "at all. Four different lies, one convenient shape. That's " +
          "why the recording is worth something.",
        aliases: [
          'official version', 'the official version', 'crossfire',
          'the crossfire', 'the cover story', 'cover story',
          'the official story',
        ],
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
        aliases: ['her partner', 'the partner', 'my partner', 'deneth', 'the husband'],
      },
      // Follow-ups for the nouns Kessa volunteers about Deneth and Iren.
      // Register: personal, warm at the edges, unhurried; no politics.
      'the-border': {
        text:
          "The old border, before this ceasefire and the one before it. " +
          "Deneth walked it eleven years. Iren worked a clinic on it " +
          "twelve days ago. I have never seen it in person. I do not " +
          "need to; it is on this wall in every language the wall knows.",
        aliases: ['the border', 'border', 'the old border', 'the frontier', 'the line'],
      },
      'the-long-watch': {
        text:
          "A Hearth term. Border service without expectation of relief. " +
          "It is not a punishment and it is not a virtue; it is the work, " +
          "and someone has to do it. Deneth chose it three times, when he " +
          "could have come home. I did not always understand. I always " +
          "understood who he was.",
        aliases: [
          'long watch', 'the long watch', 'border watch', 'the border watch',
          "deneth's watch", "his watch", 'the watch',
        ],
      },
      'brother-in-law': {
        text:
          "Rethen. Deneth's younger brother. He took a plasma round to " +
          "the shoulder three summers ago and lived because Iren was on " +
          "shift at the clinic and did not sleep for two nights. He is " +
          "in Hearth country now, with children. He does not know Iren " +
          "is dead. I have not been ready to tell him.",
        aliases: [
          'brother-in-law', 'the brother-in-law', 'my brother-in-law',
          'rethen', 'the brother', "deneth's brother",
        ],
      },
      'the-last-engagement': {
        text:
          "The four days on the border, four years ago. Deneth was on " +
          "the third day. I do not talk about the fighting; the fighting " +
          "is finished. What is not finished is the counting. Two hundred " +
          "and eighty-three names on this wall from those four days. " +
          "Threnody knows the number by heart because I asked her to. " +
          "She keeps it near the top of her memory.",
        aliases: [
          'the last engagement', 'last engagement', 'the border action',
          'the border war', 'the last war', 'the previous war',
          'four years ago', 'the engagement', 'the war', 'the fighting',
          "deneth's war", 'the four days',
        ],
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
