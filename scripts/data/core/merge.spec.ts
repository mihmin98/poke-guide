import type { GameId } from '../../../src/app/core/domain/models';
import type { RawEncounterRow } from '../adapters/catch-template-adapter';
import { entry1Adapter } from '../adapters/entry1';
import { fixture } from '../testing/fixtures';
import { walkEncounterSection, type WalkedRow } from './encounter-walker';
import { mergeRows } from './merge';

const RBY: GameId[] = ['red', 'blue', 'yellow'];

function merged(name: string, locationKind: 'route' | 'cave' | 'building' | 'special' | 'town' = 'route') {
  const page = fixture('rby', name);
  const { rows } = walkEncounterSection(page.wikitext, {
    pageTitle: page.resolvedTitle,
    generationHeading: 'Generation I',
    locationKind,
    adapters: [entry1Adapter],
  });
  return mergeRows(rows, RBY);
}

describe('mergeRows on fixtures', () => {
  it('builds per-game slots (Route 1 golden values)', () => {
    const [main] = merged('route-1');
    expect(main?.id).toBe('main');
    const pidgey = main!.encounters.find((e) => e.dex === 16)!;
    expect(pidgey.games).toEqual({
      red: [{ levels: { min: 2, max: 5 }, rate: { kind: 'percent', value: 50 } }],
      blue: [{ levels: { min: 2, max: 5 }, rate: { kind: 'percent', value: 50 } }],
      yellow: [{ levels: { min: 2, max: 7 }, rate: { kind: 'percent', value: 70 } }],
    });
    expect(main!.encounters.find((e) => e.dex === 25)).toMatchObject({ method: 'special', label: 'Attacking Oak' });
  });

  it('creates sub-areas with slug ids (Safari Zone golden: Scyther Red-only, Pinsir Blue-only)', () => {
    const areas = merged('safari-zone', 'special');
    expect(areas.map((a) => a.id)).toEqual(['center-area', 'area-1-east', 'area-2-north', 'area-3-west']);
    const center = areas[0]!.encounters;
    expect(Object.keys(center.find((e) => e.dex === 123)!.games)).toEqual(['red']);
    expect(Object.keys(center.find((e) => e.dex === 127)!.games)).toEqual(['blue']);
  });

  it('keeps floor sub-areas (Pokémon Tower golden: 3F Gastly Lv 18–24 in Red/Blue)', () => {
    const floor3 = merged('pokemon-tower', 'building').find((a) => a.id === '3f')!;
    expect(floor3.name).toBe('3F');
    expect(floor3.encounters.find((e) => e.dex === 92)!.games.red).toEqual([
      { levels: { min: 18, max: 24 }, rate: { kind: 'percent', value: 90 } },
    ]);
  });

  it('separates methods for the same species and records unlock requirements (Route 12 Goldeen)', () => {
    const goldeen = merged('route-12')[0]!.encounters.filter((e) => e.dex === 118);
    expect(goldeen.map((e) => [e.method, e.requires])).toEqual([
      ['fish-good', ['good-rod']],
      ['fish-super', ['super-rod']],
    ]);
  });

  it('keeps traded species on trade encounters (Cerulean City)', () => {
    const jynx = merged('cerulean-city', 'town')[0]!.encounters.find((e) => e.method === 'trade');
    expect(jynx).toMatchObject({ dex: 124, trade: { giveDex: 61 }, games: { red: [{ levels: null, rate: { kind: 'once' } }] } });
  });
});

describe('mergeRows rules', () => {
  const row = (games: GameId[], levels: [number, number], percent: number): WalkedRow => {
    const raw: RawEncounterRow = {
      dex: 118,
      name: 'Goldeen',
      rawMethod: 'Fish Super',
      games,
      types: ['water'],
      slots: [{ levels: { min: levels[0], max: levels[1] }, rawLevels: '', rate: { kind: 'percent', value: percent } }],
    };
    return { row: raw, method: 'fish-super', requires: ['super-rod'], subArea: null, label: null };
  };

  it('unions levels and adds rates of split rows for the same game', () => {
    const [area] = mergeRows([row(['yellow'], [20, 25], 60), row(['yellow'], [30, 30], 30.5)], RBY);
    expect(area!.encounters[0]!.games.yellow).toEqual([
      { levels: { min: 20, max: 30, values: [20, 21, 22, 23, 24, 25, 30] }, rate: { kind: 'percent', value: 90.5 } },
    ]);
  });

  it('ignores games outside the version group and drops empty encounters', () => {
    expect(mergeRows([row(['crystal'], [5, 5], 10)], RBY)).toEqual([]);
  });
});
