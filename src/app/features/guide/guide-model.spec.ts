import { buildGameView } from '../../core/domain/game-view';
import type { Encounter, VersionGroupData } from '../../core/domain/models';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import type { EncounterMethodCategory } from '../../core/games/methods';
import { buildGuide, categoriesIn, locationIcon, type GuideFilters } from './guide-model';

const NO_FILTERS: GuideFilters = {
  search: '',
  hideCompleted: false,
  onlyAvailable: false,
  categories: new Set(),
  showEmpty: false,
};

function surf(dex: number): Encounter {
  return testEncounter(dex, ['red'], { method: 'surf', requires: ['surf-hm'] });
}

function data(): VersionGroupData {
  return testData({
    games: ['red'],
    species: [
      testSpecies(16, { name: 'Pidgey' }),
      testSpecies(19, { name: 'Rattata' }),
      testSpecies(72, { name: 'Tentacool' }),
    ],
    walkthroughs: {
      red: [
        { part: 1, title: 'Pallet Town to Viridian', region: 'kanto' },
        { part: 2, title: 'Route 22', region: 'kanto' },
      ],
    },
    unlocks: {
      red: [{ id: 'surf-hm', label: 'Surf', kind: 'move', locationId: 'route-1', part: 12 }],
    },
    locations: [
      testLocation('route-1', 1, [testEncounter(16, ['red']), testEncounter(19, ['red'])], ['red']),
      testLocation('route-22', 2, [testEncounter(16, ['red']), surf(72)], ['red'], {
        name: 'Route 22',
      }),
      testLocation('empty-town', 2, [], ['red'], { name: 'Pewter City', kind: 'town' }),
    ],
  });
}

const view = () => buildGameView(data(), 'red');

const guide = (filters: Partial<GuideFilters> = {}, caught: number[] = [], progressPart?: number) =>
  buildGuide({
    view: view(),
    game: 'red',
    caught: new Set(caught),
    ...(progressPart === undefined ? {} : { progressPart }),
    filters: { ...NO_FILTERS, ...filters },
  });

describe('guide model (plan §13.4)', () => {
  it('groups locations into walkthrough parts with their titles and counts', () => {
    const parts = guide({}, [16]);
    expect(parts.map((p) => p.part)).toEqual([1, 2]);
    expect(parts[0]!.title).toBe('Pallet Town to Viridian');
    expect(parts[0]!.locations.map((l) => l.id)).toEqual(['route-1']);
    expect(parts[0]).toMatchObject({ caught: 1, total: 2 });
    expect(parts[1]!.locations[0]).toMatchObject({ name: 'Route 22', caught: 1, total: 2 });
  });

  it('drops locations with no encounters unless empty ones are shown', () => {
    expect(guide().flatMap((p) => p.locations.map((l) => l.id))).not.toContain('empty-town');
    const withEmpty = guide({ showEmpty: true }).flatMap((p) => p.locations.map((l) => l.id));
    expect(withEmpty).toContain('empty-town');
  });

  it('marks a location complete only when every species there is caught', () => {
    const [first] = guide({}, [16, 19]);
    expect(first!.locations[0]!.complete).toBe(true);
    expect(guide({ hideCompleted: true }, [16, 19]).flatMap((p) => p.locations)).toHaveLength(1);
  });

  it('searches location names and the species found there', () => {
    expect(guide({ search: 'route 22' }).flatMap((p) => p.locations.map((l) => l.id))).toEqual([
      'route-22',
    ]);
    expect(guide({ search: 'tentacool' }).flatMap((p) => p.locations.map((l) => l.id))).toEqual([
      'route-22',
    ]);
    expect(guide({ search: 'nothing here' })).toEqual([]);
  });

  it('filters by method category, and counts only the encounters left', () => {
    const categories = new Set<EncounterMethodCategory>(['water']);
    const parts = guide({ categories });
    expect(parts.flatMap((p) => p.locations.map((l) => l.id))).toEqual(['route-22']);
    expect(parts[0]!.locations[0]!.species.map((s) => s.name)).toEqual(['Tentacool']);
  });

  it('shows the unlock an encounter needs, and locks it when it comes later than your part', () => {
    const early = guide({}, [], 3)
      .flatMap((p) => p.locations)
      .find((l) => l.id === 'route-22');
    expect(early!.requirements).toEqual([{ id: 'surf-hm', label: 'Surf', locked: true }]);
    const late = guide({}, [], 12)
      .flatMap((p) => p.locations)
      .find((l) => l.id === 'route-22');
    expect(late!.requirements[0]!.locked).toBe(false);
  });

  it('hides later parts when only what is available now is wanted', () => {
    expect(guide({ onlyAvailable: true }, [], 1).map((p) => p.part)).toEqual([1]);
    expect(guide({ onlyAvailable: true }, [], 2).map((p) => p.part)).toEqual([1, 2]);
    // Without a progress part the filter can't apply, so nothing is hidden.
    expect(guide({ onlyAvailable: true }).map((p) => p.part)).toEqual([1, 2]);
  });

  it('lists the encounter categories the game actually has, in registry order', () => {
    expect(categoriesIn(view(), 'red')).toEqual(['wild', 'water']);
  });

  it('gives every location kind an icon', () => {
    expect(locationIcon('cave')).toBe('landscape');
    expect(locationIcon('town')).toBe('location_city');
  });
});
