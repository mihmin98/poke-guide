import { buildGameView } from '../../core/domain/game-view';
import { buildJourney } from '../../core/domain/journey';
import type { LocationItem, Milestone, VersionGroupData } from '../../core/domain/models';
import {
  testData,
  testEncounter,
  testLocation,
  testSpecies,
} from '../../core/domain/testing/test-data';
import { buildStory, type StoryInput } from './story-model';

const milestone = (no: number, part: number, extra: Partial<Milestone> = {}): Milestone => ({
  no,
  id: `m${no}`,
  label: `Milestone ${no}`,
  kind: 'event',
  part: { red: part },
  locationId: 'route-1',
  ...extra,
});

const item = (no: number): LocationItem => ({
  no,
  itemId: `item-${no}`,
  name: `Item ${no}`,
  quantity: 1,
  games: ['red'],
  obtain: 'pickup',
  subArea: null,
  where: '',
});

const data = testData({
  games: ['red'],
  species: [
    testSpecies(16, { name: 'Pidgey' }),
    testSpecies(129, { name: 'Magikarp' }),
    testSpecies(143, { name: 'Snorlax', slug: 'snorlax' }),
  ],
  walkthroughs: {
    red: [
      { part: 1, title: 'Pallet Town', region: 'kanto' },
      { part: 2, title: 'Route 1', region: 'kanto' },
    ],
  },
  unlocks: {
    red: [{ id: 'old-rod', label: 'Old Rod', kind: 'key-item', locationId: 'town', part: 2 }],
  },
  locations: [
    testLocation(
      'route-1',
      1,
      [testEncounter(16, ['red']), testEncounter(129, ['red'], { requires: ['old-rod'] })],
      ['red'],
      { name: 'Route 1', items: [item(1)] },
    ),
    testLocation('empty', 1, [], ['red'], {
      name: 'Empty',
      placement: { red: { part: 1, order: 101 } },
    }),
    testLocation('town', 2, [], ['red'], { name: 'Town', items: [item(2)] }),
  ],
  milestones: [
    milestone(1, 1),
    milestone(2, 2, { dex: 143, locationId: 'town' }),
    milestone(3, 2, { locationId: 'route-1', grants: ['old-rod'] }),
  ],
});

function story(extra: Partial<StoryInput> = {}, source: VersionGroupData = data) {
  const view = buildGameView(source, 'red');
  return buildStory({
    view,
    journey: buildJourney(view, 'red'),
    game: 'red',
    done: new Set(),
    caught: new Set(),
    itemsTaken: new Set(),
    hideDone: false,
    hideFinished: false,
    ...extra,
  });
}

describe('buildStory (plan §13.12, §13.13)', () => {
  it('interleaves milestones, the areas with something in them and what unlocks open', () => {
    const parts = story({ done: new Set([3]) });
    expect(parts.map((p) => [p.part, p.title, p.region, p.progress])).toEqual([
      [1, 'Pallet Town', 'kanto', { done: 0, total: 1 }],
      [2, 'Route 1', 'kanto', { done: 1, total: 2 }],
    ]);
    // "Empty" has neither Pokémon nor items, so it gets no row.
    expect(parts.map((p) => p.rows.map((r) => r.key))).toEqual([
      ['a-route-1', 'm1'],
      ['a-town', 'm2', 'm3', 'o2-3'],
    ]);
  });

  it('counts only what is reachable at the area, and says what comes later', () => {
    const area = story({ caught: new Set([16]), itemsTaken: new Set([1]) })[0]!.rows[0]!;
    expect(area).toMatchObject({
      kind: 'area',
      name: 'Route 1',
      species: [{ dex: 16, name: 'Pidgey', caught: true }],
      caught: 1,
      items: { taken: 1, total: 1 },
      later: 1,
      locks: ['Old Rod'],
      finished: true,
    });
  });

  it('links milestones to their location, revisits and species', () => {
    const rows = story()[1]!.rows;
    expect(rows[1]).toMatchObject({
      kind: 'milestone',
      location: { id: 'town', name: 'Town' },
      revisit: false,
      species: { name: 'Snorlax', slug: 'snorlax' },
    });
    expect(rows[2]).toMatchObject({ location: { id: 'route-1' }, revisit: true });
  });

  it("gives a static encounter's or gift's row its levels at the location (Phase 19)", () => {
    const snorlax = testEncounter(143, ['red'], {
      method: 'static',
      games: { red: [{ levels: { min: 30, max: 30 }, rate: { kind: 'once' } }] },
    });
    const source: VersionGroupData = {
      ...data,
      locations: data.locations.map((l) =>
        l.id === 'town'
          ? { ...l, subAreas: [{ id: 'main', name: null, encounters: [snorlax] }] }
          : l,
      ),
    };
    const rows = story({}, source).flatMap((p) => p.rows);
    expect(rows.find((r) => r.key === 'm2')).toMatchObject({ levels: { min: 30, max: 30 } });
    expect(rows.find((r) => r.key === 'm1')).toMatchObject({ levels: null });
  });

  it('lists only what an unlock opens that is still needed, and drops the callout when nothing is', () => {
    expect(story()[1]!.rows[3]).toEqual({
      kind: 'opens',
      key: 'o2-3',
      label: 'Old Rod',
      areas: [
        {
          id: 'route-1',
          name: 'Route 1',
          species: [{ dex: 129, name: 'Magikarp', caught: false }],
          items: 0,
        },
      ],
    });
    expect(story({ caught: new Set([129]) })[1]!.rows.map((r) => r.kind)).not.toContain('opens');
  });

  it('hides done milestones and finished areas, but keeps the part progress', () => {
    const parts = story({
      done: new Set([1, 2]),
      caught: new Set([16]),
      itemsTaken: new Set([1, 2]),
      hideDone: true,
      hideFinished: true,
    });
    expect(parts.map((p) => p.rows.map((r) => r.key))).toEqual([['m3', 'o2-3']]);
    expect(parts[0]!.progress).toEqual({ done: 1, total: 2 });
  });

  it('is empty for a game without milestones or locations', () => {
    expect(story({}, testData())).toEqual([]);
  });
});
