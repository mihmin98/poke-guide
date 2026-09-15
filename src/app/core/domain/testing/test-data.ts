// FRAMEWORK-FREE: synthetic version-group data builders for unit tests. No Angular imports.
import type { Encounter, GameLocation, Species, VersionGroupData } from '../models';

export const ONCE = [{ levels: { min: 5, max: 5 }, rate: { kind: 'once' as const } }];

export function testSpecies(dex: number, extra: Partial<Species> = {}): Species {
  return {
    dex,
    name: `Mon${dex}`,
    slug: `mon${dex}`,
    types: ['normal'],
    catchRate: 45,
    baseStats: {},
    category: 'Test',
    heightM: 1,
    weightKg: 1,
    baseExp: 50,
    growthRate: 'fast',
    ...extra,
  };
}

export function testEncounter(
  dex: number,
  games: string[],
  extra: Partial<Encounter> = {},
): Encounter {
  return {
    dex,
    method: 'walk-grass',
    games: Object.fromEntries(games.map((g) => [g, ONCE])),
    ...extra,
  };
}

export function testLocation(
  id: string,
  part: number,
  encounters: Encounter[],
  games = ['red', 'blue'],
  extra: Partial<GameLocation> = {},
): GameLocation {
  return {
    id,
    name: id,
    region: 'kanto',
    kind: 'route',
    placement: Object.fromEntries(games.map((g, i) => [g, { part, order: part * 100 + i }])),
    source: { title: id, revid: 1 },
    notes: [],
    subAreas: [{ id: 'main', name: null, encounters }],
    items: [],
    itemNotes: [],
    ...extra,
  };
}

export function testData(extra: Partial<VersionGroupData> = {}): VersionGroupData {
  return {
    schemaVersion: 1,
    versionGroupId: 'rby',
    generation: 1,
    games: ['red', 'blue'],
    builtAt: '',
    types: ['normal'],
    species: Array.from({ length: 10 }, (_, i) => testSpecies(i + 1)),
    evolutions: [],
    breeding: null,
    walkthroughs: {},
    unlocks: {},
    exclusiveGroups: [],
    eventOnly: [],
    locations: [],
    sources: [],
    ...extra,
  };
}
