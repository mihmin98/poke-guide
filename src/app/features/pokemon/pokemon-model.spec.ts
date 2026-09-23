import { buildGameView } from '../../core/domain/game-view';
import type { EvolutionEdge, PokedexData } from '../../core/domain/models';
import { buildChecklist } from '../../core/domain/obtainability';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { evolutionDetailText } from '../../shared/evolution-text';
import { buildLearnset, buildPokemonView, entriesFor, genderText } from './pokemon-model';

function data() {
  return testData({
    games: ['red', 'blue'],
    species: [
      testSpecies(1, { name: 'Alpha', slug: 'alpha' }),
      testSpecies(2, { name: 'Beta', slug: 'beta' }),
      testSpecies(3, { name: 'Gamma', slug: 'gamma' }),
    ],
    evolutions: [
      { from: 1, to: 2, trigger: 'level', level: 16, requiresTrade: false },
      { from: 2, to: 3, trigger: 'trade', requiresTrade: true },
    ],
    locations: [
      testLocation('route-1', 1, [testEncounter(1, ['red'])], ['red', 'blue'], { name: 'Route 1' }),
      testLocation('route-2', 2, [testEncounter(1, ['blue'])], ['red', 'blue'], { name: 'Route 2' }),
    ],
  });
}

const POKEDEX: PokedexData = {
  schemaVersion: 1,
  versionGroupId: 'rby',
  builtAt: '',
  moves: [
    { id: 'tackle', name: 'Tackle', type: 'normal', power: 35, accuracy: 95, pp: 35 },
    { id: 'growl', name: 'Growl', type: 'normal', power: null, accuracy: 100, pp: 40 },
    { id: 'cut', name: 'Cut', type: 'normal', power: 50, accuracy: 95, pp: 30, machine: 'HM01' },
  ],
  learnsets: {
    '1': {
      levelUp: [
        { move: 'growl', levels: { red: 9, blue: 9 } },
        { move: 'tackle', levels: { red: 1, blue: 1 } },
      ],
      machines: ['cut'],
      prevo: [{ move: 'tackle', fromDex: [2], games: ['blue'] }],
      egg: ['growl'],
      tutor: [{ move: 'cut', games: ['blue'] }, { move: 'tackle' }],
    },
  },
  entries: {
    '1': [
      { games: ['blue'], text: 'A Blue entry.' },
      { games: ['red'], text: 'A Red entry.' },
    ],
  },
  sources: [],
};

const build = (key: string, game: 'red' | 'blue' = 'red') => {
  const raw = data();
  return buildPokemonView({
    data: raw,
    view: buildGameView(raw, game),
    game,
    key,
    entries: buildChecklist(raw, { id: game, nationalDexMax: 3 }, { breeding: false } as never),
  });
};

describe('Pokémon detail model (plan §13.7)', () => {
  it('finds a species by slug or by dex number, and nothing else', () => {
    expect(build('alpha')?.species.dex).toBe(1);
    expect(build('2')?.species.name).toBe('Beta');
    expect(build('missingno')).toBeUndefined();
  });

  it('lists the sources in this game and the places in the other ones', () => {
    const view = build('alpha')!;
    expect(view.obtainable).toBe(true);
    expect(view.sources[0]).toMatchObject({ label: 'Route 1', locationId: 'route-1', part: 1 });
    expect(view.otherGames).toHaveLength(1);
    expect(view.otherGames[0]!.game).toBe('blue');
    expect(view.otherGames[0]!.places[0]).toMatchObject({
      locationName: 'Route 2',
      methodLabel: 'Grass',
    });
  });

  it('explains a species you cannot get without trading', () => {
    const view = build('gamma')!;
    expect(view.obtainable).toBe(false);
    expect(view.unobtainableReason).toBe('trade-evolution');
    expect(view.unobtainableDetail).toBe('Evolves from Beta by trade');
  });

  it('walks the whole family from the root, whichever member you open', () => {
    for (const key of ['alpha', 'beta', 'gamma']) {
      expect(build(key)!.family).toEqual([
        {
          fromDex: 1,
          fromName: 'Alpha',
          toDex: 2,
          toName: 'Beta',
          detail: 'Lv 16',
          requiresTrade: false,
        },
        {
          fromDex: 2,
          fromName: 'Beta',
          toDex: 3,
          toName: 'Gamma',
          detail: 'Trade',
          requiresTrade: true,
        },
      ]);
    }
  });

  it('links the neighbouring species', () => {
    expect(build('beta')!.previous?.slug).toBe('alpha');
    expect(build('beta')!.next?.slug).toBe('gamma');
    expect(build('alpha')!.previous).toBeUndefined();
  });

  it('resolves the learnset for one game, in level order', () => {
    const red = buildLearnset(POKEDEX, 1, 'red', () => 'Beta');
    expect(red.levelUp.map((row) => [row.level, row.move.name])).toEqual([
      [1, 'Tackle'],
      [9, 'Growl'],
    ]);
    expect(red.machines.map((move) => move.machine)).toEqual(['HM01']);
    // The prior-evolution row is flagged Blue only.
    expect(red.prevo).toEqual([]);
    expect(buildLearnset(POKEDEX, 1, 'blue', () => 'Beta').prevo[0]!.from).toEqual(['Beta']);
    expect(red.egg.map((move) => move.name)).toEqual(['Growl']);
    // Tutor rows flagged for another game are left out.
    expect(red.tutor.map((move) => move.name)).toEqual(['Tackle']);
    expect(buildLearnset(POKEDEX, 2, 'red', () => '')).toEqual({
      levelUp: [],
      machines: [],
      prevo: [],
      egg: [],
      tutor: [],
    });
  });

  it('shows this game’s Pokédex entry first', () => {
    expect(entriesFor(POKEDEX, 1, 'red').map((e) => e.text)).toEqual([
      'A Red entry.',
      'A Blue entry.',
    ]);
    expect(entriesFor(undefined, 1, 'red')).toEqual([]);
  });
});

describe('evolution text', () => {
  const edge = (e: Partial<EvolutionEdge>): EvolutionEdge => ({
    from: 1,
    to: 2,
    trigger: 'level',
    requiresTrade: false,
    ...e,
  });

  it('describes Gen I and Gen II triggers', () => {
    expect(evolutionDetailText(edge({ level: 16 }))).toBe('Lv 16');
    expect(evolutionDetailText(edge({ trigger: 'item', item: 'Moon Stone' }))).toBe('Moon Stone');
    expect(evolutionDetailText(edge({ trigger: 'trade', requiresTrade: true }))).toBe('Trade');
    expect(
      evolutionDetailText(edge({ trigger: 'trade', heldItem: 'Metal Coat', requiresTrade: true })),
    ).toBe('Trade holding Metal Coat');
    expect(evolutionDetailText(edge({ trigger: 'friendship', timeOfDay: 'day' }))).toBe(
      'Friendship, day',
    );
    expect(evolutionDetailText(edge({ level: 20, stat: 'atk>def' }))).toBe(
      'Lv 20, Attack > Defense',
    );
  });
});

describe('gender text', () => {
  it('formats the female fraction', () => {
    expect(genderText(0.5)).toBe('50% ♂ · 50% ♀');
    expect(genderText(0.125)).toBe('87.5% ♂ · 12.5% ♀');
    expect(genderText(0)).toBe('Male only');
    expect(genderText(1)).toBe('Female only');
    expect(genderText('genderless')).toBe('Genderless');
  });
});
