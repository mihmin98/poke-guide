// Extensibility spike (plan §16 Phase 1): the Gen II adapter passes the same contract and flows through
// the generic walker and merge with time-of-day slots, with no changes to either.
import { walkEncounterSection } from '../core/encounter-walker';
import { mergeRows } from '../core/merge';
import { fixture } from '../testing/fixtures';
import { describeAdapterContract } from './adapter-contract';
import { entry2Adapter } from './entry2';

describeAdapterContract(entry2Adapter, [
  {
    description: 'morning/day only (Route 1 Pidgey)',
    wikitext: '{{catch/entry2|016|Pidgey|yes|yes|yes|Grass|2-4|45%|45%|0%|type1=normal|type2=flying|11=k}}',
    expected: { dex: 16, games: ['gold', 'silver', 'crystal'], method: 'walk-grass', slotCount: 2, times: ['morning', 'day'] },
  },
  {
    description: 'night only, one version (Route 1 Rattata)',
    wikitext: '{{catch/entry2|019|Rattata|no|no|yes|Grass|2-3|0%|0%|50%|type1=normal|11=k}}',
    expected: { dex: 19, games: ['crystal'], method: 'walk-grass', slotCount: 1, times: ['night'] },
  },
]);

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
      { levels: { min: 2, max: 4 }, rate: { kind: 'percent', value: 45 }, conditions: [{ kind: 'time', value: 'morning' }] },
      { levels: { min: 2, max: 4 }, rate: { kind: 'percent', value: 45 }, conditions: [{ kind: 'time', value: 'day' }] },
    ]);
  });

  it('keeps per-version night slots from split rows', () => {
    const night = (game: 'gold' | 'crystal') =>
      find(19).games[game]!.find((s) => s.conditions?.[0]?.kind === 'time' && s.conditions[0].value === 'night');
    expect(night('gold')).toMatchObject({ levels: { min: 2, max: 6, values: [2, 3, 6] }, rate: { value: 55 } });
    expect(night('crystal')).toMatchObject({ levels: { min: 2, max: 3 }, rate: { value: 50 } });
  });
});
