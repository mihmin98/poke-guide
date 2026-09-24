import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixturesDir } from '../../core/paths';
import { placeLocations } from '../../core/assemble';
import { rbyConfig } from '../rby/config';
import { gscConfig } from './config';

describe('gsc location config', () => {
  const { locations, games, walkthroughs } = gscConfig;
  const placements = placeLocations(locations, games);

  it('has unique ids and pages', () => {
    expect(new Set(locations.map((l) => l.id)).size).toBe(locations.length);
    expect(new Set(locations.map((l) => l.page)).size).toBe(locations.length);
  });

  it('has 29 walkthrough parts per game, Johto then Kanto then Johto again', () => {
    for (const game of games) {
      const parts = walkthroughs[game]!;
      expect(parts.map((p) => p.part)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
      expect(parts.filter((p) => p.region === 'kanto').map((p) => p.part)).toEqual(
        Array.from({ length: 13 }, (_, i) => i + 16),
      );
    }
  });

  it("lists every game's locations in part order, apart from Gold and Silver's Tin Tower", () => {
    // The list follows Crystal's order; Gold and Silver enter Tin Tower in Part 29, Crystal in Part 12.
    for (const game of games) {
      const parts = locations.flatMap((l) =>
        l.placement[game] && !(game !== 'crystal' && l.id === 'tin-tower')
          ? [l.placement[game].part]
          : [],
      );
      expect(parts).toEqual([...parts].sort((a, b) => a - b));
    }
    expect(placements.get('tin-tower')).toEqual({
      gold: { part: 29, order: 2900 },
      silver: { part: 29, order: 2900 },
      crystal: { part: 12, order: 1200 },
    });
  });

  it('places a location in a part with a walkthrough title', () => {
    for (const game of games) {
      const titled = new Set(walkthroughs[game]!.map((p) => p.part));
      for (const location of locations) {
        const placement = location.placement[game];
        if (placement) expect(titled.has(placement.part)).toBe(true);
      }
    }
  });

  it('places every location in all three games, except the Crystal-only Battle Tower', () => {
    for (const location of locations) {
      const expected = location.id === 'battle-tower' ? ['crystal'] : ['crystal', 'gold', 'silver'];
      expect(Object.keys(location.placement).sort()).toEqual(expected);
    }
  });

  it('reuses the rby id of every Kanto page both groups list', () => {
    const rbyIds = new Map(rbyConfig.locations.map((l) => [l.page, l.id]));
    for (const location of locations) {
      const rbyId = rbyIds.get(location.page);
      // The Pokémon Tower page's Generation II content is the Kanto Radio Tower that replaced it.
      if (rbyId && location.page !== 'Pokémon Tower') expect(location.id).toBe(rbyId);
    }
  });

  it('covers the Bulbapedia location category exactly (snapshot)', () => {
    const snapshot = JSON.parse(
      readFileSync(join(fixturesDir('gsc'), 'category-members.json'), 'utf8'),
    ) as { members: string[] };
    const configured = new Set(locations.map((l) => l.page));
    const ignored = new Set(gscConfig.ignoredCategoryPages);
    for (const page of configured) expect(ignored.has(page)).toBe(false);
    expect([...configured, ...ignored].sort()).toEqual([...snapshot.members].sort());
  });
});
