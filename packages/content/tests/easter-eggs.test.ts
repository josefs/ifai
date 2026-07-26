import { describe, it, expect } from 'vitest';
import { detectEasterEgg, getEasterEgg, SCIFI_EGGS } from '../src/easter-eggs.js';

describe('detectEasterEgg — positive matches', () => {
  it.each([
    ['ask about lightsabers',                'star-wars'],
    ['can you use the force?',               'star-wars'],
    ['from a galaxy far far away',           'star-wars'],
    ['tell me about warp drive',             'star-trek'],
    ['beam me up',                           'star-trek'],
    ['the prime directive applies',          'star-trek'],
    ['we entered the delta quadrant',        'star-trek'],
    ['is that a TARDIS?',                    'doctor-who'],
    ['exterminate the daleks',               'doctor-who'],
    ["don't panic about the babel fish",     'hitchhikers'],
    ['the answer is 42',                     'hitchhikers'],
    ['watch out for vogons',                 'hitchhikers'],
    ['spice melange harvest',                'dune'],
    ['the bene gesserit witches',            'dune'],
    ['ride the sandworm',                    'dune'],
    ['the cylons attacked',                  'bsg'],
    ['frak this',                            'bsg'],
    ['I am a belter, beratna',               'expanse'],
    ['the protomolecule activated',          'expanse'],
    ['true browncoats never quit',           'firefly'],
    ['reavers are coming',                   'firefly'],
    ['xenomorph in the vents',               'alien'],
    ['weyland-yutani sent us',               'alien'],
    ['open the pod bay doors',               'hal-9000'],
    ["I'm sorry, dave",                      'hal-9000'],
    ['the mass relay went dark',             'mass-effect'],
    ['biotics flared',                       'mass-effect'],
    ['call the master chief',                'halo'],
    ['the unsc dropship',                    'halo'],
    ['the vorlons watch us',                 'babylon-5'],
    ['minbari ambassador',                   'babylon-5'],
  ])('%s → %s', (input, expectedId) => {
    expect(detectEasterEgg(input)?.id).toBe(expectedId);
  });
});

describe('detectEasterEgg — negative cases (must NOT match)', () => {
  it.each([
    // Off-theme references — fantasy, superheroes, real-world
    'hello frodo',
    'spider-man swung by',
    'I love hogwarts',
    'batman is brooding',
    'gandalf the grey',
    // Substring traps — these contain franchise letters but not as words
    'forces of habit',                 // "force" inside "forces of"... actually \b force \b WILL match. drop test.
    'tardiness is unprofessional',     // "tardis" inside "tardiness"
    'halogen lamp',                    // "halo" inside "halogen"
    'narrate the story',               // "narn" inside "narrate"
    'transporter belt logistics',      // "transporter" alone is too generic? we made it require room.
    'predator behavior in the wild',
    // Plain station vocabulary
    'check the airlock seals',
    'the station is humming',
    'mira nodded slowly',
  ].filter(s => s !== 'forces of habit'))('%s → no match', input => {
    expect(detectEasterEgg(input)).toBeUndefined();
  });

  it('"forces of habit" does not trigger star-wars (word boundary on "force")', () => {
    expect(detectEasterEgg('forces of habit')).toBeUndefined();
  });

  it('"the force is strong" DOES trigger star-wars', () => {
    expect(detectEasterEgg('the force is strong')?.id).toBe('star-wars');
  });
});

describe('detectEasterEgg — case insensitivity', () => {
  it.each(['LIGHTSABER', 'LightSaber', 'lightsaber'])('%s matches', s => {
    expect(detectEasterEgg(s)?.id).toBe('star-wars');
  });
});

describe('registry shape', () => {
  it('every egg has a non-empty id and hint', () => {
    for (const egg of SCIFI_EGGS) {
      expect(egg.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(egg.hint.length).toBeGreaterThan(10);
    }
  });
  it('all ids are unique', () => {
    const ids = SCIFI_EGGS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('getEasterEgg looks up by id', () => {
    expect(getEasterEgg('star-wars')?.detect.test('jedi')).toBe(true);
    expect(getEasterEgg('nope')).toBeUndefined();
  });
});
