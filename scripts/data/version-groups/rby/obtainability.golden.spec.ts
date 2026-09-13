import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VersionGroupData } from '../../../../src/app/core/domain/models';
import { buildChecklist, maxInOneSave } from '../../../../src/app/core/domain/obtainability';
import { GAMES, getVersionGroup } from '../../../../src/app/core/games/registry';
import { repoRoot } from '../../core/paths';

const data = JSON.parse(readFileSync(join(repoRoot(), 'public', 'data', 'rby.json'), 'utf8')) as VersionGroupData;
const features = getVersionGroup('rby').features;

describe('rby data: obtainability (plan §7.8, §9)', () => {
  for (const game of GAMES.filter((g) => g.versionGroupId === 'rby')) {
    const entries = buildChecklist(data, game, features);
    const reason = (dex: number) => entries.find((e) => e.dex === dex)!.unobtainableReason;

    it(`${game.shortName}: trade evolutions and Mew are unobtainable, and every species has a source or reason`, () => {
      for (const dex of [65, 68, 76, 94]) expect(reason(dex)).toBe('trade-evolution');
      expect(reason(151)).toBe('event-only');
      expect(entries.filter((e) => e.unobtainableReason === 'not-in-game')).toEqual([]);
      expect(entries.filter((e) => e.obtainable).every((e) => e.sources.length > 0)).toBe(true);
    });

    it(`${game.shortName}: exclusive choices lower the maximum in one save`, () => {
      const obtainable = entries.filter((e) => e.obtainable).length;
      // Red/Blue: starter (lose 2 families = 6), fossil (lose 1 family = 2), Dojo (1). Yellow: fossil and Dojo only.
      expect(obtainable - maxInOneSave(data, game, features, entries)).toBe(game.id === 'yellow' ? 3 : 9);
    });
  }

  it('reports version exclusives with the games that have them', () => {
    const red = buildChecklist(data, GAMES.find((g) => g.id === 'red')!, features);
    expect(red.find((e) => e.dex === 27)).toMatchObject({ unobtainableReason: 'other-version', unobtainableDetail: 'Available in blue, yellow' });
  });
});
