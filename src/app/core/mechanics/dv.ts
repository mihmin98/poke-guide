// FRAMEWORK-FREE: the DV system Generations I and II share (plan §4.5, §13.11). No Angular imports.
//
//   Stat → Formula → Generations I and II  https://bulbapedia.bulbagarden.net/wiki/Stat  (rev 4605719)
//   Individual values → Generation I and II  .../wiki/Individual_values  (rev 4625391)
// Generation II stores the same four DVs; its Special DV (and Special Stat Exp) drives both Special
// Attack and Special Defense (pret/pokecrystal `CalcMonStatC`).
import type { StatId } from '../domain/models';
import type {
  DvSet,
  DvTraitDef,
  IvSolution,
  IvSolveOptions,
  ShinyVerdict,
  StatInput,
  StatObservation,
} from './types';

/** The four DVs actually stored, in the order the HP DV takes their low bits. */
export const STORED_DVS = ['atk', 'def', 'spe', 'spc'] as const;
export type StoredDv = (typeof STORED_DVS)[number];

/** `HP = ⌊((Base + DV) × 2 + ⌊⌈√STATEXP⌉ / 4⌋) × Level / 100⌋ + Level + 10`, other stats `+ 5`. */
export function dvStat(input: StatInput): number {
  const { stat, base, level, iv } = input;
  const effort = Math.max(0, Math.floor(input.effort ?? 0));
  const statPoint = Math.floor(Math.ceil(Math.sqrt(effort)) / 4);
  const core = Math.floor((((base + iv) * 2 + statPoint) * level) / 100);
  return core + (stat === 'hp' ? level + 10 : 5);
}

/** The HP DV is the low bit of the Attack, Defense, Speed and Special DVs, in that order. */
export function hpDv(atk: number, def: number, spe: number, spc: number): number {
  return ((atk & 1) << 3) | ((def & 1) << 2) | ((spe & 1) << 1) | (spc & 1);
}

const SHINY_ATK_DVS = new Set([2, 3, 6, 7, 10, 11, 14, 15]);

/**
 * Generation II's Shiny rule (Individual values §Shininess): Defense, Speed and Special 10, and an Attack
 * DV with bit 1 set. Gen I Pokémon that match become Shiny when moved to Generation II.
 */
export function isShinyDvs(dvs: Partial<Record<StatId, number>>): boolean {
  return (
    dvs.def === 10 &&
    dvs.spe === 10 &&
    dvs.spc === 10 &&
    dvs.atk !== undefined &&
    SHINY_ATK_DVS.has(dvs.atk)
  );
}

export interface DvLayout {
  /** The stats each stored DV drives, in display order once HP is put first. */
  drives: Readonly<Record<StoredDv, readonly StatId[]>>;
  isShiny(dvs: Partial<Record<StatId, number>>): boolean;
  traits?: readonly DvTraitDef[];
}

/**
 * Every DV set consistent with the stats (and traits) the player entered. 16⁴ = 65 536 sets, so this
 * just enumerates them; each observation narrows the survivors further. Stat experience defaults to 0
 * (freshly caught); a stat driven by the Special DV also falls back to the `spc` effort.
 */
export function solveDvs(
  layout: DvLayout,
  base: Partial<Record<StatId, number>>,
  observations: readonly StatObservation[],
  options: IvSolveOptions = {},
): IvSolution {
  const driven = STORED_DVS.flatMap((dv) => layout.drives[dv]);
  const stats: StatId[] = ['hp', ...driven];
  const usable = observations.filter(
    (o) =>
      Number.isFinite(o.level) &&
      o.level >= 1 &&
      stats.some((stat) => typeof o.stats[stat] === 'number'),
  );

  const effortFor = (observation: StatObservation, stat: StatId): number =>
    observation.effort?.[stat] ??
    (layout.drives.spc.includes(stat) ? observation.effort?.spc : undefined) ??
    0;

  const matches = (stat: StatId, dv: number): boolean => {
    const baseStat = base[stat];
    if (baseStat === undefined) return true;
    for (const observation of usable) {
      const expected = observation.stats[stat];
      if (typeof expected !== 'number') continue;
      const value = dvStat({
        stat,
        base: baseStat,
        level: observation.level,
        iv: dv,
        effort: effortFor(observation, stat),
      });
      if (value !== expected) return false;
    }
    return true;
  };

  const species = options.species;
  const traits = species ? (layout.traits ?? []).filter((t) => t.appliesTo(species)) : [];
  const known = traits.map((trait) => {
    const value = options.traits?.[trait.id];
    return value !== undefined && trait.options.some((o) => o.id === value) ? value : undefined;
  });
  const traitValues = traits.map(() => new Set<string>());

  // The four stored DVs are independent, so they are filtered once; HP depends on all four.
  const candidates = {} as Record<StoredDv, number[]>;
  for (const dv of STORED_DVS) {
    candidates[dv] = [];
    for (let value = 0; value <= 15; value++) {
      if (layout.drives[dv].every((stat) => matches(stat, value))) candidates[dv].push(value);
    }
  }

  const possible = new Map<StatId, Set<number>>(stats.map((stat) => [stat, new Set<number>()]));
  let combinations = 0;
  let anyShiny = false;
  let anyPlain = false;

  for (const atk of candidates.atk) {
    for (const def of candidates.def) {
      for (const spe of candidates.spe) {
        for (const spc of candidates.spc) {
          const hp = hpDv(atk, def, spe, spc);
          if (!matches('hp', hp)) continue;
          const dvs: DvSet = { atk, def, spe, spc };
          const values = traits.map((trait) => trait.valueOf(dvs, species!));
          if (values.some((value, i) => known[i] !== undefined && known[i] !== value)) continue;

          combinations++;
          possible.get('hp')!.add(hp);
          for (const dv of STORED_DVS) {
            for (const stat of layout.drives[dv]) possible.get(stat)!.add(dvs[dv]);
          }
          values.forEach((value, i) => traitValues[i]!.add(value));
          if (layout.isShiny(dvs)) anyShiny = true;
          else anyPlain = true;
        }
      }
    }
  }

  const shiny: ShinyVerdict = !anyShiny ? 'no' : anyPlain ? 'possible' : 'yes';
  const result: Partial<Record<StatId, number[]>> = {};
  for (const stat of stats) result[stat] = [...possible.get(stat)!].sort((a, b) => a - b);
  const solution: IvSolution = {
    possible: result,
    combinations,
    contradiction: (usable.length > 0 || known.some((v) => v !== undefined)) && combinations === 0,
    shiny,
  };
  if (traits.length > 0) {
    solution.traits = Object.fromEntries(
      traits.map((trait, i) => [
        trait.id,
        trait.options.map((o) => o.id).filter((id) => traitValues[i]!.has(id)),
      ]),
    );
  }
  return solution;
}
