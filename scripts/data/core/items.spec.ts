import type { LocationItem } from '../../../src/app/core/domain/models';
import { fixture } from '../testing/fixtures';
import { gscConfig } from '../version-groups/gsc/config';
import { rbyConfig } from '../version-groups/rby/config';
import { collectItemRows, walkItemSection, type ItemWalkOptions } from './items';

const options = (pageTitle: string): ItemWalkOptions => ({
  pageTitle,
  games: rbyConfig.games,
  gameFlags: rbyConfig.itemGameFlags,
  aliases: rbyConfig.itemAliases,
  requirementPhrases: { 'Chop Down': null, 'defeating Jr. Trainer♂': 'route-25-jr-trainer' },
});

function walk(name: string, wikitext?: string) {
  const page = fixture('rby', name);
  return walkItemSection(wikitext ?? page.wikitext, options(page.resolvedTitle));
}

const summary = (items: readonly LocationItem[]) =>
  items.map((i) => [i.name, i.obtain, i.hidden ?? false, i.requires ?? null]);
const forGame = (items: readonly LocationItem[], game: 'red' | 'yellow') =>
  items.filter((i) => i.games.includes(game));

describe('walkItemSection on Red/Blue/Yellow fixtures', () => {
  it.each([
    'route-12',
    'mt-moon',
    'viridian-forest',
    'route-25',
    'team-rocket-hideout',
    'power-plant',
    'cerulean-cave',
    'celadon-game-corner',
    'sea-cottage',
    'oaks-lab',
    'silph-co',
    'safari-zone',
  ])('walks %s without issues', (name) => {
    const result = walk(name);
    expect(result.found).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('reads names from display=, prerequisites, hidden markers and how items are obtained (Route 12)', () => {
    expect(summary(walk('route-12').items)).toEqual([
      ['TM39 Swift', 'gift', false, null],
      ['TM16 Pay Day', 'pickup', false, [['surf']]],
      ['Hyper Potion', 'pickup', true, null],
      ['Super Rod', 'gift', false, null],
      ['Iron', 'pickup', false, [['cut']]],
    ]);
    for (const item of walk('route-12').items)
      expect(item.games).toEqual(['red', 'blue', 'yellow']);
  });

  it('splits bullets into spots, takes floors as sub-areas and marks the fossil choice (Mt. Moon)', () => {
    const items = walk('mt-moon').items;
    expect(items.map((i) => [i.name, i.subArea])).toEqual([
      ['TM12 Water Gun', '1F'],
      ['Potion', '1F'],
      ['Potion', '1F'],
      ['Rare Candy', '1F'],
      ['Escape Rope', '1F'],
      ['Moon Stone', '1F'],
      ['HP Up', 'B2F'],
      ['TM01 Mega Punch', 'B2F'],
      ['Ether', 'B2F'],
      ['Moon Stone', 'B2F'],
      ['Dome Fossil', 'B2F'],
      ['Helix Fossil', 'B2F'],
    ]);
    expect(items[1]).toMatchObject({
      quantity: 1,
      where: 'To the far northwest of TM12, in the southwest area of the floor',
    });
    expect(items.filter((i) => i.hidden).map((i) => i.name)).toEqual(['Ether', 'Moon Stone']);
    expect(items.filter((i) => i.obtain === 'choice').map((i) => i.itemId)).toEqual([
      'dome-fossil',
      'helix-fossil',
    ]);
  });

  it('keeps per-game rows apart (Viridian Forest)', () => {
    const items = walk('viridian-forest').items;
    expect(items.map((i) => [i.name, i.games, i.hidden ?? false])).toEqual([
      ['Antidote', ['red', 'blue', 'yellow'], true],
      ['Poké Ball', ['red', 'blue', 'yellow'], false],
      ['Antidote', ['red', 'blue'], false],
      ['Potion', ['yellow'], false],
      ['Potion', ['red', 'blue', 'yellow'], false],
      ['Potion', ['red', 'blue', 'yellow'], true],
    ]);
  });

  it('maps requirement phrases and spelling aliases (Route 25)', () => {
    const items = walk('route-25').items;
    expect(summary(items)).toEqual([
      ['Elixir', 'pickup', true, null],
      ['TM19 Seismic Toss', 'pickup', false, [['route-25-jr-trainer', 'cut']]],
      ['Ether', 'pickup', true, null],
    ]);
  });

  it('reads trainer drops behind the Lift Key and drops "broken" notes (Team Rocket Hideout)', () => {
    const items = walk('team-rocket-hideout').items;
    expect(items).toHaveLength(16);
    expect(items.find((i) => i.itemId === 'silph-scope')).toMatchObject({
      obtain: 'drop',
      requires: [['lift-key']],
      subArea: 'B4F',
    });
    expect(items.find((i) => i.itemId === 'lift-key')?.obtain).toBe('drop');
    expect(items.find((i) => i.itemId === 'nugget' && i.hidden)?.where).toBe(
      'One square east of TM10',
    );
  });

  it('turns fake items into notes (Power Plant)', () => {
    const result = walk('power-plant');
    expect(result.items.map((i) => i.name)).toEqual([
      'TM25 Thunder',
      'Carbos',
      'Max Elixir',
      'TM33 Reflect',
      'Rare Candy',
      'HP Up',
      'PP Up',
    ]);
    expect(result.notes).toEqual(['Fake item balls: Voltorb ×6', 'Fake item balls: Electrode ×2']);
  });

  it('keeps version subsections from becoming sub-areas (Cerulean Cave)', () => {
    const items = walk('cerulean-cave').items;
    expect(forGame(items, 'red')).toHaveLength(10);
    expect(forGame(items, 'yellow')).toHaveLength(15);
    expect(new Set(items.map((i) => i.subArea))).toEqual(new Set(['1F', '2F', 'B1F']));
  });

  it('reads Game Corner coins as quantities', () => {
    const items = walk('celadon-game-corner').items;
    expect(items.map((i) => i.quantity)).toEqual([
      10, 20, 20, 100, 20, 20, 10, 10, 10, 10, 20, 10, 10, 10,
    ]);
    expect(new Set(items.map((i) => i.itemId))).toEqual(new Set(['coins']));
    expect(items.filter((i) => i.obtain === 'gift')).toHaveLength(3);
    expect(items.filter((i) => i.hidden)).toHaveLength(11);
  });

  it('reads items-only and small pages (Sea Cottage, Oak’s Lab, Silph Co.)', () => {
    expect(summary(walk('sea-cottage').items)).toEqual([['S.S. Ticket', 'reward', false, null]]);
    expect(walk('oaks-lab').items.map((i) => [i.name, i.obtain, i.quantity])).toEqual([
      ['Pokédex', 'gift', 1],
      // "From Professor Oak after defeating Blue at the optional battle…"
      ['Poké Ball', 'reward', 5],
    ]);
    expect(walk('silph-co').items.map((i) => i.name)).toContain('Card Key');
  });

  it('skips temporary items (Safari Zone Safari Balls)', () => {
    const items = walk('safari-zone').items;
    expect(items.map((i) => i.itemId)).not.toContain('safari-ball');
    expect(items.find((i) => i.itemId === 'nugget')?.requires).toEqual([['surf']]);
  });

  it('reports unknown requirements, machines without display= and missing sections', () => {
    const bad = walk(
      'route-1',
      '==Items==\n{{Itemlist|Potion|Somewhere (requires [[Old Sea Map]] and a friend)|R=yes}}\n{{Itemlist|TM Water|Nowhere|Y=yes}}\n',
    );
    expect(bad.items.map((i) => i.requires)).toEqual([[['old-sea-map']]]);
    expect(bad.issues).toHaveLength(2);
    expect(bad.issues[0]).toMatchObject({
      level: 'error',
      message: expect.stringMatching(/^Unrecognized requirement "friend" in \{\{Itemlist\|Potion/),
    });
    expect(bad.issues[1]).toMatchObject({
      level: 'error',
      message: expect.stringMatching(/^Machine item without display=: \{\{Itemlist\|TM Water/),
    });
    expect(walk('route-1', '==Pokémon==\n').found).toBe(false);
  });

  it('reads comma-separated requirements and Johto key items', () => {
    const result = walk(
      'route-1',
      '==Items==\n{{Itemlist|Nugget|A (requires {{m|Surf}}, {{m|Waterfall}}, and {{m|Strength}})|R=yes}}\n' +
        '{{Itemlist|Ultra Ball|B (requires {{jo|Card Key}})|R=yes}}\n',
    );
    expect(result.issues).toEqual([]);
    expect(result.items.map((i) => i.requires)).toEqual([
      [['surf'], ['waterfall'], ['strength']],
      [['card-key']],
    ]);
  });
});

describe('walkItemSection on Gold/Silver/Crystal fixtures', () => {
  const gsc = (name: string) => {
    const page = fixture('gsc', name);
    return walkItemSection(page.wikitext, {
      pageTitle: page.resolvedTitle,
      games: gscConfig.games,
      gameFlags: gscConfig.itemGameFlags,
      aliases: gscConfig.itemAliases,
      requirementPhrases: gscConfig.overrides.items.requirementPhrases,
    });
  };

  it('writes days of the week out (Route 29)', () => {
    const result = gsc('route-29');
    expect(result.issues).toEqual([]);
    expect(result.items.find((i) => i.itemId === 'pink-bow')?.where).toBe(
      'From Tuscany after earning the Zephyr Badge (Tuesdays)',
    );
  });

  it('skips the Park Balls, whose "cannot be kept" is followed by days (National Park)', () => {
    const items = gsc('national-park').items;
    expect(items.map((i) => i.itemId)).not.toContain('park-ball');
  });

  it('keeps a "Generation II" heading from becoming a sub-area, so floors are read (Mt. Silver Cave)', () => {
    const items = gsc('mt-silver-cave').items;
    expect(new Set(items.map((i) => i.subArea))).toEqual(new Set(['1F', '2F']));
  });
});

describe('item row details', () => {
  const row = (wikitext: string) => collectItemRows(wikitext, options('Page'));

  it('drops footnote markers, reads {{DL}} text and makes held items gifts', () => {
    const result = row(
      '{{Itemlist|PP Up|Given by Kenji after he asks{{tt|*|Random}}|R=yes}}\n' +
        '{{Itemlist|None|From the guide|R=yes|display={{DL|Pokégear|Map|Map Card}}}}\n' +
        "{{Itemlist|Berry|Held by the {{player}}'s first partner Pokémon|R=yes}}",
    );
    expect(result.items.map((i) => [i.name, i.where, i.obtain])).toEqual([
      ['PP Up', 'Given by Kenji after he asks', 'pickup'],
      ['Map Card', 'From the guide', 'gift'],
      ['Berry', "Held by the player's first partner Pokémon", 'gift'],
    ]);
  });

  it('puts one item on each spot unless a different ×N is stated', () => {
    const plain = row('{{Itemlist|Nugget|\n* A\n* B|R=yes}}');
    expect(plain.issues).toEqual([]);
    expect(plain.items.map((i) => i.quantity)).toEqual([1, 1]);
    const stated = row('{{Itemlist|Nugget|\n* A\n* B|R=yes|display=[[Nugget]] ×3}}');
    expect(stated.issues).toMatchObject([
      { level: 'warning', message: expect.stringMatching(/^Quantity ×3 doesn't match 2 spots/) },
    ]);
  });
});

describe('collectItemRows on walkthrough pages', () => {
  it('turns disguised Pokémon rows into notes and reads "5F;" floors', () => {
    const result = collectItemRows(
      '{{Itemlist|None|sprite=100MS|\n* A\n* B (×2)|R=yes|B=yes|display={{p|Voltorb}} ×3}}\n{{Itemlist|Protein|5F; in the northwest room|R=yes}}',
      options('Walkthrough'),
    );
    expect(result.issues).toEqual([]);
    expect(result.notes).toEqual(['Fake item balls: Voltorb ×3']);
    expect(result.items).toMatchObject([
      { name: 'Protein', subArea: '5F', where: 'In the northwest room' },
    ]);
  });

  it('collects rows inside tables, without sub-areas (Red and Blue Part 10)', () => {
    const page = fixture('rby', 'walkthrough-rb-part-10');
    const result = collectItemRows(page.wikitext, options(page.resolvedTitle));
    expect(result.issues).toEqual([]);
    expect(result.items.find((i) => i.name === 'TM46 Psywave')).toMatchObject({
      obtain: 'reward',
      games: ['red', 'blue'],
      subArea: null,
    });
    // Walkthroughs state gates the location pages leave out, with an article: "requires the {{ka|Card Key}}".
    expect(result.items.find((i) => i.name === 'Protein')?.requires).toEqual([['card-key']]);
  });
});
