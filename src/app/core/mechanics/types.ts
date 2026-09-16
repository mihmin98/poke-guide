// FRAMEWORK-FREE: per-generation rules (plan §4.5). No Angular imports.
//
// A version group picks its module through `VersionGroupDefinition.mechanicsId`. Everything here is
// generic: the tool pages (plan §13.11) render whatever balls, statuses and contexts a module declares,
// so adding Gen II means adding `gen2.ts`, not touching the UI.
import type { StatId } from '../domain/models';

export interface SourceRef {
  label: string;
  url: string;
}

export interface BallDef {
  id: string;
  name: string;
  /** Shown as the default choice and first in comparison tables. */
  common?: boolean;
}

export interface StatusDef {
  id: string;
  label: string;
}

/** A capture modifier that is not a ball or a status, e.g. the Gen I Safari Game's bait and rocks. */
export interface CaptureContextDef {
  id: string;
  label: string;
  /** Explains when the context applies ("Only in the Safari Zone"). */
  hint?: string;
  options: { id: string; label: string }[];
  defaultOptionId: string;
}

export interface CaptureInput {
  /** The species' catch rate for the game, already resolved (`catchRateFor`, location-model.ts). */
  catchRate: number;
  ballId: string;
  statusId: string;
  currentHp: number;
  maxHp: number;
  /** Context id → option id. Unknown ids are ignored. */
  context?: Readonly<Record<string, string>>;
}

export interface CaptureResult {
  /** Exact probability of catching with one throw, 0–1. */
  probability: number;
  /** 1 / probability, or `null` when capture is impossible. */
  expectedThrows: number | null;
  /** Balls needed to reach each confidence level, or `null` when capture is impossible. */
  throwsFor: { p50: number; p90: number; p99: number } | null;
  /** The catch rate after context modifiers (Gen I bait/rock). */
  effectiveCatchRate: number;
  /** How many times the ball shakes when the Pokémon breaks free (0 = the ball misses). */
  shakesOnFailure: number;
  /** True when no throw can fail (a Master Ball, or a value the formula guarantees). */
  guaranteed: boolean;
}

export interface CaptureFormula {
  balls: BallDef[];
  statuses: StatusDef[];
  contexts?: CaptureContextDef[];
  /** Whether the generation's break-free animation carries information (Gen I shakes). */
  reportsShakes: boolean;
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

export interface IvSolution {
  /** Possible values per stat, ascending. Empty for a stat with no consistent value. */
  possible: Partial<Record<StatId, number[]>>;
  /** How many complete IV/DV sets match every observation. */
  combinations: number;
  /** True when nothing matches: the stats, level or base stats disagree. */
  contradiction: boolean;
  /** Only meaningful where `shiny.transfer` is set (Gen I → II). */
  shiny: ShinyVerdict;
}

export interface ShinyRules {
  /** Whether Shiny Pokémon can appear in this generation's own games. */
  inGame: boolean;
  /** Base odds as a denominator (1/`odds`), when `inGame`. */
  odds?: number;
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
  /** Narrows IVs/DVs from summary-screen stats (plan §13.11). */
  solveIvs(base: Partial<Record<StatId, number>>, observations: readonly StatObservation[]): IvSolution;
  /** Bulbapedia pages the rules come from; shown on the tool pages. */
  sources: SourceRef[];
}
