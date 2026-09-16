import { describe, expect, it } from 'vitest';
import {
  GEN1_MECHANICS,
  captureF,
  gen1Capture,
  gen1HpDv,
  gen1SolveDvs,
  gen1Stat,
  isShinyInGen2,
} from './gen1';
import { findMechanics, mechanicsForGame } from './index';
import type { CaptureInput } from './types';

const capture = (over: Partial<CaptureInput>): ReturnType<typeof gen1Capture> =>
  gen1Capture({
    catchRate: 255,
    ballId: 'poke',
    statusId: 'none',
    currentHp: 100,
    maxHp: 100,
    ...over,
  });

describe('gen1 stat formula', () => {
  // Bulbapedia, Stat → Formula → Generations I and II, the Level 81 Pikachu example.
  it('matches the worked Level 81 Pikachu example', () => {
    expect(gen1Stat({ stat: 'hp', base: 35, level: 81, iv: 7, effort: 22850 })).toBe(189);
    expect(gen1Stat({ stat: 'spc', base: 50, level: 81, iv: 9, effort: 19625 })).toBe(128);
    expect(gen1Stat({ stat: 'spe', base: 90, level: 81, iv: 5, effort: 24795 })).toBe(190);
  });

  it('treats a missing stat experience as zero', () => {
    expect(gen1Stat({ stat: 'atk', base: 55, level: 81, iv: 8 })).toBe(
      gen1Stat({ stat: 'atk', base: 55, level: 81, iv: 8, effort: 0 }),
    );
  });

  it('gives a level 100 Pokémon with perfect DVs and no stat experience the known values', () => {
    // (100 + 15) * 2 = 230 → ⌊230 × 100 / 100⌋ + 100 + 10 = 340 HP for a base 100 stat.
    expect(gen1Stat({ stat: 'hp', base: 100, level: 100, iv: 15 })).toBe(340);
    expect(gen1Stat({ stat: 'atk', base: 100, level: 100, iv: 15 })).toBe(235);
  });
});

describe('gen1 stat experience', () => {
  it('hands out Stat Exp equal to the defeated species base stats', () => {
    expect(GEN1_MECHANICS.effortFromDefeat({ hp: 35, atk: 55, def: 30, spc: 50, spe: 90 })).toEqual({
      hp: 35,
      atk: 55,
      def: 30,
      spc: 50,
      spe: 90,
    });
    // Stats another generation has are not part of Gen I's five.
    expect(GEN1_MECHANICS.effortFromDefeat({ hp: 35, spa: 50, spd: 40 })).toEqual({ hp: 35 });
    expect(GEN1_MECHANICS.effortLabel).toBe('Stat Exp');
  });
});

describe('gen1 DVs', () => {
  it('derives the HP DV from the low bits of the other four', () => {
    // The Stat page's Pikachu: Attack 8, Defense 13, Speed 5, Special 9 → HP 7.
    expect(gen1HpDv(8, 13, 5, 9)).toBe(7);
    expect(gen1HpDv(15, 15, 15, 15)).toBe(15);
    expect(gen1HpDv(0, 0, 0, 0)).toBe(0);
    expect(gen1HpDv(1, 0, 0, 0)).toBe(8);
  });

  it('applies the Generation II Shiny condition', () => {
    expect(isShinyInGen2({ atk: 14, def: 10, spe: 10, spc: 10 })).toBe(true);
    expect(isShinyInGen2({ atk: 2, def: 10, spe: 10, spc: 10 })).toBe(true);
    expect(isShinyInGen2({ atk: 13, def: 10, spe: 10, spc: 10 })).toBe(false);
    expect(isShinyInGen2({ atk: 14, def: 10, spe: 10, spc: 9 })).toBe(false);
  });
});

describe('gen1 DV solver', () => {
  const pikachu = { hp: 35, atk: 55, def: 30, spc: 50, spe: 90 };
  const statsAt = (level: number, dvs: { atk: number; def: number; spc: number; spe: number }) => ({
    hp: gen1Stat({ stat: 'hp', base: pikachu.hp, level, iv: gen1HpDv(dvs.atk, dvs.def, dvs.spe, dvs.spc) }),
    atk: gen1Stat({ stat: 'atk', base: pikachu.atk, level, iv: dvs.atk }),
    def: gen1Stat({ stat: 'def', base: pikachu.def, level, iv: dvs.def }),
    spc: gen1Stat({ stat: 'spc', base: pikachu.spc, level, iv: dvs.spc }),
    spe: gen1Stat({ stat: 'spe', base: pikachu.spe, level, iv: dvs.spe }),
  });

  it('finds the exact DVs at level 100', () => {
    const dvs = { atk: 8, def: 13, spc: 9, spe: 5 };
    const solution = gen1SolveDvs(pikachu, [{ level: 100, stats: statsAt(100, dvs) }]);
    expect(solution.contradiction).toBe(false);
    expect(solution.combinations).toBe(1);
    expect(solution.possible.atk).toEqual([8]);
    expect(solution.possible.def).toEqual([13]);
    expect(solution.possible.spc).toEqual([9]);
    expect(solution.possible.spe).toEqual([5]);
    expect(solution.possible.hp).toEqual([gen1HpDv(8, 13, 5, 9)]);
    expect(solution.shiny).toBe('no');
  });

  it('narrows a low-level Pokémon further with a second reading', () => {
    const dvs = { atk: 8, def: 13, spc: 9, spe: 5 };
    const low = gen1SolveDvs(pikachu, [{ level: 5, stats: statsAt(5, dvs) }]);
    const both = gen1SolveDvs(pikachu, [
      { level: 5, stats: statsAt(5, dvs) },
      { level: 40, stats: statsAt(40, dvs) },
    ]);
    expect(low.combinations).toBeGreaterThan(both.combinations);
    expect(both.combinations).toBeLessThanOrEqual(low.combinations);
    expect(both.possible.atk).toContain(8);
    expect(low.possible.atk).toContain(8);
  });

  it('reports a Shiny DV set', () => {
    const solution = gen1SolveDvs(pikachu, [
      { level: 100, stats: statsAt(100, { atk: 14, def: 10, spc: 10, spe: 10 }) },
    ]);
    expect(solution.combinations).toBe(1);
    expect(solution.shiny).toBe('yes');
  });

  it('reports "possible" while several sets survive', () => {
    const solution = gen1SolveDvs(pikachu, [
      { level: 5, stats: statsAt(5, { atk: 14, def: 10, spc: 10, spe: 10 }) },
    ]);
    expect(solution.combinations).toBeGreaterThan(1);
    expect(solution.shiny).toBe('possible');
  });

  it('flags stats no DV set can produce', () => {
    const solution = gen1SolveDvs(pikachu, [{ level: 50, stats: { atk: 999 } }]);
    expect(solution.contradiction).toBe(true);
    expect(solution.combinations).toBe(0);
  });

  it('returns every DV when nothing was entered', () => {
    const solution = gen1SolveDvs(pikachu, [{ level: 50, stats: {} }]);
    expect(solution.contradiction).toBe(false);
    expect(solution.combinations).toBe(16 ** 4);
    expect(solution.possible.atk).toHaveLength(16);
    expect(solution.possible.hp).toHaveLength(16);
    expect(solution.shiny).toBe('possible');
  });

  it('accounts for stat experience when it is given', () => {
    const trained = gen1Stat({ stat: 'spe', base: pikachu.spe, level: 81, iv: 5, effort: 24795 });
    const solution = gen1SolveDvs(pikachu, [
      { level: 81, stats: { spe: trained }, effort: { spe: 24795 } },
    ]);
    expect(solution.possible.spe).toContain(5);
    const untrained = gen1SolveDvs(pikachu, [{ level: 81, stats: { spe: trained } }]);
    expect(untrained.possible.spe).not.toContain(5);
  });
});

describe('gen1 capture', () => {
  it('always catches with a Master Ball', () => {
    const result = capture({ ballId: 'master', catchRate: 3 });
    expect(result.probability).toBe(1);
    expect(result.guaranteed).toBe(true);
    expect(result.expectedThrows).toBe(1);
  });

  it('clamps f to 1..255', () => {
    expect(captureF(100, 100, 12)).toBe(85);
    expect(captureF(100, 50, 8)).toBe(255);
    expect(captureF(700, 1, 12)).toBe(255);
    expect(captureF(1, 1, 12)).toBe(85);
  });

  it('matches Bulbapedia’s approximate formula inside its stated exact range', () => {
    // The approximation is exact for catch rates up to 230 (Poké), 175 (Great) and 125 (Ultra),
    // which is precisely where the status threshold plus the catch rate still fits in the ball's range.
    const cases: [string, number, number][] = [
      ['poke', 255, 230],
      ['great', 200, 175],
      ['ultra', 150, 125],
    ];
    for (const [ballId, ballValue, maxRate] of cases) {
      for (const catchRate of [1, 45, 100, maxRate]) {
        for (const [statusId, statusValue] of [
          ['none', 0],
          ['sleep', 25],
          ['other', 12],
        ] as const) {
          const result = gen1Capture({
            catchRate,
            ballId,
            statusId,
            currentHp: 60,
            maxHp: 100,
          });
          const f = captureF(100, 60, ballId === 'great' ? 8 : 12);
          const approx =
            statusValue / (ballValue + 1) +
            ((catchRate + 1) / (ballValue + 1)) * ((f + 1) / 256);
          expect(result.probability).toBeCloseTo(approx, 12);
        }
      }
    }
  });

  it('stays below the approximation for catch rates outside that range', () => {
    const result = gen1Capture({
      catchRate: 255,
      ballId: 'ultra',
      statusId: 'sleep',
      currentHp: 100,
      maxHp: 100,
    });
    const approx = 25 / 151 + (256 / 151) * (86 / 256);
    expect(result.probability).toBeLessThan(approx);
    expect(result.probability).toBeLessThanOrEqual(1);
  });

  it('guarantees a Poké Ball capture at 1/3 HP and a Great Ball capture at 1/2 HP', () => {
    // Bulbapedia: "lowering the target's HP to 1/3 of its maximum will guarantee capture with a Poké
    // Ball, while lowering it to 1/2 will guarantee capture with a Great Ball" — for a 255 catch rate.
    expect(capture({ currentHp: 33 }).probability).toBe(1);
    expect(capture({ ballId: 'great', currentHp: 50 }).probability).toBe(1);
    expect(capture({ ballId: 'great', currentHp: 51 }).probability).toBeLessThan(1);
  });

  it('needs about six Ultra Balls for a sleeping full-HP Mewtwo', () => {
    const result = gen1Capture({
      catchRate: 3,
      ballId: 'ultra',
      statusId: 'sleep',
      currentHp: 100,
      maxHp: 100,
    });
    expect(result.expectedThrows).toBeGreaterThan(5);
    expect(result.expectedThrows).toBeLessThan(6.5);
    expect(result.throwsFor?.p50).toBe(4);
  });

  it('lets a Great Ball beat an Ultra Ball on a high catch rate', () => {
    const great = capture({ ballId: 'great', catchRate: 255 });
    const ultra = capture({ ballId: 'ultra', catchRate: 255 });
    expect(great.probability).toBeGreaterThan(ultra.probability);
  });

  it('lets an Ultra Ball beat a Great Ball in the 56..199 catch-rate band', () => {
    const at = (ballId: string) => capture({ ballId, catchRate: 100, currentHp: 20 }).probability;
    expect(at('ultra')).toBeGreaterThan(at('great'));
  });

  it('applies the Safari Game bait and rock modifiers', () => {
    const plain = capture({ ballId: 'safari', catchRate: 45 });
    const bait = capture({ ballId: 'safari', catchRate: 45, context: { safari: 'bait' } });
    const rock = capture({ ballId: 'safari', catchRate: 45, context: { safari: 'rock' } });
    expect(bait.effectiveCatchRate).toBe(22);
    expect(rock.effectiveCatchRate).toBe(90);
    expect(bait.probability).toBeLessThan(plain.probability);
    expect(rock.probability).toBeGreaterThan(plain.probability);
    // A rock doubles with an 8-bit saturate (pret `item_effects.asm`), so it stops at 255.
    expect(capture({ ballId: 'safari', catchRate: 200, context: { safari: 'rock' } })
      .effectiveCatchRate).toBe(255);
  });

  it('reports the shake count for a break-free', () => {
    // d = ⌊3 × 100 / 150⌋ = 2, f = 85 → x = ⌊2 × 85 / 255⌋ + 0 = 0: the ball misses.
    expect(gen1Capture({ catchRate: 3, ballId: 'ultra', statusId: 'none', currentHp: 100, maxHp: 100 })
      .shakesOnFailure).toBe(0);
    // The same throw on a sleeping Mewtwo adds s = 10 → one shake.
    expect(gen1Capture({ catchRate: 3, ballId: 'ultra', statusId: 'sleep', currentHp: 100, maxHp: 100 })
      .shakesOnFailure).toBe(1);
    // A catch rate of 255 with a Poké Ball gives d = 100, f = 85 → x = 33: two shakes.
    expect(capture({}).shakesOnFailure).toBe(2);
  });

  it('never returns a probability outside 0..1 for any combination', () => {
    for (const ball of GEN1_MECHANICS.capture.balls) {
      for (const status of GEN1_MECHANICS.capture.statuses) {
        for (const catchRate of [0, 1, 3, 45, 90, 190, 255]) {
          for (const hp of [1, 25, 50, 100]) {
            const result = gen1Capture({
              catchRate,
              ballId: ball.id,
              statusId: status.id,
              currentHp: hp,
              maxHp: 100,
            });
            expect(result.probability).toBeGreaterThanOrEqual(0);
            expect(result.probability).toBeLessThanOrEqual(1);
            expect(result.shakesOnFailure).toBeGreaterThanOrEqual(0);
            expect(result.shakesOnFailure).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });

  it('cannot catch a catch-rate 0 Pokémon without a status or a Master Ball', () => {
    const result = capture({ catchRate: 0, currentHp: 1 });
    expect(result.probability).toBeGreaterThan(0); // catch rate 0 still allows N = 0
    expect(gen1Capture({
      catchRate: 0,
      ballId: 'poke',
      statusId: 'none',
      currentHp: 100,
      maxHp: 100,
    }).probability).toBeGreaterThan(0);
  });
});

describe('mechanics registry', () => {
  it('resolves the Generation I module for every Red/Blue/Yellow game', () => {
    expect(mechanicsForGame('red')).toBe(GEN1_MECHANICS);
    expect(mechanicsForGame('blue')).toBe(GEN1_MECHANICS);
    expect(mechanicsForGame('yellow')).toBe(GEN1_MECHANICS);
  });

  it('returns undefined for a generation without a module yet', () => {
    expect(mechanicsForGame('crystal')).toBeUndefined();
    expect(findMechanics('gen9')).toBeUndefined();
  });

  it('lists the stats and sources the tool pages show', () => {
    expect(GEN1_MECHANICS.stats).toEqual(['hp', 'atk', 'def', 'spc', 'spe']);
    expect(GEN1_MECHANICS.ivSystem.label).toBe('DV');
    expect(GEN1_MECHANICS.shiny.inGame).toBe(false);
    expect(GEN1_MECHANICS.sources.map((s) => s.label)).toContain('Catch rate');
  });
});
