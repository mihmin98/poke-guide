import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixturesDir } from '../../core/paths';
import { rbyConfig } from './config';

describe('rby location config', () => {
  const { locations, games, walkthroughs } = rbyConfig;

  it('has unique ids and pages', () => {
    expect(new Set(locations.map((l) => l.id)).size).toBe(locations.length);
    expect(new Set(locations.map((l) => l.page)).size).toBe(locations.length);
  });

  it('lists locations in non-decreasing part order for every game, with a walkthrough title per part', () => {
    for (const game of games) {
      const parts = locations.flatMap((l) => (l.placement[game] ? [l.placement[game].part] : []));
      expect(parts).toEqual([...parts].sort((a, b) => a - b));
      const titled = new Set(walkthroughs[game]!.map((p) => p.part));
      for (const part of parts) expect(titled.has(part)).toBe(true);
    }
  });

  it('places every location in all three games', () => {
    for (const location of locations) expect(Object.keys(location.placement).sort()).toEqual(['blue', 'red', 'yellow']);
  });

  it('covers the Bulbapedia location category exactly (snapshot)', () => {
    const snapshot = JSON.parse(readFileSync(join(fixturesDir('rby'), 'category-members.json'), 'utf8')) as {
      members: string[];
    };
    const configured = new Set(locations.map((l) => l.page));
    const ignored = new Set(rbyConfig.ignoredCategoryPages);
    for (const page of configured) expect(ignored.has(page)).toBe(false);
    expect([...configured, ...ignored].sort()).toEqual([...snapshot.members].sort());
  });
});
