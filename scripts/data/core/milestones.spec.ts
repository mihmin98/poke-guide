import type { Milestone } from '../../../src/app/core/domain/models';
import {
  awardedBadges,
  checkMilestonesAgainstWalkthrough,
  countPartyBattles,
  type WalkthroughPartPage,
} from './milestones';

const party = (sprite: string, prize: string, caption = '') =>
  `{{Party\n| sprite = ${sprite}\n| prize = {{PDollar}}${prize}\n| location = Somewhere\n${caption}}}\n` +
  '{{Pokémon|pokemon=Pidgey}}\n{{Party/end}}\n';

const gymPage =
  '{{GymInfo\n| party =\n' +
  party('Spr RG Brock.png', '1,386') +
  '}}\n' +
  'After the battle, [[Brock]] awards you the {{badge|Boulder}}, which gives…\n';

const milestone = (
  id: string,
  kind: Milestone['kind'],
  extra: Partial<Milestone> = {},
): Milestone => ({
  no: 1,
  id,
  label: id,
  kind,
  part: { red: 3 },
  locationId: 'pewter-city',
  ...extra,
});

describe('awardedBadges', () => {
  it('reads the badges a page awards, not the ones it only mentions', () => {
    expect(awardedBadges(gymPage)).toEqual(['Boulder']);
    expect(awardedBadges('| {{badge|Cascade}}\nthe guard checks for the {{badge|Earth}}')).toEqual(
      [],
    );
  });
});

describe('countPartyBattles', () => {
  it('finds Party blocks nested in other templates', () => {
    expect(countPartyBattles(gymPage)).toBe(1);
  });

  it('counts runs of one battle (one block per starter) once', () => {
    const rival = ['0001', '0004', '0007']
      .map((n) => party('Spr RG Blue 1.png', '175', `| caption = {{PlayerChoice|${n}}}\n`))
      .join('');
    const jessieJames = party('Spr Y Jessie James.png', '420');
    expect(countPartyBattles(rival)).toBe(1);
    expect(countPartyBattles(rival + jessieJames)).toBe(2);
    expect(countPartyBattles(rival + jessieJames + rival)).toBe(3);
  });

  it('ignores Party/end and other Party templates', () => {
    expect(countPartyBattles('{{Party/end}} {{Party/Single|x}}')).toBe(0);
  });
});

describe('checkMilestonesAgainstWalkthrough', () => {
  const page: WalkthroughPartPage = { game: 'red', part: 3, page: 'Part 3', wikitext: gymPage };

  it('passes when the gym and its badge match the page', () => {
    const milestones = [milestone('gym-brock', 'gym', { badge: 'Boulder' })];
    expect(checkMilestonesAgainstWalkthrough(milestones, [page])).toEqual([]);
  });

  it('warns about an awarded badge with no gym, and about too few battles', () => {
    expect(checkMilestonesAgainstWalkthrough([], [page]).map((w) => w.message)).toEqual([
      'red Part 3 awards the Boulder Badge, but no gym milestone there has it',
      'red Part 3 has 1 battle(s) with a {{Party}} block, but only 0 gym or battle milestone(s)',
    ]);
  });

  it('warns about a gym whose badge the page does not award', () => {
    const milestones = [
      milestone('gym-brock', 'gym', { badge: 'Boulder' }),
      milestone('gym-misty', 'gym', { badge: 'Cascade' }),
    ];
    expect(checkMilestonesAgainstWalkthrough(milestones, [page])).toEqual([
      {
        page: 'Part 3',
        message: 'Gym milestone "gym-misty" (Cascade) isn\'t awarded on red Part 3',
      },
    ]);
  });

  it('only looks at milestones of the page game and part', () => {
    const elsewhere = [milestone('gym-brock', 'gym', { badge: 'Boulder', part: { blue: 3 } })];
    expect(checkMilestonesAgainstWalkthrough(elsewhere, [page])).toHaveLength(2);
  });
});
