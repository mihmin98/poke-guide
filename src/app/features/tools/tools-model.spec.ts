import { describe, expect, it } from 'vitest';
import { GEN1_MECHANICS } from '../../core/mechanics/gen1';
import {
  alwaysWorks,
  buildCatchGrid,
  chanceWithin,
  estimateMaxHp,
  formatChance,
  formatOdds,
  hpAtPercent,
} from './catch-model';
import { formatIvList, narrowingLabel, shinyLabel } from './iv-model';

describe('catch grid (plan §13.11)', () => {
  const grid = buildCatchGrid(GEN1_MECHANICS, { catchRate: 190, currentHp: 100, maxHp: 100 });

  it('covers every ball and status', () => {
    expect(grid.rows.map((row) => row.ball.id)).toEqual([
      'poke',
      'great',
      'ultra',
      'safari',
      'master',
    ]);
    expect(grid.statuses.map((s) => s.id)).toEqual(['none', 'sleep', 'other']);
    for (const row of grid.rows) expect(row.cells).toHaveLength(3);
  });

  it('highlights the best ball per status, ignoring the Master Ball', () => {
    const best = grid.rows.filter((row) => row.cells.some((cell) => cell.best));
    expect(best.map((row) => row.ball.id)).not.toContain('master');
    for (let column = 0; column < grid.statuses.length; column++) {
      const marked = grid.rows.filter((row) => row.cells[column]!.best);
      expect(marked.length).toBeGreaterThan(0);
      const bestValue = Math.max(
        ...grid.rows
          .filter((row) => row.ball.id !== 'master')
          .map((row) => row.cells[column]!.result.probability),
      );
      for (const row of marked) expect(row.cells[column]!.result.probability).toBe(bestValue);
    }
  });

  it('marks a Great Ball as the best choice on a high catch rate at full HP', () => {
    const highRate = buildCatchGrid(GEN1_MECHANICS, {
      catchRate: 255,
      currentHp: 100,
      maxHp: 100,
    });
    const bestNoStatus = highRate.rows.find((row) => row.cells[0]!.best);
    expect(bestNoStatus?.ball.id).toBe('great');
  });

  it('includes the Master Ball when asked', () => {
    const withGuaranteed = buildCatchGrid(
      GEN1_MECHANICS,
      { catchRate: 3, currentHp: 100, maxHp: 100 },
      { includeGuaranteed: true },
    );
    expect(withGuaranteed.rows.find((row) => row.ball.id === 'master')?.cells[0]?.best).toBe(true);
  });

  it('knows which balls always work', () => {
    expect(alwaysWorks(GEN1_MECHANICS, 'master')).toBe(true);
    expect(alwaysWorks(GEN1_MECHANICS, 'ultra')).toBe(false);
  });
});

describe('catch formatting', () => {
  it('keeps long odds readable', () => {
    expect(formatChance(1)).toBe('100%');
    expect(formatChance(0)).toBe('0%');
    expect(formatChance(0.4213)).toBe('42.1%');
    expect(formatChance(0.0512)).toBe('5.12%');
    expect(formatChance(0.0003)).toBe('0.030%');
  });

  it('states the odds as "1 in n"', () => {
    expect(formatOdds(null)).toBe('never');
    expect(formatOdds(5.73)).toBe('1 in 5.7');
    expect(formatOdds(64.2)).toBe('1 in 64');
  });

  it('accumulates chances over several throws', () => {
    expect(chanceWithin(0.5, 1)).toBeCloseTo(0.5, 10);
    expect(chanceWithin(0.5, 2)).toBeCloseTo(0.75, 10);
    expect(chanceWithin(0, 30)).toBe(0);
    expect(chanceWithin(0.2, 0)).toBe(0);
  });
});

describe('HP helpers', () => {
  it('estimates a max HP from the generation formula', () => {
    // Pikachu, base HP 35, level 20, DV 7 (the middle of 0..15), no Stat Exp.
    expect(estimateMaxHp(GEN1_MECHANICS, { hp: 35 }, 20)).toBe(
      GEN1_MECHANICS.statValue({ stat: 'hp', base: 35, level: 20, iv: 7 }),
    );
    expect(estimateMaxHp(GEN1_MECHANICS, {}, 20)).toBe(1);
  });

  it('never lets the slider reach zero HP', () => {
    expect(hpAtPercent(60, 100)).toBe(60);
    expect(hpAtPercent(60, 50)).toBe(30);
    expect(hpAtPercent(60, 1)).toBe(1);
    expect(hpAtPercent(60, 0)).toBe(1);
    expect(hpAtPercent(60, 200)).toBe(60);
  });
});

describe('IV list formatting', () => {
  it('collapses consecutive values into ranges', () => {
    expect(formatIvList([7])).toBe('7');
    expect(formatIvList([0, 1, 2, 3])).toBe('0–3');
    expect(formatIvList([2, 6, 10, 11, 12])).toBe('2, 6, 10–12');
    expect(formatIvList([])).toBe('—');
    expect(formatIvList(undefined)).toBe('—');
  });

  it('describes how far the answer has been narrowed', () => {
    expect(narrowingLabel(0, true, 'DV')).toContain('No DV set');
    expect(narrowingLabel(0, false, 'DV')).toContain('Enter the stats');
    expect(narrowingLabel(1, false, 'DV')).toContain('Exactly one');
    expect(narrowingLabel(24, false, 'DV')).toContain('24');
  });

  it('labels the Shiny verdict', () => {
    expect(shinyLabel('yes')).toBe('Yes');
    expect(shinyLabel('no')).toBe('No');
    expect(shinyLabel('possible')).toContain('Possible');
  });
});
