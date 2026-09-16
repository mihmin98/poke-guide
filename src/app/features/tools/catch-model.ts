// Pure view model for the catch-chance tools (plan §13.11): no Angular, so it can be unit-tested on its own.
import type { StatId } from '../../core/domain/models';
import type {
  BallDef,
  CaptureInput,
  CaptureResult,
  GenerationMechanics,
  StatusDef,
} from '../../core/mechanics';

export interface CatchCell {
  ballId: string;
  statusId: string;
  result: CaptureResult;
  /** The highest chance in this status column, ignoring balls that always work. */
  best: boolean;
}

export interface CatchRow {
  ball: BallDef;
  cells: CatchCell[];
}

export interface CatchGrid {
  statuses: StatusDef[];
  rows: CatchRow[];
}

export type GridInput = Omit<CaptureInput, 'ballId' | 'statusId'>;

/**
 * Every ball × status combination at one HP value. Gen I is the reason this exists: a Great Ball can
 * beat an Ultra Ball, and only a table makes that visible.
 */
export function buildCatchGrid(
  mechanics: GenerationMechanics,
  input: GridInput,
  options: { includeGuaranteed?: boolean } = {},
): CatchGrid {
  const { balls, statuses } = mechanics.capture;
  const rows: CatchRow[] = balls.map((ball) => ({
    ball,
    cells: statuses.map((status) => ({
      ballId: ball.id,
      statusId: status.id,
      result: mechanics.capture.compute({ ...input, ballId: ball.id, statusId: status.id }),
      best: false,
    })),
  }));

  // A ball that works whatever the situation (the Master Ball) is never the interesting answer.
  const contenders = options.includeGuaranteed
    ? rows
    : rows.filter((row) => !alwaysWorks(mechanics, row.ball.id));

  statuses.forEach((_, column) => {
    const best = Math.max(...contenders.map((row) => row.cells[column]!.result.probability), 0);
    if (best <= 0) return;
    for (const row of contenders) {
      const cell = row.cells[column]!;
      if (cell.result.probability === best) cell.best = true;
    }
  });

  return { statuses, rows };
}

/** True when the ball catches even the hardest Pokémon at full HP with no status. */
export function alwaysWorks(mechanics: GenerationMechanics, ballId: string): boolean {
  return (
    mechanics.capture.compute({
      catchRate: 3,
      ballId,
      statusId: mechanics.capture.statuses[0]?.id ?? 'none',
      currentHp: 100,
      maxHp: 100,
    }).probability === 1
  );
}

/** Chance of at least one success in `throws` independent throws, 0–1. */
export function chanceWithin(probability: number, throws: number): number {
  if (probability <= 0 || throws <= 0) return 0;
  return 1 - (1 - probability) ** throws;
}

/** "42.1%", with more decimals for long odds so a 0.03% chance doesn't read as 0%. */
export function formatChance(probability: number): string {
  if (probability >= 1) return '100%';
  if (probability <= 0) return '0%';
  const percent = probability * 100;
  const decimals = percent >= 10 ? 1 : percent >= 1 ? 2 : 3;
  return `${percent.toFixed(decimals)}%`;
}

/** "1 in 6" — easier to act on than a percentage when the odds are long. */
export function formatOdds(expectedThrows: number | null): string {
  if (expectedThrows === null) return 'never';
  return `1 in ${expectedThrows < 10 ? expectedThrows.toFixed(1) : Math.round(expectedThrows)}`;
}

/**
 * A plausible max HP at a level, for the HP slider: the generation's HP formula with a middling DV and
 * no stat experience. The player can overwrite it with the real number from the battle screen.
 */
export function estimateMaxHp(
  mechanics: GenerationMechanics,
  baseStats: Partial<Record<StatId, number>>,
  level: number,
): number {
  const base = baseStats.hp;
  if (base === undefined) return 1;
  const iv = Math.floor(mechanics.ivSystem.max / 2);
  return Math.max(1, mechanics.statValue({ stat: 'hp', base, level, iv }));
}

/** Current HP for a percentage of max, never below 1 (a fainted Pokémon can't be caught). */
export function hpAtPercent(maxHp: number, percent: number): number {
  return Math.max(1, Math.min(maxHp, Math.round((maxHp * percent) / 100)));
}
