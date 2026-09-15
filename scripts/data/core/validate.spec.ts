import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PokedexData, VersionGroupData } from '../../../src/app/core/domain/models';
import { repoRoot } from './paths';
import { validateVersionGroup } from './validate';

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
    encounter.method = 'headbutt';
    encounter.games['gold'] = encounter.games['red'];
    d.eventOnly = [];
    const messages = validateVersionGroup(d, pokedex).issues.map((i) => i.message);
    expect(messages).toContain(
      `#${encounter.dex} headbutt in route-1/main: unknown method "headbutt"`,
    );
    expect(messages).toContain(
      `#${encounter.dex} headbutt in route-1/main slot has game "gold", which is not in the version group`,
    );
    expect(messages).toContain('#151 Mew has no source and no unobtainable reason in red');
  });
});
