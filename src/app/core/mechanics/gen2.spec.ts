import { describe, expect, it } from 'vitest';
import type { TargetSpecies } from './types';
import {
  GEN2_MECHANICS,
  gen2Capture,
  gen2EffortFromDefeat,
  gen2Gender,
  gen2HpStep,
  gen2SolveDvs,
  heavyBallModifier,
  levelBallMultiplier,
  unownLetter,
} from './gen2';
import { dvStat, isShinyDvs } from './dv';
import { mechanicsForGame } from './index';
import type { CaptureInput } from './types';

const capture = (over: Partial<CaptureInput>) =>
  gen2Capture({
    catchRate: 45,
    ballId: 'poke',
    statusId: 'none',
    currentHp: 100,
    maxHp: 100,
    ...over,
  });

/** a → P = (a + 1) / 256. */
const odds = (a: number) => (a + 1) / 256;

const SANDSHREW: TargetSpecies = { dex: 27, weightKg: 12, genderRatio: 0.5 };
const SANDSHREW_BASE = { hp: 50, atk: 75, def: 85, spa: 20, spd: 30, spe: 40 };
const UNOWN: TargetSpecies = { dex: 201, weightKg: 5, genderRatio: 'genderless' };
const UNOWN_BASE = { hp: 48, atk: 72, def: 48, spa: 72, spd: 48, spe: 48 };

describe('gen2 capture: the HP and status steps', () => {
  // 3 × 100 = 300 doesn't fit in a byte, so both products are quartered: 75 and 50.
  it('quarters both HP products when 3 × max HP exceeds 255', () => {
    expect(gen2HpStep(45, 100, 100)).toBe(15); // ⌊45 × (75 − 50) / 75⌋
    expect(gen2HpStep(45, 20, 20)).toBe(15); // ⌊45 × (60 − 40) / 60⌋, no quartering
    // 2 × 1 = 2 quarters to 0, which becomes 1: ⌊45 × 74 / 75⌋ = 44.
    expect(gen2HpStep(45, 100, 1)).toBe(44);
  });

  it('never lets the HP step fall below 1', () => {
    expect(gen2HpStep(1, 100, 100)).toBe(1);
    expect(gen2HpStep(0, 100, 1)).toBe(1);
  });

  it('turns the final value into (a + 1) / 256', () => {
    expect(capture({}).probability).toBe(odds(15));
    expect(capture({ ballId: 'great' }).probability).toBe(odds(22)); // 45 + 22 = 67 → ⌊67 / 3⌋
    expect(capture({ ballId: 'ultra' }).probability).toBe(odds(30));
    expect(capture({ ballId: 'park' }).probability).toBe(odds(22));
  });

  it('adds 10 for sleep or freezing and nothing for the other statuses (a game bug)', () => {
    expect(capture({ statusId: 'sleep' }).probability).toBe(odds(25));
    const paralyzed = capture({ statusId: 'other' });
    expect(paralyzed.probability).toBe(capture({}).probability);
    expect(paralyzed.notes?.join(' ')).toContain('game bug');
  });

  it('caps the final value at 255, which always catches', () => {
    const result = capture({ catchRate: 255, ballId: 'ultra', statusId: 'sleep', currentHp: 1 });
    expect(result.probability).toBe(1);
    expect(result.guaranteed).toBe(true);
    expect(result.throwsFor).toEqual({ p50: 1, p90: 1, p99: 1 });
  });

  it('never fails with a Master Ball', () => {
    expect(capture({ catchRate: 3, ballId: 'master' })).toMatchObject({
      probability: 1,
      guaranteed: true,
    });
  });

  it('has no fixed shake count to report', () => {
    expect(GEN2_MECHANICS.capture.reportsShakes).toBe(false);
    expect(capture({}).shakesOnFailure).toBeUndefined();
  });

  it('never returns a probability outside 0..1 for any combination', () => {
    for (const ball of GEN2_MECHANICS.capture.balls) {
      for (const status of GEN2_MECHANICS.capture.statuses) {
        for (const catchRate of [0, 3, 45, 190, 255]) {
          for (const hp of [1, 50, 100]) {
            const { probability } = capture({
              catchRate,
              ballId: ball.id,
              statusId: status.id,
              currentHp: hp,
              target: SANDSHREW,
              level: 10,
              inputs: { 'your-level': 50, fishing: true, love: 'same-gender' },
            });
            expect(probability).toBeGreaterThan(0);
            expect(probability).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('gen2 capture: the Apricorn balls (pret item_effects.asm)', () => {
  it('Level Ball: doubles below the player, below half and below a quarter', () => {
    expect(levelBallMultiplier(30, 30)).toBe(1);
    expect(levelBallMultiplier(29, 30)).toBe(2);
    // ⌊41 / 2⌋ = 20, and 20 is not below 20: still 2×, where "more than double" would say 4×.
    expect(levelBallMultiplier(20, 41)).toBe(2);
    expect(levelBallMultiplier(19, 41)).toBe(4);
    expect(levelBallMultiplier(10, 41)).toBe(4);
    expect(levelBallMultiplier(9, 41)).toBe(8);
  });

  it('Level Ball: skips the HP and status steps', () => {
    const full = capture({ ballId: 'level', level: 10, inputs: { 'your-level': 41 } });
    // 45 × 4 = 180, used as is.
    expect(full.probability).toBe(odds(180));
    expect(full.effectiveCatchRate).toBe(180);
    const weakAndAsleep = capture({
      ballId: 'level',
      level: 10,
      inputs: { 'your-level': 41 },
      currentHp: 1,
      statusId: 'sleep',
    });
    expect(weakAndAsleep.probability).toBe(full.probability);
    // Without the player's level it is 1×, still without the HP step.
    expect(capture({ ballId: 'level', level: 10 }).probability).toBe(odds(45));
  });

  it('Lure Ball: 3× only on a hooked Pokémon', () => {
    expect(capture({ ballId: 'lure' }).effectiveCatchRate).toBe(45);
    expect(capture({ ballId: 'lure', inputs: { fishing: true } }).effectiveCatchRate).toBe(135);
    expect(
      capture({ catchRate: 90, ballId: 'lure', inputs: { fishing: true } }).effectiveCatchRate,
    ).toBe(255);
  });

  it('Moon Ball and Friend Ball: 1×', () => {
    const moon = capture({ ballId: 'moon', target: { dex: 35, weightKg: 7.5, genderRatio: 0.75 } });
    expect(moon.effectiveCatchRate).toBe(45);
    expect(moon.notes?.join(' ')).toContain('Moon Ball never gets');
    expect(capture({ ballId: 'friend' }).effectiveCatchRate).toBe(45);
  });

  it('Fast Ball: 4× only for Magnemite, Grimer and Tangela', () => {
    const magnemite = { dex: 81, weightKg: 6, genderRatio: 'genderless' as const };
    const ponyta = { dex: 77, weightKg: 30, genderRatio: 0.5 };
    expect(capture({ catchRate: 45, ballId: 'fast', target: magnemite }).effectiveCatchRate).toBe(
      180,
    );
    expect(capture({ catchRate: 190, ballId: 'fast', target: magnemite }).effectiveCatchRate).toBe(
      255,
    );
    const missed = capture({ catchRate: 190, ballId: 'fast', target: ponyta });
    expect(missed.effectiveCatchRate).toBe(190);
    expect(missed.notes?.join(' ')).toContain('Magnemite, Grimer and Tangela');
  });

  it('Heavy Ball: adds by weight band', () => {
    const at = (weightKg: number) => heavyBallModifier({ dex: 1, weightKg, genderRatio: 0.5 });
    expect(at(6)).toBe(-20); // Pikachu
    expect(at(102.3)).toBe(-20);
    expect(at(102.4)).toBe(0);
    expect(at(210)).toBe(20); // Onix
    expect(at(400)).toBe(30); // Steelix
    expect(at(460)).toBe(40); // Snorlax
    expect(heavyBallModifier(undefined)).toBeUndefined();
  });

  it('Heavy Ball: floors a borrow at 1 and saturates at 255', () => {
    const light = { dex: 25, weightKg: 6, genderRatio: 0.5 };
    expect(capture({ catchRate: 3, ballId: 'heavy', target: light }).effectiveCatchRate).toBe(1);
    expect(capture({ catchRate: 20, ballId: 'heavy', target: light }).effectiveCatchRate).toBe(0);
    // A rate of 0 still leaves the HP step at 1.
    expect(capture({ catchRate: 20, ballId: 'heavy', target: light }).probability).toBe(odds(1));
    const snorlax = { dex: 143, weightKg: 460, genderRatio: 0.125 };
    expect(capture({ catchRate: 250, ballId: 'heavy', target: snorlax }).effectiveCatchRate).toBe(
      255,
    );
  });

  it('Heavy Ball: reads the wrong weight for Kadabra, Tauros and Sunflora in Crystal only', () => {
    const kadabra = { dex: 64, weightKg: 56.5, genderRatio: 0.25 };
    expect(heavyBallModifier(kadabra, 'gold')).toBe(-20);
    expect(heavyBallModifier(kadabra, 'silver')).toBe(-20);
    expect(heavyBallModifier(kadabra, 'crystal')).toBe(40);
    expect(heavyBallModifier({ dex: 128, weightKg: 88.4, genderRatio: 0 }, 'crystal')).toBe(40);
    expect(heavyBallModifier({ dex: 192, weightKg: 8.5, genderRatio: 0.5 }, 'crystal')).toBe(40);
  });

  it('Love Ball: 8× for the same species and the same gender (a game bug)', () => {
    expect(
      capture({ ballId: 'love', target: SANDSHREW, inputs: { love: 'same-gender' } })
        .effectiveCatchRate,
    ).toBe(255);
    expect(
      capture({ catchRate: 3, ballId: 'love', target: SANDSHREW, inputs: { love: 'same-gender' } })
        .effectiveCatchRate,
    ).toBe(24);
    const opposite = capture({
      ballId: 'love',
      target: SANDSHREW,
      inputs: { love: 'opposite-gender' },
    });
    expect(opposite.effectiveCatchRate).toBe(45);
    expect(opposite.notes?.join(' ')).toContain('same gender, not the opposite');
    expect(
      capture({ ballId: 'love', target: UNOWN, inputs: { love: 'same-gender' } })
        .effectiveCatchRate,
    ).toBe(45);
  });
});

describe('gen2 DVs (Bulbapedia, Individual values → Generation I and II)', () => {
  it('shares the Gen I stat formula, with the Special DV driving both Special stats', () => {
    // Sandshrew A, level 6: DVs HP 8, Attack 7, Defense 10, Speed 10, Special 10.
    const stat = (s: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', iv: number) =>
      dvStat({ stat: s, base: SANDSHREW_BASE[s], level: 6, iv });
    expect([
      stat('hp', 8),
      stat('atk', 7),
      stat('def', 10),
      stat('spe', 10),
      stat('spa', 10),
      stat('spd', 10),
    ]).toEqual([22, 14, 16, 11, 8, 9]);
  });

  it('decides gender from the Attack DV and the ratio', () => {
    const dvs = (atk: number) => ({ atk, def: 0, spe: 15, spc: 0 });
    expect(gen2Gender(dvs(7), 0.5)).toBe('female');
    expect(gen2Gender(dvs(8), 0.5)).toBe('male');
    expect(gen2Gender(dvs(1), 0.125)).toBe('female');
    expect(gen2Gender(dvs(2), 0.125)).toBe('male');
    expect(gen2Gender(dvs(3), 0.25)).toBe('female');
    expect(gen2Gender(dvs(11), 0.75)).toBe('female');
    expect(gen2Gender(dvs(12), 0.75)).toBe('male');
  });

  it("reads Unown's letter from the middle bits of the four DVs", () => {
    expect(unownLetter({ atk: 10, def: 9, spe: 1, spc: 14 })).toBe('G'); // Unown 1: 67 → 6
    expect(unownLetter({ atk: 5, def: 15, spe: 10, spc: 5 })).toBe('S'); // Unown 2: 182 → 18
    expect(unownLetter({ atk: 15, def: 15, spe: 15, spc: 15 })).toBe('Z'); // 255 → 25
  });

  it('marks the Red Gyarados DVs as Shiny', () => {
    expect(isShinyDvs({ atk: 14, def: 10, spe: 10, spc: 10 })).toBe(true);
    expect(GEN2_MECHANICS.shiny).toMatchObject({ inGame: true, odds: 8192 });
  });

  it('narrows the worked Sandshrew A example to its DVs', () => {
    const solution = gen2SolveDvs(
      SANDSHREW_BASE,
      [{ level: 6, stats: { hp: 22, atk: 14, def: 16, spe: 11, spa: 8, spd: 9 } }],
      { species: SANDSHREW, traits: { gender: 'female', shiny: 'yes' } },
    );
    expect(solution.contradiction).toBe(false);
    expect(solution.possible.atk).toContain(7);
    expect(solution.possible.def).toEqual([10]);
    expect(solution.possible.spe).toEqual([10]);
    expect(solution.possible.spa).toEqual(solution.possible.spd);
    expect(solution.possible.spa).toContain(10);
    expect(solution.shiny).toBe('yes');
    expect(solution.traits).toEqual({ gender: ['female'], shiny: ['yes'] });
  });

  it('lists the traits still possible and spots impossible ones', () => {
    const open = gen2SolveDvs(SANDSHREW_BASE, [], { species: SANDSHREW });
    expect(open.combinations).toBe(65536);
    expect(open.traits).toEqual({ gender: ['male', 'female'], shiny: ['no', 'yes'] });
    expect(open.contradiction).toBe(false);

    // A female from a 7 : 1 species has an Attack DV of 0 or 1, so it can never be Shiny.
    const starter = { dex: 152, weightKg: 6.4, genderRatio: 0.125 };
    const impossible = gen2SolveDvs({}, [], {
      species: starter,
      traits: { gender: 'female', shiny: 'yes' },
    });
    expect(impossible.combinations).toBe(0);
    expect(impossible.contradiction).toBe(true);
  });

  it("uses Unown's letter, and skips gender for a genderless species", () => {
    const solution = gen2SolveDvs(UNOWN_BASE, [{ level: 5, stats: { hp: 20, atk: 13 } }], {
      species: UNOWN,
      traits: { 'unown-letter': 'G', gender: 'female' },
    });
    expect(Object.keys(solution.traits ?? {})).toEqual(['shiny', 'unown-letter']);
    expect(solution.traits?.['unown-letter']).toEqual(['G']);
    expect(solution.possible.atk).toContain(10);
  });

  it('gives Stat Exp from the base stats, with one Special value from Sp. Atk', () => {
    expect(gen2EffortFromDefeat(SANDSHREW_BASE)).toEqual({
      hp: 50,
      atk: 75,
      def: 85,
      spe: 40,
      spc: 20,
    });
  });
});

describe('gen2 registry', () => {
  it('resolves the Generation II module for Gold, Silver and Crystal', () => {
    expect(mechanicsForGame('gold')).toBe(GEN2_MECHANICS);
    expect(mechanicsForGame('silver')).toBe(GEN2_MECHANICS);
    expect(mechanicsForGame('crystal')).toBe(GEN2_MECHANICS);
  });

  it('declares every ball an input is tied to', () => {
    const balls = new Set(GEN2_MECHANICS.capture.balls.map((b) => b.id));
    for (const def of GEN2_MECHANICS.capture.inputs ?? []) {
      for (const ball of def.balls ?? []) expect(balls).toContain(ball);
    }
    expect(GEN2_MECHANICS.stats).toEqual(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
  });
});
