import type { GenerationFeatures } from '../games/types';
import { buildChecklist, maxInOneSave } from './obtainability';
import {
  testData as data,
  testEncounter as encounter,
  testLocation as location,
  testSpecies as species,
} from './testing/test-data';

const OFF: GenerationFeatures = {
  breeding: false,
  timeOfDay: false,
  dayOfWeek: false,
  seasons: false,
  heldItems: false,
  friendship: false,
  abilities: false,
};
const ON: GenerationFeatures = { ...OFF, breeding: true };

const red = { id: 'red' as const, nationalDexMax: 10 };
const entry = (entries: ReturnType<typeof buildChecklist>, dex: number) =>
  entries.find((e) => e.dex === dex)!;

describe('buildChecklist', () => {
  it('uses the later of the location part and required unlock parts, sorted by part', () => {
    const d = data({
      unlocks: { red: [{ id: 'surf', label: 'Surf', kind: 'move', locationId: 'b', part: 7 }] },
      locations: [
        location('a', 5, [encounter(1, ['red'], { requires: ['surf'] })]),
        location('b', 3, [encounter(1, ['red'])]),
      ],
    });
    expect(
      entry(buildChecklist(d, red, OFF), 1).sources.map((s) => [s.locationId, s.part]),
    ).toEqual([
      ['b', 3],
      ['a', 7],
    ]);
  });

  it('follows non-trade evolutions to a fixed point and inherits exclusive groups', () => {
    const d = data({
      evolutions: [
        { from: 1, to: 2, trigger: 'level', level: 16, requiresTrade: false },
        { from: 2, to: 3, trigger: 'level', level: 32, requiresTrade: false },
        { from: 2, to: 4, trigger: 'trade', requiresTrade: true },
        { from: 5, to: 6, trigger: 'level', requiresTrade: false, games: ['blue'] },
      ],
      locations: [
        location('lab', 1, [
          encounter(1, ['red'], { exclusiveGroupId: 'starter' }),
          encounter(5, ['red']),
        ]),
      ],
    });
    const entries = buildChecklist(d, red, OFF);
    expect(entry(entries, 3)).toMatchObject({ obtainable: true, exclusiveGroupIds: ['starter'] });
    expect(entry(entries, 3).sources[0]).toMatchObject({ kind: 'evolution', fromDex: 2, part: 1 });
    expect(entry(entries, 4)).toMatchObject({
      obtainable: false,
      unobtainableReason: 'trade-evolution',
      unobtainableDetail: 'Evolves from Mon2 by trade',
    });
    expect(entry(entries, 6).obtainable).toBe(false);
  });

  it('counts a trade only once the species given is obtainable, at the later part', () => {
    const d = data({
      locations: [
        location('gate', 2, [
          encounter(7, ['red'], { method: 'trade', trade: { giveDex: 8 } }),
          encounter(9, ['red'], { method: 'trade', trade: { giveDex: 10 } }),
        ]),
        location('route', 6, [encounter(8, ['red'])]),
      ],
    });
    const entries = buildChecklist(d, red, OFF);
    expect(entry(entries, 7).sources).toEqual([
      {
        kind: 'encounter',
        locationId: 'gate',
        subAreaId: 'main',
        method: 'trade',
        fromDex: 8,
        part: 6,
      },
    ]);
    expect(entry(entries, 9).obtainable).toBe(false);
  });

  it('gives event-only, other-version and not-in-game reasons', () => {
    const d = data({
      eventOnly: [3],
      locations: [location('route', 1, [encounter(1, ['blue']), encounter(3, ['blue'])])],
    });
    const entries = buildChecklist(d, red, OFF);
    expect(entry(entries, 1)).toMatchObject({
      unobtainableReason: 'other-version',
      unobtainableDetail: 'Available in blue',
    });
    expect(entry(entries, 3).unobtainableReason).toBe('event-only');
    expect(entry(entries, 2).unobtainableReason).toBe('not-in-game');
  });

  it('breeds the base of a family when a Day Care is reachable and a partner exists', () => {
    const d = data({
      species: [
        species(1, { eggGroups: ['monster'], genderRatio: 0.5 }),
        species(2, { eggGroups: ['monster'], genderRatio: 0.5 }),
        species(3, { eggGroups: ['undiscovered'], genderRatio: 'genderless' }),
        species(4, { eggGroups: ['undiscovered'] }),
        species(5, { eggGroups: ['mineral'], genderRatio: 'genderless' }),
        species(6, { eggGroups: ['mineral'], genderRatio: 'genderless' }),
        species(7, { eggGroups: ['ditto'], genderRatio: 'genderless' }),
      ],
      evolutions: [
        { from: 1, to: 2, trigger: 'level', requiresTrade: false },
        { from: 3, to: 4, trigger: 'level', requiresTrade: false },
        { from: 5, to: 6, trigger: 'level', requiresTrade: false },
      ],
      breeding: { dayCareLocationIds: ['day-care'], dittoDex: 7 },
      locations: [
        location('day-care', 4, []),
        location('route', 2, [encounter(2, ['red']), encounter(4, ['red']), encounter(6, ['red'])]),
      ],
    });
    const entries = buildChecklist(d, { id: 'red', nationalDexMax: 7 }, ON);
    expect(entry(entries, 1).sources).toEqual([{ kind: 'breeding', fromDex: 2, part: 4 }]);
    expect(entry(entries, 3).obtainable).toBe(false);
    expect(entry(entries, 5).obtainable).toBe(false);
    expect(entry(buildChecklist(d, { id: 'red', nationalDexMax: 7 }, OFF), 1).obtainable).toBe(
      false,
    );

    const withDitto = data({
      ...d,
      locations: [...d.locations, location('cave', 9, [encounter(7, ['red'])])],
    });
    expect(
      entry(buildChecklist(withDitto, { id: 'red', nationalDexMax: 7 }, ON), 5).sources,
    ).toEqual([{ kind: 'breeding', fromDex: 6, part: 9 }]);
  });
});

describe('maxInOneSave', () => {
  it('keeps one choice per exclusive group and subtracts the other families', () => {
    const group = (dex: number) =>
      encounter(dex, ['red'], { method: 'starter', exclusiveGroupId: 'starter' });
    const d = data({
      exclusiveGroups: [{ id: 'starter', label: 'Starter', games: ['red'], members: [1, 4, 7] }],
      evolutions: [
        { from: 1, to: 2, trigger: 'level', requiresTrade: false },
        { from: 2, to: 3, trigger: 'level', requiresTrade: false },
        { from: 4, to: 5, trigger: 'level', requiresTrade: false },
        { from: 7, to: 8, trigger: 'level', requiresTrade: false },
      ],
      // Mon5 is also wild, so keeping Mon4 loses nothing extra.
      locations: [
        location('lab', 1, [group(1), group(4), group(7)]),
        location('route', 2, [encounter(5, ['red'])]),
      ],
    });
    const entries = buildChecklist(d, red, OFF);
    expect(entries.filter((e) => e.obtainable)).toHaveLength(7);
    // Keeping Mon1 loses Mon4 and Mon7/8 (3); keeping Mon4 loses Mon1–3 and Mon7/8 (5); keeping Mon7 loses 4.
    expect(maxInOneSave(d, red, OFF, entries)).toBe(4);
    expect(maxInOneSave(d, { id: 'blue', nationalDexMax: 10 }, OFF)).toBe(0);
  });
});
