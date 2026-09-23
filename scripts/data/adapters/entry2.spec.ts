// The Gen II adapter (plan §16 Phase 10): the shared contract, the Gen II method columns, and the generic
// walker and merge with time-of-day slots.
import { walkEncounterSection } from '../core/encounter-walker';
import { mergeRows } from '../core/merge';
import { fixture } from '../testing/fixtures';
import { describeAdapterContract } from './adapter-contract';
import { entry2Adapter } from './entry2';

describeAdapterContract(entry2Adapter, [
  {
    description: 'morning/day only (Route 1 Pidgey)',
    wikitext:
      '{{catch/entry2|016|Pidgey|yes|yes|yes|Grass|2-4|45%|45%|0%|type1=normal|type2=flying|11=k}}',
    expected: {
      dex: 16,
      games: ['gold', 'silver', 'crystal'],
      method: 'walk-grass',
      slotCount: 2,
      times: ['morning', 'day'],
    },
  },
  {
    description: 'night only, one version (Route 1 Rattata)',
    wikitext: '{{catch/entry2|019|Rattata|no|no|yes|Grass|2-3|0%|0%|50%|type1=normal|11=k}}',
    expected: { dex: 19, games: ['crystal'], method: 'walk-grass', slotCount: 1, times: ['night'] },
  },
  {
    description: 'all= gives the same rate at every time (Route 32 Tentacool)',
    wikitext:
      '{{Catch/entry2|072|Tentacool|yes|yes|yes|Surf|15-19|all=60%|type1=Water|type2=Poison}}',
    expected: {
      dex: 72,
      games: ['gold', 'silver', 'crystal'],
      method: 'surf',
      slotCount: 3,
      requires: ['surf'],
      times: ['morning', 'day', 'night'],
    },
  },
  {
    description: 'Headbutt needs the Headbutt TM (Route 32 Spearow)',
    wikitext: '{{Catch/entry2|021|Spearow|yes|yes|no|Headbutt|10|all=80%|type1=Normal}}',
    expected: {
      dex: 21,
      games: ['gold', 'silver'],
      method: 'headbutt',
      slotCount: 3,
      requires: ['headbutt'],
    },
  },
  {
    description: 'Rock Smash needs Rock Smash (Dark Cave Shuckle)',
    wikitext: '{{catch/entry2|213|Shuckle|yes|yes|yes|Rock Smash|15|all=10%|type1=Bug}}',
    expected: {
      dex: 213,
      games: ['gold', 'silver', 'crystal'],
      method: 'rock-smash',
      slotCount: 3,
      requires: ['rock-smash'],
    },
  },
  {
    description: 'a swarm replaces a cave\'s walking encounters (Dark Cave Dunsparce)',
    wikitext: '{{catch/entry2|206|Dunsparce|yes|yes|yes|Swarm|2-4|all=40%|type1=Normal}}',
    locationKind: 'cave',
    divLabel: 'During a Dunsparce swarm',
    expected: { dex: 206, games: ['gold', 'silver', 'crystal'], method: 'walk-cave', slotCount: 3 },
  },
  {
    description: 'the Bug-Catching Contest is the park grass under its div (National Park)',
    wikitext: '{{Catch/entry2|123|Scyther|yes|yes|yes|Grass|13-14|all=5%|type1=Bug}}',
    divLabel: 'Bug-Catching Contest',
    expected: {
      dex: 123,
      games: ['gold', 'silver', 'crystal'],
      method: 'bug-contest',
      slotCount: 3,
    },
  },
  {
    description: 'a gift egg (Violet City Togepi)',
    wikitext: '{{catch/entry2|175|Togepi|yes|yes|yes|Egg|5|all=One|type1=Normal}}',
    expected: { dex: 175, games: ['gold', 'silver', 'crystal'], method: 'egg', slotCount: 3 },
  },
  {
    description: 'a floor range becomes the sub-area (Bell Tower)',
    wikitext: '{{catch/entry2|092|Gastly|yes|yes|yes|2F-9F|20-22|0%|0%|80%|type1=Ghost}}',
    locationKind: 'building',
    expected: {
      dex: 92,
      games: ['gold', 'silver', 'crystal'],
      method: 'walk-building',
      slotCount: 1,
      subArea: '2F-9F',
      times: ['night'],
    },
  },
]);

describe('entry2 swarm and time handling', () => {
  const walk = (wikitext: string, kind: 'route' | 'cave' = 'route') =>
    walkEncounterSection(`==Pokémon==\n===Generation II===\n${wikitext}`, {
      pageTitle: 'Test',
      generationHeading: 'Generation II',
      locationKind: kind,
      adapters: [entry2Adapter],
    });

  it('marks rows under a swarm div, including fishing swarms, with a swarm condition', () => {
    const walked = walk(
      [
        '{{Catch/div|water|During a Qwilfish {{color2|000|Mass outbreak|swarm}}}}',
        '{{Catch/entry2|211|Qwilfish|yes|yes|yes|Fish Good|20|all=100%|type1=Water}}',
      ].join('\n'),
    );
    expect(walked.issues).toEqual([]);
    const [row] = walked.rows;
    expect(row?.method).toBe('fish-good');
    expect(row?.label).toBe('During a Qwilfish swarm');
    expect(row?.row.slots[0]?.conditions).toEqual([
      { kind: 'time', value: 'morning' },
      { kind: 'swarm' },
    ]);
  });

  it('collapses a species that appears alike at every time into one slot', () => {
    const walked = walk(
      [
        '{{Catch/entry2|072|Tentacool|yes|yes|yes|Surf|15-19|all=60%|type1=Water}}',
        '{{Catch/entry2|019|Rattata|yes|no|no|Grass|4|35%|35%|0%|type1=Normal}}',
        '{{Catch/entry2|019|Rattata|yes|no|no|Grass|4|0%|0%|20%|type1=Normal}}',
        '{{Catch/entry2|019|Rattata|yes|no|no|Grass|4|0%|0%|15%|type1=Normal}}',
      ].join('\n'),
    );
    const [area] = mergeRows(walked.rows, ['gold', 'silver', 'crystal']);
    const tentacool = area!.encounters.find((e) => e.dex === 72)!;
    expect(tentacool.games.gold).toEqual([
      { levels: { min: 15, max: 19 }, rate: { kind: 'percent', value: 60 } },
    ]);
    // Split night rows add up to 35% first, so every time matches and the slot collapses.
    const rattata = area!.encounters.find((e) => e.dex === 19)!;
    expect(rattata.games.gold).toEqual([
      { levels: { min: 4, max: 4 }, rate: { kind: 'percent', value: 35 } },
    ]);
  });
});

describe('entry2 through the generic walker and merge (Kanto Route 1, Generation II)', () => {
  const page = fixture('rby', 'route-1');
  const walked = walkEncounterSection(page.wikitext, {
    pageTitle: page.resolvedTitle,
    generationHeading: 'Generation II',
    locationKind: 'route',
    adapters: [entry2Adapter],
  });
  const [area] = mergeRows(walked.rows, ['gold', 'silver', 'crystal']);
  const find = (dex: number) => area!.encounters.find((e) => e.dex === dex)!;

  it('walks every row without issues', () => {
    expect(walked.issues).toEqual([]);
    expect(walked.rows).toHaveLength(8);
  });

  it('produces one slot per time of day', () => {
    expect(find(16).games.crystal).toEqual([
      {
        levels: { min: 2, max: 4 },
        rate: { kind: 'percent', value: 45 },
        conditions: [{ kind: 'time', value: 'morning' }],
      },
      {
        levels: { min: 2, max: 4 },
        rate: { kind: 'percent', value: 45 },
        conditions: [{ kind: 'time', value: 'day' }],
      },
    ]);
  });

  it('keeps per-version night slots from split rows', () => {
    const night = (game: 'gold' | 'crystal') =>
      find(19).games[game]!.find(
        (s) => s.conditions?.[0]?.kind === 'time' && s.conditions[0].value === 'night',
      );
    expect(night('gold')).toMatchObject({
      levels: { min: 2, max: 6, values: [2, 3, 6] },
      rate: { value: 55 },
    });
    expect(night('crystal')).toMatchObject({ levels: { min: 2, max: 3 }, rate: { value: 50 } });
  });
});
