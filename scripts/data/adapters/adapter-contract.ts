/**
 * Shared contract suite that every CatchTemplateAdapter must pass (plan §14). Import from a spec file.
 */
import type { EncounterMethodId, GameId, LocationKind } from '../../../src/app/core/domain/models';
import { GAMES } from '../../../src/app/core/games/registry';
import { isKnownMethod } from '../../../src/app/core/games/methods';
import { parseTemplate } from '../core/wikitext';
import {
  AdapterError,
  type CatchTemplateAdapter,
  type WalkContext,
} from './catch-template-adapter';

export interface AdapterContractCase {
  description: string;
  /** A single row template. */
  wikitext: string;
  locationKind?: LocationKind;
  expected: {
    dex: number;
    games: GameId[];
    method: EncounterMethodId;
    slotCount: number;
    subArea?: string;
    requires?: string[];
    /** `time` condition values per slot, for time-of-day adapters. */
    times?: string[];
  };
}

function context(locationKind: LocationKind = 'route'): WalkContext {
  return { pageTitle: 'Contract test', locationKind, subArea: null, divLabel: null };
}

export function describeAdapterContract(
  adapter: CatchTemplateAdapter,
  cases: readonly AdapterContractCase[],
): void {
  describe(`${adapter.id} adapter contract`, () => {
    it('declares normalized template names and registry games', () => {
      expect(adapter.templateNames.length).toBeGreaterThan(0);
      for (const name of adapter.templateNames) expect(name).toBe(name.trim().toLowerCase());
      const known = new Set<string>(
        GAMES.map((g) => g.id).concat(['gold', 'silver', 'ruby', 'sapphire']),
      );
      for (const game of adapter.games) expect(known.has(game)).toBe(true);
    });

    it.each(cases)('$description', ({ wikitext, locationKind, expected }) => {
      const template = parseTemplate(wikitext);
      expect(template).not.toBeNull();
      expect(adapter.templateNames).toContain(template!.name);

      const ctx = context(locationKind);
      const row = adapter.parseRow(template!, ctx);
      const method = adapter.normalizeMethod(row, ctx);

      expect(row.dex).toBe(expected.dex);
      expect(row.games).toEqual(expected.games);
      expect(row.games.every((g) => adapter.games.includes(g))).toBe(true);
      expect(isKnownMethod(method.method)).toBe(true);
      expect(method.method).toBe(expected.method);
      expect(row.slots).toHaveLength(expected.slotCount);
      if (expected.subArea !== undefined) expect(method.subArea).toBe(expected.subArea);
      if (expected.requires !== undefined) expect(method.requires ?? []).toEqual(expected.requires);
      if (expected.times !== undefined) {
        expect(row.slots.map((s) => s.conditions?.find((c) => c.kind === 'time'))).toEqual(
          expected.times.map((value) => ({ kind: 'time', value })),
        );
      }
      for (const slot of row.slots) {
        if (slot.levels) {
          expect(slot.levels.min).toBeGreaterThanOrEqual(1);
          expect(slot.levels.max).toBeLessThanOrEqual(100);
          expect(slot.levels.min).toBeLessThanOrEqual(slot.levels.max);
        }
        if (slot.rate.kind === 'percent') {
          expect(slot.rate.value).toBeGreaterThan(0);
          expect(slot.rate.value).toBeLessThanOrEqual(100);
        }
      }
    });

    it('rejects an unknown method', () => {
      const first = cases[0]!;
      const ctx = context(first.locationKind);
      const row = adapter.parseRow(parseTemplate(first.wikitext)!, ctx);
      expect(() => adapter.normalizeMethod({ ...row, rawMethod: 'Teleporter' }, ctx)).toThrow(
        AdapterError,
      );
    });

    it('rejects a malformed National Dex number', () => {
      const template = parseTemplate(cases[0]!.wikitext)!;
      const broken = { ...template, positional: ['abc', ...template.positional.slice(1)] };
      expect(() => adapter.parseRow(broken, context())).toThrow(AdapterError);
    });
  });
}
