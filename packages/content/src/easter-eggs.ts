/**
 * Easter-egg registry — Earth pop-culture references the player might
 * type that an in-universe NPC would obviously not recognise. We
 * deliberately limit this to space / science-fiction franchises so the
 * gag stays tonally on-theme: a station spacer might plausibly have
 * heard a stray rumour about "the Force" or "warp drive" the way our
 * spacers hear about ancient Earth myths. Fantasy (LOTR, Harry Potter)
 * and superheroes (Spider-Man, Batman) are intentionally out of scope.
 *
 * The matching is case-insensitive with word boundaries to avoid
 * embarrassing substring hits ("forces" must not match "force",
 * "tardiness" must not match "TARDIS", etc.).
 *
 * Each entry carries a `hint`: a generic, voice-neutral deflection that
 * the LLM dialogue agent can rewrite in-character, or that the fallback
 * agent can return verbatim. Hints are written from the perspective of
 * a Threnody-station spacer: gently confused, slightly amused, never
 * winking at the camera.
 */

export type EasterEgg = {
  id: string;
  detect: RegExp;
  hint: string;
};

/**
 * Build a single regex matching any of the given alternative patterns
 * as whole-word fragments. Authors are trusted to write regex syntax —
 * we only normalise inter-token whitespace to `\s+` and bind each
 * alternative with `\b` on both sides. This lets entries use `?`, `[]`,
 * `-`, etc. as regex metacharacters when they need to (e.g.
 * `weyland[- ]yutani`, `i'?m sorry`, `halo[- ]?\\d+`).
 */
function phrases(...alts: string[]): RegExp {
  const normalised = alts.map(p => p.trim().replace(/ +/g, '\\s+'));
  return new RegExp(`\\b(?:${normalised.join('|')})\\b`, 'i');
}

export const SCIFI_EGGS: EasterEgg[] = [
  {
    id: 'star-wars',
    detect: phrases(
      'lightsaber', 'lightsabers',
      'jedi', 'sith',
      'the force',
      'galaxy far,? far away',
      'death star',
      'wookiee', 'wookiees', 'wookie',
      'millennium falcon',
    ),
    hint: 'Sounds like something from a galaxy far, far away — and I\'ve never been there.',
  },
  {
    id: 'star-trek',
    detect: phrases(
      'warp drive', 'warp speed',
      'beam me up',
      'klingon', 'klingons',
      'vulcan', 'vulcans',
      'starfleet',
      'delta quadrant', 'alpha quadrant', 'gamma quadrant',
      'prime directive',
      'transporter room',
      'live long and prosper',
    ),
    hint: 'That\'s the Delta quadrant, right? I don\'t know much about that.',
  },
  {
    id: 'doctor-who',
    detect: phrases(
      'tardis',
      'dalek', 'daleks',
      'time lord', 'time lords',
      'sonic screwdriver',
      'gallifrey',
    ),
    hint: 'You\'re talking about a ship that\'s bigger inside than out? Spacer\'s tale, I think.',
  },
  {
    id: 'hitchhikers',
    detect: phrases(
      "don'?t panic",
      'babel fish',
      'vogon', 'vogons',
      'pan[- ]galactic gargle blaster',
      'infinite improbability',
      'the answer is 42',
      'life,? the universe,? and everything',
    ),
    hint: 'I\'ve heard that line. I think it\'s from one of the old Earth comedies.',
  },
  {
    id: 'dune',
    detect: phrases(
      'spice melange',
      'sandworm', 'sandworms',
      'bene gesserit',
      'kwisatz haderach',
      'arrakis',
      'fremen',
      'gom jabbar',
    ),
    hint: 'That sounds like a desert-world story. We don\'t have a lot of sand out here.',
  },
  {
    id: 'bsg',
    detect: phrases(
      'cylon', 'cylons',
      'frak', 'fracking',
      'so say we all',
      'battlestar',
    ),
    hint: 'Frak — that\'s the word, isn\'t it? Old Colonial slang. Not something we use here.',
  },
  {
    id: 'expanse',
    detect: phrases(
      'belter', 'belters',
      'beratna', 'beltalowda',
      'protomolecule',
      'rocinante',
    ),
    hint: 'You sound like a Belt-runner. That dialect doesn\'t carry this far in.',
  },
  {
    id: 'firefly',
    detect: phrases(
      'browncoat', 'browncoats',
      'reaver', 'reavers',
      'shiny',
      "ain'?t no power in the 'verse",
      "can'?t take the sky",
    ),
    hint: 'Browncoats? That\'s a name from somewhere I haven\'t flown.',
  },
  {
    id: 'alien',
    detect: phrases(
      'xenomorph', 'xenomorphs',
      'facehugger', 'facehuggers',
      'chestburster',
      'weyland[- ]yutani',
      'nostromo',
      'yautja',
    ),
    hint: 'If something with acid blood ever turned up at this station, I\'d hear about it. I haven\'t.',
  },
  {
    id: 'hal-9000',
    detect: phrases(
      'open the pod bay doors',
      'hal 9000', 'hal-9000',
      "i'?m sorry,? dave",
      'monolith on the moon',
    ),
    hint: 'That\'s a very old Earth story. I don\'t answer to "Dave."',
  },
  {
    id: 'mass-effect',
    detect: phrases(
      'mass relay', 'mass relays',
      'citadel council',
      'reapers',
      'biotic', 'biotics',
      'normandy sr-?2',
    ),
    hint: 'No relays, no Council. Just this station and the people on it.',
  },
  {
    id: 'halo',
    detect: phrases(
      'spartan-?\\d{3}',
      'master chief',
      'covenant elites',
      'unsc',
      'forerunners?',
      'halo ring', 'halo rings',
    ),
    hint: 'Some kind of ring-world military? You\'ve been reading too much.',
  },
  {
    id: 'babylon-5',
    detect: phrases(
      'vorlon', 'vorlons',
      'minbari',
      'narn',
      'psi corps',
    ),
    hint: 'Names I don\'t know. Are these factions from one of the deep stations?',
  },
];

/**
 * Scan `text` for the first matching easter-egg. Returns `undefined`
 * when nothing matches. We iterate the array in order; the first hit
 * wins, which lets authors put more-specific patterns earlier if they
 * ever overlap. None currently do.
 */
export function detectEasterEgg(text: string): EasterEgg | undefined {
  for (const egg of SCIFI_EGGS) {
    if (egg.detect.test(text)) return egg;
  }
  return undefined;
}

/**
 * Look up an egg by id. Used by the dialogue agents to recover the
 * hint when an `inResponseTo` mode of `easter-egg:<id>` arrives.
 */
export function getEasterEgg(id: string): EasterEgg | undefined {
  return SCIFI_EGGS.find(e => e.id === id);
}
