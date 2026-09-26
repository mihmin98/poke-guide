import type { GameLocation, LocationItem, Unlock } from '../../../src/app/core/domain/models';
import {
  applyItemOverrides,
  checkItemRequirements,
  diffWalkthroughItems,
  type ItemOverrides,
} from './location-items';
import { slugify } from './slug';

const item = (name: string, extra: Partial<LocationItem> = {}): LocationItem => ({
  no: 0,
  itemId: slugify(name),
  name,
  quantity: 1,
  games: ['red', 'blue', 'yellow'],
  obtain: 'pickup',
  subArea: null,
  where: 'Somewhere',
  ...extra,
});

const location = (id: string, items: LocationItem[], part = 1): GameLocation => ({
  id,
  name: id,
  region: 'kanto',
  kind: 'route',
  placement: {
    red: { part, order: part * 100 },
    blue: { part, order: part * 100 },
    yellow: { part, order: part * 100 },
  },
  source: { title: id, revid: 1 },
  notes: [],
  subAreas: [],
  items,
  itemNotes: [],
});

const sourceOf = (title: string) => (title === 'Missing' ? null : { title, revid: 42 });
const overrides = (extra: Partial<ItemOverrides>): ItemOverrides => ({
  requirementPhrases: {},
  add: [],
  requires: [],
  choiceGroups: [],
  ...extra,
});

describe('applyItemOverrides', () => {
  it('adds items with their source, and rejects duplicates, unknown locations and missing pages silently', () => {
    const locations = [location('pewter-city', [item('Potion')])];
    const gymTm = {
      name: 'TM34 Bide',
      quantity: 1,
      games: ['red' as const],
      obtain: 'reward' as const,
      subArea: 'Gym',
      where: 'From Brock',
    };
    const errors = applyItemOverrides(
      locations,
      overrides({
        add: [
          { locationId: 'pewter-city', item: gymTm, sourcePage: 'Walkthrough', reason: 'Gym' },
          {
            locationId: 'pewter-city',
            item: { ...gymTm, name: 'Potion' },
            sourcePage: 'Walkthrough',
            reason: 'dup',
          },
          { locationId: 'nowhere', item: gymTm, sourcePage: 'Walkthrough', reason: 'typo' },
          {
            locationId: 'pewter-city',
            item: { ...gymTm, name: 'Ether' },
            sourcePage: 'Missing',
            reason: 'gone',
          },
        ],
      }),
      sourceOf,
    );
    expect(errors).toEqual([
      'Item override adds Potion to pewter-city, but the page already lists it',
      'Item override for TM34 Bide names unknown location "nowhere"',
    ]);
    expect(locations[0]!.items.map((i) => i.itemId)).toEqual(['potion', 'tm34-bide']);
    expect(locations[0]!.items[1]).toMatchObject({
      source: { title: 'Walkthrough', revid: 42 },
      subArea: 'Gym',
    });
  });

  it('adds unstated requirements to exactly one item', () => {
    const locations = [
      location('silph-co', [
        item('Protein', { subArea: '5F' }),
        item('HP Up', { subArea: '6F' }),
        item('HP Up', { subArea: '7F' }),
        item('Iron', { requires: [['card-key']] }),
      ]),
    ];
    const rule = {
      locationId: 'silph-co',
      requires: [['card-key']],
      sourcePage: 'Walkthrough',
      reason: 'door',
    };
    const errors = applyItemOverrides(
      locations,
      overrides({
        requires: [
          { ...rule, itemId: 'protein' },
          { ...rule, itemId: 'hp-up' },
          { ...rule, itemId: 'hp-up', subArea: '6F' },
          { ...rule, itemId: 'iron' },
          { ...rule, itemId: 'nugget' },
        ],
      }),
      sourceOf,
    );
    expect(errors).toEqual([
      'Requirement override for hp-up in silph-co matches 2 items, expected 1',
      'Requirement override for iron in silph-co is already stated by the page',
      'Requirement override for nugget in silph-co matches 0 items, expected 1',
    ]);
    expect(locations[0]!.items.map((i) => i.requires ?? null)).toEqual([
      [['card-key']],
      [['card-key']],
      null,
      [['card-key']],
    ]);
  });

  it('patches exactly one item, renaming its id', () => {
    const locations = [
      location('route-15', [
        item('Exp. Share'),
        item('Potion', { subArea: '1F' }),
        item('Potion', { subArea: '2F' }),
      ]),
    ];
    const rule = { locationId: 'route-15', sourcePage: 'Walkthrough', reason: 'fix' };
    const errors = applyItemOverrides(
      locations,
      overrides({
        patch: [
          { ...rule, itemId: 'exp-share', set: { name: 'Exp. All' } },
          { ...rule, itemId: 'potion', set: { quantity: 2 } },
          { ...rule, itemId: 'potion', subArea: '2F', set: { quantity: 1 } },
        ],
      }),
      sourceOf,
    );
    expect(errors).toEqual([
      'Item patch for potion in route-15 matches 2 items, expected 1',
      'Item patch for potion in route-15 changes nothing',
    ]);
    expect(locations[0]!.items[0]).toMatchObject({ itemId: 'exp-all', name: 'Exp. All' });
  });

  it('adds requirements to every item of a sub-area', () => {
    const locations = [
      location('mt-mortar', [
        item('Elixer', { subArea: '2F' }),
        item('Dragon Scale', { subArea: '2F', requires: [['strength']] }),
        item('Ether', { subArea: '1F' }),
      ]),
    ];
    const rule = { locationId: 'mt-mortar', sourcePage: 'Mt. Mortar', reason: 'area' };
    const errors = applyItemOverrides(
      locations,
      overrides({
        requires: [
          { ...rule, subArea: '2F', requires: [['surf'], ['waterfall']] },
          { ...rule, subArea: 'B9F', requires: [['surf']] },
          { ...rule, requires: [['surf']] },
        ],
      }),
      sourceOf,
    );
    expect(errors).toEqual([
      'Requirement override for sub-area "B9F" in mt-mortar matches 0 items, expected some',
      'Requirement override in mt-mortar names neither an item nor a sub-area',
    ]);
    expect(locations[0]!.items.map((i) => i.requires ?? null)).toEqual([
      [['surf'], ['waterfall']],
      [['strength'], ['surf'], ['waterfall']],
      null,
    ]);
  });

  it('removes exactly one item, and patches when it becomes available', () => {
    const locations = [
      location('radio-tower', [
        item('GS Ball'),
        item('Pink Bow', { subArea: '4F' }),
        item('Potion', { subArea: '1F' }),
        item('Potion', { subArea: '2F' }),
      ]),
    ];
    const rule = { locationId: 'radio-tower', sourcePage: 'Walkthrough', reason: 'fix' };
    const errors = applyItemOverrides(
      locations,
      overrides({
        remove: [
          { ...rule, itemId: 'gs-ball' },
          { ...rule, itemId: 'potion' },
        ],
        patch: [{ ...rule, itemId: 'pink-bow', set: { fromPart: { red: 12 } } }],
      }),
      sourceOf,
    );
    expect(errors).toEqual(['Item removal for potion in radio-tower matches 2 items, expected 1']);
    expect(locations[0]!.items.map((i) => [i.itemId, i.fromPart ?? null])).toEqual([
      ['pink-bow', { red: 12 }],
      ['potion', null],
      ['potion', null],
    ]);
  });

  it('marks choice groups', () => {
    const locations = [
      location('mt-moon', [
        item('Dome Fossil', { obtain: 'choice' }),
        item('Helix Fossil', { obtain: 'choice' }),
      ]),
    ];
    const errors = applyItemOverrides(
      locations,
      overrides({
        choiceGroups: [
          {
            locationId: 'mt-moon',
            itemIds: ['dome-fossil', 'helix-fossil', 'old-amber'],
            groupId: 'mt-moon-fossil',
          },
        ],
      }),
      sourceOf,
    );
    expect(errors).toEqual(['Choice group mt-moon-fossil has no choice item old-amber in mt-moon']);
    expect(locations[0]!.items.map((i) => i.choiceGroupId)).toEqual([
      'mt-moon-fossil',
      'mt-moon-fossil',
    ]);
  });
});

describe('checkItemRequirements', () => {
  it('reports requirements that are not unlocks in every game, and unlocks at unknown locations', () => {
    const cut: Unlock = { id: 'cut', label: 'Cut', kind: 'move', locationId: 'ss-anne', part: 6 };
    const locations = [
      location('ss-anne', []),
      location('route-2', [item('HP Up', { requires: [['cut', 'surf']] })]),
    ];
    expect(
      checkItemRequirements(locations, {
        red: [cut],
        blue: [cut],
        yellow: [
          cut,
          { id: 'surf', label: 'Surf', kind: 'move', locationId: 'safari-zone', part: 11 },
        ],
      }),
    ).toEqual([
      'Unlock "surf" (yellow) is at unknown location "safari-zone"',
      'HP Up in route-2 requires "surf", which is not an unlock in red, blue',
    ]);
  });
});

describe('diffWalkthroughItems', () => {
  it('compares total quantities and requirements per item, once per shared page', () => {
    const locations = [
      location('route-1', [
        item('Potion', { quantity: 2 }),
        item('TM27 Fissure', { fromPart: { red: 14, blue: 14 } }),
        item('Old Amber', { requires: [['cut']] }),
      ]),
      location('route-3', [item('Nugget')], 3),
    ];
    const part1 = [item('Potion'), item('Iron', { requires: [['cut']] }), item('TM27 Fissure')];
    // Listed in another part than the location data, with a requirement the data already has.
    const part2 = [item('Old Amber', { requires: [['cut']] })];
    const walkthrough = (['red', 'blue'] as const).flatMap((game) => [
      { page: 'RB/Part 1', part: 1, game, items: part1 },
      { page: 'RB/Part 2', part: 2, game, items: part2 },
    ]);
    expect(diffWalkthroughItems(locations, walkthrough)).toEqual([
      { page: 'RB/Part 1', message: 'Potion: ×1 in the walkthrough, ×2 in the location data' },
      { page: 'RB/Part 1', message: 'Iron: ×1 in the walkthrough, ×0 in the location data' },
      { page: 'RB/Part 1', message: 'Iron: the walkthrough says it requires cut ("Somewhere")' },
      { page: 'Part 3', message: 'Nugget: ×0 in the walkthrough, ×1 in the location data' },
    ]);
    const accepted = [{ itemId: 'potion', games: ['red', 'blue'] as const, reason: 'on purpose' }];
    expect(
      diffWalkthroughItems(locations, walkthrough, accepted).map((m) => m.message),
    ).not.toContain('Potion: ×1 in the walkthrough, ×2 in the location data');
  });

  it('counts a row repeated in a later part once, and accepts stated requirement differences', () => {
    const locations = [location('dark-cave', [item('Full Heal'), item('Revive')], 3)];
    const repeated = [item('Full Heal'), item('Revive', { requires: [['surf']] })];
    const walkthrough = [3, 7, 13].map((part) => ({
      page: `GS/Part ${part}`,
      part,
      game: 'red' as const,
      items: repeated,
    }));
    expect(diffWalkthroughItems(locations, walkthrough)).toEqual([
      { page: 'GS/Part 3', message: 'Revive: the walkthrough says it requires surf ("Somewhere")' },
    ]);
    const accepted = [
      {
        itemId: 'revive',
        games: ['red'] as const,
        difference: 'requirements' as const,
        reason: 'walkthrough error',
      },
    ];
    expect(diffWalkthroughItems(locations, walkthrough, accepted)).toEqual([]);
  });
});
