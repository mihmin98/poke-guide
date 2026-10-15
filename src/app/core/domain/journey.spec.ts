import { buildGameView } from './game-view';
import { buildJourney, milestoneContext, type JourneyPart } from './journey';
import type { GameLocation, LocationItem, Milestone } from './models';
import { testData, testEncounter, testLocation } from './testing/test-data';

function location(
  id: string,
  part: number,
  order: number,
  extra: Partial<GameLocation> = {},
): GameLocation {
  return testLocation(id, part, extra.subAreas?.[0]?.encounters ?? [], ['red'], {
    placement: { red: { part, order: part * 100 + order } },
    ...extra,
  });
}

function item(no: number, extra: Partial<LocationItem> = {}): LocationItem {
  return {
    no,
    itemId: `item-${no}`,
    name: `Item ${no}`,
    quantity: 1,
    games: ['red'],
    obtain: 'pickup',
    subArea: null,
    where: '',
    ...extra,
  };
}

function milestone(
  no: number,
  id: string,
  part: number,
  locationId: string,
  extra: Partial<Milestone> = {},
): Milestone {
  return { no, id, label: id, kind: 'event', part: { red: part }, locationId, ...extra };
}

function encounters(...list: Parameters<typeof testEncounter>[]): GameLocation['subAreas'] {
  return [{ id: 'main', name: null, encounters: list.map((args) => testEncounter(...args)) }];
}

function journey(locations: GameLocation[], milestones: Milestone[]): JourneyPart[] {
  const data = testData({
    games: ['red'],
    locations,
    milestones,
    walkthroughs: {
      red: [1, 2, 3].map((part) => ({ part, title: `Title ${part}`, region: 'kanto' as const })),
    },
  });
  return buildJourney(buildGameView(data, 'red'), 'red');
}

/** `area:id`, `m:id` (`m:id↩` for a revisit) and `opens:area+area`, per part. */
function shape(parts: JourneyPart[]): string[][] {
  return parts.map((p) =>
    p.steps.map((s) => {
      if (s.kind === 'area') return `area:${s.location.id}`;
      if (s.kind === 'milestone') return `m:${s.milestone.id}${s.revisit ? '↩' : ''}`;
      return `opens:${s.areas.map((a) => a.location.id).join('+')}`;
    }),
  );
}

describe('buildJourney', () => {
  it('keeps both the milestone order and the location order within a part', () => {
    // Saffron City, Fighting Dojo, Silph Co.: Sabrina (Saffron) comes after Silph Co.
    const parts = journey(
      [location('saffron', 1, 0), location('dojo', 1, 1), location('silph', 1, 2)],
      [
        milestone(1, 'drink', 1, 'saffron'),
        milestone(2, 'giovanni', 1, 'silph'),
        milestone(3, 'karate', 1, 'dojo'),
        milestone(4, 'sabrina', 1, 'saffron'),
      ],
    );
    expect(shape(parts)).toEqual([
      ['area:saffron', 'm:drink', 'area:dojo', 'area:silph', 'm:giovanni', 'm:karate', 'm:sabrina'],
    ]);
    expect(parts[0]).toMatchObject({ part: 1, title: 'Title 1', region: 'kanto' });
  });

  it('places a revisit after the previous step, or after its anchor', () => {
    const locations = [
      location('route-2', 1, 0),
      location('route-11', 2, 0),
      location('cave', 2, 1),
      location('museum', 2, 2),
    ];
    expect(shape(journey(locations, [milestone(1, 'flash', 2, 'route-2')]))[1]).toEqual([
      'm:flash↩',
      'area:route-11',
      'area:cave',
      'area:museum',
    ]);
    expect(
      shape(journey(locations, [milestone(1, 'flash', 2, 'route-2', { after: 'cave' })]))[1],
    ).toEqual(['area:route-11', 'area:cave', 'm:flash↩', 'area:museum']);
  });

  it('counts only what is reachable with the unlocks granted so far, and lists the locks', () => {
    const parts = journey(
      [
        location('lake', 1, 0, {
          subAreas: encounters(
            [1, ['red']],
            [2, ['red'], { requires: ['surf'] }],
            [1, ['red'], { requires: ['surf'] }],
          ),
          items: [item(10), item(11, { requires: [['cut', 'surf']] })],
        }),
        location('city', 2, 0),
      ],
      [milestone(1, 'get-surf', 2, 'city', { grants: ['surf'] })],
    );
    const lake = parts[0]!.steps[0]!;
    expect(lake).toMatchObject({
      kind: 'area',
      reach: { dex: [1], laterDex: [2], items: [10], laterItems: [11], locks: ['surf', 'cut'] },
    });
    // Surf opens the lake's Pokémon and its Cut-or-Surf item, and only those.
    expect(parts[1]!.steps[2]).toEqual({
      kind: 'opens',
      milestone: expect.objectContaining({ id: 'get-surf' }),
      unlocks: ['surf'],
      areas: [{ location: expect.objectContaining({ id: 'lake' }), dex: [2], items: [11] }],
    });
  });

  it('needs every AND group of an item held', () => {
    const parts = journey(
      [location('cave', 1, 0, { items: [item(5, { requires: [['flash'], ['strength']] })] })],
      [
        milestone(1, 'flash', 1, 'cave', { grants: ['flash'] }),
        milestone(2, 'strength', 1, 'cave', { grants: ['strength'] }),
      ],
    );
    expect(shape(parts)).toEqual([['area:cave', 'm:flash', 'm:strength', 'opens:cave']]);
  });

  it('opens nothing for areas not reached yet; their own card shows the content', () => {
    const parts = journey(
      [
        location('city', 1, 0),
        location('lake', 2, 0, { subAreas: encounters([2, ['red'], { requires: ['surf'] }]) }),
      ],
      [milestone(1, 'get-surf', 1, 'city', { grants: ['surf'] })],
    );
    expect(shape(parts)).toEqual([['area:city', 'm:get-surf'], ['area:lake']]);
    expect(parts[1]!.steps[0]).toMatchObject({ reach: { dex: [2], laterDex: [] } });
  });

  it('releases a later-part item at the first milestone of that part at its location', () => {
    const viridian = location('viridian', 1, 0, { items: [item(7, { fromPart: { red: 3 } })] });
    const parts = journey(
      [viridian, location('plant', 3, 0)],
      [milestone(1, 'zapdos', 3, 'plant'), milestone(2, 'giovanni', 3, 'viridian')],
    );
    expect(parts[0]!.steps[0]).toMatchObject({ reach: { items: [], laterItems: [7], locks: [] } });
    expect(shape(parts)[1]).toEqual(['area:plant', 'm:zapdos', 'm:giovanni↩', 'opens:viridian']);
    expect(parts[1]!.steps[3]).toMatchObject({ unlocks: [], areas: [{ items: [7] }] });
  });

  it('releases a later-part item at the end of its part when no milestone there is at its location', () => {
    const parts = journey(
      [
        location('viridian', 1, 0, { items: [item(7, { fromPart: { red: 2 } })] }),
        location('plant', 2, 0),
      ],
      [milestone(1, 'zapdos', 2, 'plant')],
    );
    expect(shape(parts)[1]).toEqual(['area:plant', 'm:zapdos', 'opens:viridian']);
    expect(parts[1]!.steps[2]).not.toHaveProperty('milestone');
  });

  it('ignores other games and drops parts with nothing in them', () => {
    const parts = journey(
      [
        location('only', 3, 0, {
          subAreas: encounters([1, ['blue']]),
          items: [item(1, { games: ['blue'] })],
        }),
      ],
      [],
    );
    expect(parts.map((p) => p.part)).toEqual([3]);
    expect(parts[0]!.steps[0]).toMatchObject({ reach: { dex: [], items: [] } });
  });
});

describe('milestoneContext', () => {
  const parts = journey(
    [location('a', 1, 0), location('b', 1, 1), location('c', 2, 0)],
    [milestone(1, 'first', 1, 'a'), milestone(2, 'second', 2, 'c')],
  );

  it('gives the milestones just before and after an area', () => {
    expect(milestoneContext(parts, 'b')).toEqual({
      part: 1,
      previous: expect.objectContaining({ id: 'first' }),
      next: expect.objectContaining({ id: 'second' }),
    });
    expect(milestoneContext(parts, 'a')).toEqual({
      part: 1,
      next: expect.objectContaining({ id: 'first' }),
    });
    expect(milestoneContext(parts, 'c')).toEqual({
      part: 2,
      previous: expect.objectContaining({ id: 'first' }),
      next: expect.objectContaining({ id: 'second' }),
    });
  });

  it('is undefined for a location not in the journey', () => {
    expect(milestoneContext(parts, 'nowhere')).toBeUndefined();
  });
});
