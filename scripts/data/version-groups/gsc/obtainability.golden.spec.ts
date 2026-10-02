import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VersionGroupData } from '../../../../src/app/core/domain/models';
import { buildChecklist, maxInOneSave } from '../../../../src/app/core/domain/obtainability';
import { GAMES, getVersionGroup } from '../../../../src/app/core/games/registry';
import { repoRoot } from '../../core/paths';

const data = JSON.parse(
  readFileSync(join(repoRoot(), 'public', 'data', 'gsc.json'), 'utf8'),
) as VersionGroupData;
const features = getVersionGroup('gsc').features;
const game = (id: string) => GAMES.find((g) => g.id === id)!;

/** The species each game lacks that another Generation II game has (Bulbapedia's version-exclusive lists). */
const OTHER_VERSION: Record<string, number[]> = {
  gold: [37, 38, 52, 53, 165, 166, 225, 227, 231, 232],
  silver: [56, 57, 58, 59, 167, 168, 207, 216, 217, 226],
  crystal: [37, 38, 56, 57, 179, 180, 181, 203, 223, 224],
};
const TRADE_EVOLUTIONS = [65, 68, 76, 94, 186, 199, 208, 212, 230, 233];
const TIME_CAPSULE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 138, 139, 140, 141, 144, 145, 146, 150];

describe('gsc data: obtainability (plan §9, §16 Phase 10)', () => {
  for (const definition of GAMES.filter((g) => g.versionGroupId === 'gsc')) {
    const entries = buildChecklist(data, definition, features);
    const entry = (dex: number) => entries.find((e) => e.dex === dex)!;
    const withReason = (reason: string) =>
      entries.filter((e) => e.unobtainableReason === reason).map((e) => e.dex);

    it(`${definition.shortName}: every species 1–251 has a source or a reason`, () => {
      expect(entries).toHaveLength(251);
      expect(entries.filter((e) => e.obtainable)).toHaveLength(212);
      expect(withReason('not-in-game')).toEqual([]);
      expect(entries.filter((e) => e.obtainable).every((e) => e.sources.length > 0)).toBe(true);
    });

    it(`${definition.shortName}: sorts the unobtainable species into their reasons`, () => {
      expect(withReason('trade-evolution')).toEqual(TRADE_EVOLUTIONS);
      expect(withReason('event-only')).toEqual([151, 251]);
      expect(withReason('other-version')).toEqual(OTHER_VERSION[definition.id]);
      expect(withReason('requires-other-game')).toEqual(TIME_CAPSULE);
      expect(entry(150).unobtainableDetail).toBe(
        'Transfer from Red, Blue or Yellow through the Time Capsule',
      );
    });

    it(`${definition.shortName}: only the starter choice lowers the maximum in one save`, () => {
      // Two of the three starter families (3 species each) are lost. Crystal's Odd Egg babies can all be bred.
      expect(212 - maxInOneSave(data, definition, features, entries)).toBe(6);
    });

    it(`${definition.shortName}: breeds the baby Pokémon and evolves by friendship, time and stats`, () => {
      for (const baby of [172, 173, 174, 238, 239, 240]) {
        expect(entry(baby).sources.some((s) => s.kind === 'breeding')).toBe(true);
      }
      expect(entry(196).sources.map((s) => s.evolution?.timeOfDay)).toEqual(['day']);
      expect(entry(197).sources.map((s) => s.evolution?.timeOfDay)).toEqual(['night']);
      for (const hitmon of [106, 107, 237]) {
        expect(entry(hitmon).sources.some((s) => s.evolution?.from === 236)).toBe(true);
      }
    });

    it(`${definition.shortName}: counts the roaming beasts and the Bug-Catching Contest`, () => {
      for (const beast of [243, 244]) {
        expect(entry(beast).sources.map((s) => s.method)).toEqual(['roaming']);
      }
      expect(entry(123).sources.some((s) => s.method === 'bug-contest')).toBe(true);
    });
  }

  it('makes Suicune a static encounter in Crystal and a roamer in Gold and Silver', () => {
    const methods = (id: string) =>
      buildChecklist(data, game(id), features)
        .find((e) => e.dex === 245)!
        .sources.map((s) => s.method);
    expect(methods('gold')).toEqual(['roaming']);
    expect(methods('silver')).toEqual(['roaming']);
    expect(methods('crystal')).toEqual(['static']);
  });

  it('gives the Odd Egg babies a second, exclusive source in Crystal only', () => {
    const pichu = (id: string) =>
      buildChecklist(data, game(id), features).find((e) => e.dex === 172)!;
    expect(pichu('crystal').exclusiveGroupIds).toEqual(['odd-egg']);
    expect(new Set(pichu('crystal').sources.map((s) => s.kind))).toEqual(
      new Set(['breeding', 'encounter']),
    );
    expect(pichu('gold').exclusiveGroupIds).toEqual([]);
  });

  it('reports version exclusives with the games that have them', () => {
    const gold = buildChecklist(data, game('gold'), features);
    expect(gold.find((e) => e.dex === 52)).toMatchObject({
      unobtainableReason: 'other-version',
      unobtainableDetail: 'Available in silver, crystal',
    });
    expect(gold.find((e) => e.dex === 37)!.unobtainableDetail).toBe('Available in silver');
  });
});
