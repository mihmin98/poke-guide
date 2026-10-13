import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PokedexData, VersionGroupData } from '../../../src/app/core/domain/models';
import { repoRoot } from './paths';
import { checkMilestones, validateVersionGroup } from './validate';

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(join(repoRoot(), 'public', 'data', file), 'utf8')) as T;

describe('validateVersionGroup', () => {
  const data = () => load<VersionGroupData>('rby.json');
  const pokedex = load<PokedexData>('rby.pokedex.json');

  it('accepts the committed rby files and covers every species in every game', () => {
    const result = validateVersionGroup(data(), pokedex);
    expect(result.issues).toEqual([]);
    expect(result.checklists.map((c) => [c.game, c.entries.length])).toEqual([
      ['red', 151],
      ['blue', 151],
      ['yellow', 151],
    ]);
  });

  it('reports schema mismatches without running the other checks', () => {
    const broken = data() as unknown as { locations: { extra?: number }[] };
    broken.locations[0]!.extra = 1;
    const result = validateVersionGroup(broken as unknown as VersionGroupData, pokedex);
    expect(result.issues.map((i) => i.message)).toEqual([
      'Data schema: locations.0: Unrecognized key: "extra"',
    ]);
    expect(result.checklists).toEqual([]);
  });

  it('reports unknown methods, games and species, and species without a reason', () => {
    const d = data();
    const encounter = d.locations.find((l) => l.id === 'route-1')!.subAreas[0]!.encounters[0]!;
    encounter.method = 'no-such-method';
    encounter.games['gold'] = encounter.games['red'];
    d.eventOnly = [];
    const messages = validateVersionGroup(d, pokedex).issues.map((i) => i.message);
    expect(messages).toContain(
      `#${encounter.dex} no-such-method in route-1/main: unknown method "no-such-method"`,
    );
    expect(messages).toContain(
      `#${encounter.dex} no-such-method in route-1/main slot has game "gold", which is not in the version group`,
    );
    expect(messages).toContain('#151 Mew has no source and no unobtainable reason in red');
  });
});

describe('checkMilestones', () => {
  const data = () => load<VersionGroupData>('rby.json');
  const messages = (d: VersionGroupData) => checkMilestones(d).map((i) => i.message);
  const milestone = (d: VersionGroupData, id: string) => {
    const found = d.milestones!.find((m) => m.id === id);
    if (!found) throw new Error(`No milestone ${id}`);
    return found;
  };

  it('accepts the committed rby milestones', () => {
    expect(messages(data())).toEqual([]);
  });

  it('reports duplicate ids and numbers, unknown locations, games and parts', () => {
    const d = data();
    const brock = milestone(d, 'gym-brock');
    d.milestones!.push({ ...brock });
    const misty = milestone(d, 'gym-misty');
    misty.locationId = 'nowhere';
    misty.part = { red: 99, gold: 5 };
    expect(messages(d)).toEqual(
      expect.arrayContaining([
        'Milestone "gym-brock" is listed twice',
        `Milestone number ${brock.no} is used twice ("gym-brock")`,
        'Milestone "gym-misty": unknown location "nowhere"',
        'Milestone "gym-misty": red has no walkthrough part 99',
        'Milestone "gym-misty" has game "gold", which is not in the version group',
      ]),
    );
  });

  it('requires badges on gyms only', () => {
    const d = data();
    delete milestone(d, 'gym-brock').badge;
    milestone(d, 'rival-1').badge = 'Boulder';
    expect(messages(d)).toEqual([
      'Milestone "rival-1": gyms, and only gyms, name a badge',
      'Milestone "gym-brock": gyms, and only gyms, name a badge',
    ]);
  });

  it('reports a species with no encounter at the milestone location', () => {
    const d = data();
    milestone(d, 'receive-lapras').dex = 25;
    expect(messages(d)).toEqual([
      'Milestone "receive-lapras": silph-co has no #25 encounter in red',
      'Milestone "receive-lapras": silph-co has no #25 encounter in blue',
      'Milestone "receive-lapras": silph-co has no #25 encounter in yellow',
    ]);
  });

  it('needs every unlock granted by exactly one milestone, no later than its part', () => {
    const d = data();
    delete milestone(d, 'card-key').grants;
    milestone(d, 'hm03-surf').grants = ['surf', 'strength', 'no-such-unlock'];
    milestone(d, 'help-bill').part = { red: 7, blue: 5, yellow: 5 };
    expect(messages(d)).toEqual(
      expect.arrayContaining([
        'red unlock "card-key" is granted by 0 milestones; it needs exactly one',
        'red unlock "strength" is granted by 2 milestones; it needs exactly one',
        'Milestone "hm03-surf" grants unknown red unlock "no-such-unlock"',
        'red unlock "ss-ticket" is in part 5, but milestone "help-bill" grants it in part 7',
      ]),
    );
    expect(messages(d).some((m) => m.startsWith('blue unlock "ss-ticket"'))).toBe(false);
  });
});

describe('validateVersionGroup: the registry storyChecklist flag', () => {
  it('fails when the data and the registry disagree', () => {
    const d = load<VersionGroupData>('rby.json');
    delete d.milestones;
    expect(
      validateVersionGroup(d, load<PokedexData>('rby.pokedex.json')).issues.map((i) => i.message),
    ).toContain('Registry version group rby has storyChecklist, but the data has no milestones');
  });
});
