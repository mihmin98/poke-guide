import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PokedexData, VersionGroupData } from '../../../src/app/core/domain/models';
import { repoRoot } from './paths';
import { renderReport } from './report';
import { validateVersionGroup } from './validate';

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(join(repoRoot(), 'public', 'data', file), 'utf8')) as T;

describe('renderReport', () => {
  const data = load<VersionGroupData>('rby.json');
  const { checklists } = validateVersionGroup(data, load<PokedexData>('rby.pokedex.json'));

  it('lists counts, unobtainable species, encounter changes and issues', () => {
    const previous = load<VersionGroupData>('rby.json');
    const route1 = previous.locations.find((l) => l.id === 'route-1')!;
    route1.subAreas[0]!.encounters.shift();
    const report = renderReport({
      data,
      previous,
      checklists,
      issues: [
        { level: 'warning', page: 'Vermilion City', message: 'Tentacool types' },
        { level: 'error', message: 'not in the report' },
      ],
    });
    expect(report).toMatch(/^\| Pokémon Red \| \d+ \/ 151 \| \d+ \| \d+ \| 4 \| 1 \| 0 \|$/m);
    expect(report).toContain('- #65 Alakazam: trade-evolution (Evolves from Kadabra by trade)');
    expect(report).toContain('- #151 Mew: event-only');
    expect(report).toMatch(/### route-1\n\n- added: main · walk-grass · #\d+ /);
    expect(report).toContain('## Warnings (1)\n\n- [Vermilion City] Tentacool types');
    expect(report).not.toContain('not in the report');
  });

  it('says so when there is no previous build or no change', () => {
    expect(renderReport({ data, previous: null, checklists, issues: [] })).toContain(
      'No previous build.',
    );
    expect(renderReport({ data, previous: data, checklists, issues: [] })).toContain(
      '## Encounter changes since the previous build\n\nNone.',
    );
  });
});
