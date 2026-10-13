import { buildGameView } from '../../core/domain/game-view';
import type { Milestone } from '../../core/domain/models';
import { testData, testLocation, testSpecies } from '../../core/domain/testing/test-data';
import { buildStory } from './story-model';

const milestone = (no: number, part: number, extra: Partial<Milestone> = {}): Milestone => ({
  no,
  id: `m${no}`,
  label: `Milestone ${no}`,
  kind: 'event',
  part: { red: part },
  locationId: 'route-1',
  ...extra,
});

const data = testData({
  games: ['red'],
  species: [testSpecies(143, { name: 'Snorlax', slug: 'snorlax' })],
  walkthroughs: {
    red: [
      { part: 1, title: 'Pallet Town', region: 'kanto' },
      { part: 2, title: 'Route 1', region: 'kanto' },
    ],
  },
  locations: [testLocation('route-1', 1, [], ['red'], { name: 'Route 1' })],
  milestones: [
    milestone(1, 1),
    milestone(2, 2, { dex: 143 }),
    milestone(3, 1, { locationId: 'gone' }),
  ],
});
const view = buildGameView(data, 'red');

describe('buildStory (plan §13.12)', () => {
  it('groups milestones by part with titles, links and progress', () => {
    const parts = buildStory({ view, game: 'red', done: new Set([3]), hideDone: false });
    expect(parts.map((p) => [p.part, p.title, p.region, p.progress])).toEqual([
      [1, 'Pallet Town', 'kanto', { done: 1, total: 2 }],
      [2, 'Route 1', 'kanto', { done: 0, total: 1 }],
    ]);
    expect(parts[0]!.rows.map((r) => [r.milestone.no, r.done, r.location])).toEqual([
      [1, false, { id: 'route-1', name: 'Route 1' }],
      [3, true, undefined],
    ]);
    expect(parts[1]!.rows[0]!.species).toEqual({ name: 'Snorlax', slug: 'snorlax' });
  });

  it('hides done milestones and the parts that leaves empty, but keeps their progress', () => {
    const parts = buildStory({ view, game: 'red', done: new Set([2, 3]), hideDone: true });
    expect(parts.map((p) => p.part)).toEqual([1]);
    expect(parts[0]!.rows.map((r) => r.milestone.no)).toEqual([1]);
    expect(parts[0]!.progress).toEqual({ done: 1, total: 2 });
  });

  it('is empty for a game without milestones', () => {
    expect(
      buildStory({
        view: buildGameView(testData(), 'red'),
        game: 'red',
        done: new Set(),
        hideDone: false,
      }),
    ).toEqual([]);
  });
});
