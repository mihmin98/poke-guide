import type { Encounter, GameLocation, Unlock } from '../../../src/app/core/domain/models';
import type { WalkedRow } from './encounter-walker';
import {
  applyEncounterPatches,
  applyExclusiveGroups,
  checkEncounterRequirements,
  checkOverrideLocations,
  overrideRows,
  type EncounterOverrides,
} from './encounter-overrides';

const sourceOf = (title: string) => (title === 'Missing' ? null : { title, revid: 7 });
const overrides = (extra: Partial<EncounterOverrides>): EncounterOverrides => ({
  encounters: [],
  patches: [],
  exclusiveGroups: [],
  eventOnly: [],
  ...extra,
});

const row = (dex: number, method: string, label: string | null = null): WalkedRow => ({
  row: { dex, name: `#${dex}`, rawMethod: method, games: ['red'], slots: [], types: [] },
  method,
  requires: [],
  subArea: null,
  label,
});

const location = (id: string, encounters: Encounter[]): GameLocation => ({
  id,
  name: id,
  region: 'kanto',
  kind: 'building',
  placement: {},
  source: { title: id, revid: 1 },
  notes: [],
  subAreas: [{ id: 'main', name: null, encounters }],
  items: [],
  itemNotes: [],
});
const once = [{ levels: null, rate: { kind: 'once' as const } }];

describe('overrideRows', () => {
  it('builds once-only rows for the location, skipping missing source pages', () => {
    const base = {
      dex: 143,
      name: 'Snorlax',
      method: 'static',
      games: ['red' as const],
      level: 30,
      reason: 'prose',
    };
    const rows = overrideRows(
      'route-12',
      'Kanto Route 12',
      overrides({
        encounters: [
          { ...base, locationId: 'route-12', requires: ['poke-flute'], note: 'Asleep' },
          { ...base, locationId: 'route-16' },
          { ...base, locationId: 'route-12', sourcePage: 'Missing' },
        ],
      }),
      sourceOf,
    );
    expect(rows).toEqual([
      {
        row: {
          dex: 143,
          name: 'Snorlax',
          rawMethod: 'static',
          games: ['red'],
          slots: [
            {
              levels: { min: 30, max: 30 },
              rawLevels: '30',
              rate: { kind: 'once' },
              note: 'Asleep',
            },
          ],
          types: [],
        },
        method: 'static',
        requires: ['poke-flute'],
        subArea: null,
        label: null,
      },
    ]);
  });

  it('carries conditions onto the slot', () => {
    const [lapras] = overrideRows(
      'union-cave',
      'Union Cave',
      overrides({
        encounters: [
          {
            locationId: 'union-cave',
            dex: 131,
            name: 'Lapras',
            method: 'static',
            games: ['gold'],
            level: 20,
            conditions: [{ kind: 'day-of-week', value: 'fri' }],
            reason: 'prose',
          },
        ],
      }),
      sourceOf,
    );
    expect(lapras!.row.slots[0]!.conditions).toEqual([{ kind: 'day-of-week', value: 'fri' }]);
  });

  it('carries fixed DVs and shininess onto the slot', () => {
    const [gyarados] = overrideRows(
      'lake-of-rage',
      'Lake of Rage',
      overrides({
        encounters: [
          {
            locationId: 'lake-of-rage',
            dex: 130,
            name: 'Gyarados',
            method: 'static',
            games: ['gold'],
            level: 30,
            ivs: { hp: 0, atk: 14, def: 10, spe: 10, spc: 10 },
            shiny: 'guaranteed',
            reason: 'prose',
          },
        ],
      }),
      sourceOf,
    );
    expect(gyarados!.row.slots[0]).toMatchObject({
      ivs: { kind: 'fixed', values: { hp: 0, atk: 14, def: 10, spe: 10, spc: 10 } },
      shiny: 'guaranteed',
    });
  });
});

describe('applyEncounterPatches', () => {
  it('changes or drops matching rows and reports patches that match nothing', () => {
    const result = applyEncounterPatches(
      'oaks-lab',
      "Professor Oak's Laboratory",
      [
        row(1, 'gift', 'First partner Pokémon'),
        row(25, 'special', 'Attacking Oak'),
        row(133, 'gift'),
      ],
      overrides({
        patches: [
          {
            locationId: 'oaks-lab',
            match: { method: 'gift', label: 'First partner Pokémon' },
            set: { method: 'starter', label: null },
            reason: 'choice',
          },
          {
            locationId: 'oaks-lab',
            match: { method: 'special', dex: 25 },
            set: 'drop',
            reason: 'duplicate',
          },
          { locationId: 'oaks-lab', match: { method: 'static' }, set: 'drop', reason: 'typo' },
          {
            locationId: 'route-1',
            match: { method: 'gift' },
            set: 'drop',
            reason: 'other location',
          },
        ],
      }),
      sourceOf,
    );
    expect(result.errors).toEqual([
      'Encounter patch for {"method":"static"} in oaks-lab matches no rows',
    ]);
    expect(result.rows.map((r) => [r.row.dex, r.method, r.label])).toEqual([
      [1, 'starter', null],
      [133, 'gift', null],
    ]);
  });

  it('replaces the requirements of matching rows', () => {
    const result = applyEncounterPatches(
      'dragons-den',
      "Dragon's Den",
      [row(147, 'gift'), row(147, 'surf')],
      overrides({
        patches: [
          {
            locationId: 'dragons-den',
            match: { method: 'gift', dex: 147 },
            set: { requires: ['surf', 'whirlpool'] },
            reason: 'shrine',
          },
        ],
      }),
      sourceOf,
    );
    expect(result.rows.map((r) => [r.method, r.requires])).toEqual([
      ['gift', ['surf', 'whirlpool']],
      ['surf', []],
    ]);
  });

  it('matches rows by their games and replaces the levels of every slot', () => {
    const slot = (value: number) => ({
      levels: { min: 8, max: 8 },
      rawLevels: '8',
      rate: { kind: 'percent' as const, value },
    });
    const venonat = (games: WalkedRow['row']['games']): WalkedRow => ({
      ...row(48, 'walk-grass'),
      row: { ...row(48, 'walk-grass').row, games, slots: [slot(5), slot(30)] },
    });
    const result = applyEncounterPatches(
      'route-24',
      'Kanto Route 24',
      [venonat(['gold', 'silver']), venonat(['crystal'])],
      overrides({
        patches: [
          {
            locationId: 'route-24',
            match: { method: 'walk-grass', dex: 48, games: ['crystal'] },
            set: { levels: { min: 10, max: 10 } },
            reason: 'pret',
          },
        ],
      }),
      sourceOf,
    );
    expect(
      result.rows.map((r) => [r.row.games, r.row.slots.map((s) => [s.levels, s.rawLevels])]),
    ).toEqual([
      [
        ['gold', 'silver'],
        [
          [{ min: 8, max: 8 }, '8'],
          [{ min: 8, max: 8 }, '8'],
        ],
      ],
      [
        ['crystal'],
        [
          [{ min: 10, max: 10 }, '10'],
          [{ min: 10, max: 10 }, '10'],
        ],
      ],
    ]);
  });
});

describe('checkOverrideLocations', () => {
  it('reports unknown locations', () => {
    expect(
      checkOverrideLocations(
        overrides({
          encounters: [
            {
              locationId: 'nowhere',
              dex: 150,
              name: 'Mewtwo',
              method: 'static',
              games: ['red'],
              level: 70,
              reason: 'x',
            },
          ],
          exclusiveGroups: [
            {
              id: 'g',
              label: 'G',
              games: ['red'],
              members: [1],
              locationIds: ['lab'],
              methods: ['starter'],
            },
          ],
        }),
        new Set(['oaks-lab']),
      ),
    ).toEqual([
      'Encounter override #150 Mewtwo names unknown location "nowhere"',
      'Encounter override g names unknown location "lab"',
    ]);
  });
});

describe('applyExclusiveGroups', () => {
  it('tags members in the group’s games and reports members missing in a game', () => {
    const locations = [
      location('oaks-lab', [
        { dex: 1, method: 'starter', games: { red: once, blue: once } },
        { dex: 4, method: 'starter', games: { red: once } },
        { dex: 25, method: 'starter', games: { yellow: once } },
      ]),
    ];
    const errors = applyExclusiveGroups(locations, [
      {
        id: 'rby-starter',
        label: 'Starter',
        games: ['red', 'blue'],
        members: [1, 4],
        locationIds: ['oaks-lab'],
        methods: ['starter'],
      },
    ]);
    expect(errors).toEqual(['Exclusive group rby-starter: no encounter for #4 in blue']);
    expect(locations[0]!.subAreas[0]!.encounters.map((e) => e.exclusiveGroupId ?? null)).toEqual([
      'rby-starter',
      'rby-starter',
      null,
    ]);
  });
});

describe('checkEncounterRequirements', () => {
  it('reports requirements that are not unlocks in every game of the encounter', () => {
    const flute: Unlock = {
      id: 'poke-flute',
      label: 'Poké Flute',
      kind: 'key-item',
      locationId: 'pokemon-tower',
      part: 9,
    };
    const locations = [
      location('route-12', [
        {
          dex: 143,
          method: 'static',
          games: { red: once, yellow: once },
          requires: ['poke-flute'],
        },
      ]),
    ];
    expect(checkEncounterRequirements(locations, { red: [flute] })).toEqual([
      '#143 in route-12 requires "poke-flute", which is not an unlock in yellow',
    ]);
  });
});
