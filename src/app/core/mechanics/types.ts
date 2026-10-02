// FRAMEWORK-FREE: per-generation rules (plan §4.5). No Angular imports.
//
// A version group picks its module through `VersionGroupDefinition.mechanicsId`. Everything here is
// generic: the tool pages (plan §13.11) render whatever balls, statuses, inputs and summary-screen traits
// a module declares, so adding a generation means adding its module, not touching the UI.
import type { Species, StatId } from '../domain/models';
import type { GameId } from '../games/types';

export interface SourceRef {
  label: string;
  url: string;
  /** Where the page lives; Bulbapedia when absent. */
  site?: string;
}

/** What a generation's rules may read about the target species (Heavy Ball weight, gender ratio). */
export type TargetSpecies = Pick<Species, 'dex' | 'weightKg' | 'genderRatio'>;

export interface BallDef {
  id: string;
  name: string;
  /** Shown as the default choice and first in comparison tables. */
  common?: boolean;
  /**
   * A ball handed out in a fixed number for one place (Safari Balls, Park Balls): the page also shows
   * the chance of a catch before they run out.
   */
  limited?: { count: number; label: string };
}

export interface StatusDef {
  id: string;
  label: string;
}

interface CaptureInputBase {
  id: string;
  label: string;
  /** Explains when the input applies ("Only in the Safari Zone"). */
  hint?: string;
  /** Shown, and read by `compute`, only for these balls. Absent: it applies to every throw. */
  balls?: string[];
}

/**
 * A capture modifier that is not a ball or a status: the Gen I Safari Game's bait and rocks, or the
 * situation a Gen II Apricorn ball checks (fishing, the player's Pokémon).
 */
export type CaptureInputDef =
  | (CaptureInputBase & {
      kind: 'select';
      options: { id: string; label: string }[];
      defaultValue: string;
    })
  | (CaptureInputBase & {
      kind: 'number';
      min: number;
      max: number;
      /** `'target-level'` starts the field at the wild Pokémon's level. */
      defaultValue: number | 'target-level';
    })
  | (CaptureInputBase & { kind: 'boolean'; defaultValue: boolean });

export type CaptureInputValue = string | number | boolean;

export interface CaptureInput {
  /** The species' catch rate for the game, already resolved (`catchRateFor`, location-model.ts). */
  catchRate: number;
  ballId: string;
  statusId: string;
  currentHp: number;
  maxHp: number;
  /** The wild Pokémon's level (the Gen II Level Ball compares it with the player's). */
  level?: number;
  /** Balls that read the species (weight, gender) give no bonus without it. */
  target?: TargetSpecies;
  /** The game played, for quirks that differ inside a version group (Crystal's Heavy Ball). */
  game?: GameId;
  /** `CaptureInputDef` id → value. Unknown ids are ignored; a missing one takes its default. */
  inputs?: Readonly<Record<string, CaptureInputValue>>;
}

export interface CaptureResult {
  /** Exact probability of catching with one throw, 0–1. */
  probability: number;
  /** 1 / probability, or `null` when capture is impossible. */
  expectedThrows: number | null;
  /** Balls needed to reach each confidence level, or `null` when capture is impossible. */
  throwsFor: { p50: number; p90: number; p99: number } | null;
  /** The catch rate after the ball and inputs changed it (Gen I bait/rock, Gen II balls). */
  effectiveCatchRate: number;
  /** Where `reportsShakes`: how many times the ball shakes when the Pokémon breaks free (0 = a miss). */
  shakesOnFailure?: number;
  /** True when no throw can fail (a Master Ball, or a value the formula guarantees). */
  guaranteed: boolean;
  /** What changed the odds and why, game bugs included ("The Moon Ball never gets its bonus"). */
  notes?: string[];
}

export interface CaptureFormula {
  balls: BallDef[];
  statuses: StatusDef[];
  inputs?: CaptureInputDef[];
  /** Whether the break-free animation is fixed for a given throw, so it carries information (Gen I). */
  reportsShakes: boolean;
  /** Explains how to read the shakes, where `reportsShakes`. */
  shakesNote?: string;
  compute(input: CaptureInput): CaptureResult;
}

export interface StatInput {
  stat: StatId;
  base: number;
  level: number;
  /** DV (Gen I–II) or IV (Gen III+). */
  iv: number;
  /** Stat experience (Gen I–II) or EVs (Gen III+). Defaults to 0. */
  effort?: number;
  /** Gen III+ only; ignored where natures don't exist. */
  natureMultiplier?: number;
}

/** One set of stats read off the summary screen, at the level it was read. */
export interface StatObservation {
  level: number;
  /** Only the stats the player filled in. */
  stats: Partial<Record<StatId, number>>;
  /** Stat experience per stat; defaults to 0 (a freshly caught Pokémon). */
  effort?: Partial<Record<StatId, number>>;
}

export type ShinyVerdict = 'yes' | 'no' | 'possible';

/** The four DVs Gen I–II store; HP is built from them. */
export type DvSet = Readonly<Record<'atk' | 'def' | 'spe' | 'spc', number>>;

/**
 * Something on the summary screen besides the stats that the DVs decide (Gen II: gender, Shiny,
 * Unown's letter). The player can enter it to narrow the DVs, and the solver lists what still fits.
 */
export interface DvTraitDef {
  id: string;
  label: string;
  options: { id: string; label: string }[];
  /** Whether the species has the trait at all (gender: not for genderless or single-gender species). */
  appliesTo(species: TargetSpecies): boolean;
  /** The option id a complete DV set gives. */
  valueOf(dvs: DvSet, species: TargetSpecies): string;
}

export interface IvSolveOptions {
  /** Needed for `dvTraits`. */
  species?: TargetSpecies;
  /** Trait id → option id the player read off the summary screen. */
  traits?: Readonly<Record<string, string>>;
}

export interface IvSolution {
  /** Possible values per stat, ascending. Empty for a stat with no consistent value. */
  possible: Partial<Record<StatId, number[]>>;
  /** How many complete IV/DV sets match every observation. */
  combinations: number;
  /** True when nothing matches: the stats, level, traits or base stats disagree. */
  contradiction: boolean;
  /** Whether the matching sets are Shiny, by `shiny.transfer` or `shiny.dvRule`. */
  shiny: ShinyVerdict;
  /** Trait id → option ids still possible, for the traits that apply to the species. */
  traits?: Partial<Record<string, string[]>>;
}

export interface ShinyRules {
  /** Whether Shiny Pokémon can appear in this generation's own games. */
  inGame: boolean;
  /** Base odds as a denominator (1/`odds`), when `inGame`. */
  odds?: number;
  /** Where the DVs decide shininess in the game itself (Gen II): the rule as the UI states it. */
  dvRule?: {
    label: string;
    description: string;
    isShiny(dvs: Partial<Record<StatId, number>>): boolean;
  };
  /**
   * Set when a Pokémon caught here becomes Shiny after transfer to a later generation (Gen I → II):
   * the rule is stated for the UI, and `isShiny` decides from a complete IV/DV set.
   */
  transfer?: {
    label: string;
    description: string;
    isShiny(ivs: Partial<Record<StatId, number>>): boolean;
    /** Encounter methods whose values are correlated, so the result can never be Shiny. */
    impossibleMethods?: string[];
    impossibleNote?: string;
  };
}

export interface GenerationMechanics {
  id: string;
  /** The stats this generation has, in display order. */
  stats: StatId[];
  statLabels: Record<string, string>;
  ivSystem:
    | { kind: 'dv'; max: 15; hpDerived: true; label: string }
    | { kind: 'iv'; max: 31; hpDerived: false; label: string };
  shiny: ShinyRules;
  capture: CaptureFormula;
  /** One permanent stat, with the generation's rounding. */
  statValue(input: StatInput): number;
  /**
   * What one defeated Pokémon of these base stats gives the winner. Gen I–II hand out Stat Exp equal to
   * the defeated species' base stats, which is why no EV yield is stored for them (plan §8).
   */
  effortFromDefeat(baseStats: Partial<Record<StatId, number>>): Partial<Record<StatId, number>>;
  /** How that effort is described in this generation ("Stat Exp", "EVs"). */
  effortLabel: string;
  /** One sentence for the base-stat table: what defeating the species gives. */
  effortDescription: string;
  /** Summary-screen details the DVs decide, for the IV/DV calculator. */
  dvTraits?: DvTraitDef[];
  /** Narrows IVs/DVs from summary-screen stats (plan §13.11). */
  solveIvs(
    base: Partial<Record<StatId, number>>,
    observations: readonly StatObservation[],
    options?: IvSolveOptions,
  ): IvSolution;
  /** Bulbapedia pages the rules come from; shown on the tool pages. */
  sources: SourceRef[];
}
