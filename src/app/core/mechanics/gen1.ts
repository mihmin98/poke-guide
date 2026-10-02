// FRAMEWORK-FREE: Generation I rules (plan §4.5, §13.11). No Angular imports.
//
// Every formula follows Bulbapedia's step-by-step algorithm with integer maths:
//   Capture method (Generation I)  https://bulbapedia.bulbagarden.net/wiki/Catch_rate  (rev 4612204)
//   Stat → Formula → Generations I and II  https://bulbapedia.bulbagarden.net/wiki/Stat  (rev 4605719)
//   Individual values → Generation I and II  .../wiki/Individual_values  (rev 4625391)
// The Safari Game's rounding is confirmed against pret/pokered `engine/items/item_effects.asm`:
// bait halves with `srl` (floor, and it may reach 0), a rock doubles and saturates at 255.
import type { StatId } from '../domain/models';
import { dvStat, hpDv, isShinyDvs, solveDvs, type DvLayout } from './dv';
import { oddsOf } from './odds';
import type {
  CaptureInput,
  CaptureResult,
  GenerationMechanics,
  IvSolution,
  StatObservation,
} from './types';

export const GEN1_STATS: StatId[] = ['hp', 'atk', 'def', 'spc', 'spe'];

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spc: 'Special',
  spe: 'Speed',
};

/** `N` is drawn from 0..`randMax`; `f` divides by `hpFactor`; the shake count divides by `shakeBall`. */
interface Gen1Ball {
  id: string;
  name: string;
  common?: boolean;
  randMax: number;
  hpFactor: number;
  shakeBall: number;
  /** The Master Ball never fails. */
  always?: boolean;
  limited?: { count: number; label: string };
}

const BALLS: Gen1Ball[] = [
  { id: 'poke', name: 'Poké Ball', common: true, randMax: 255, hpFactor: 12, shakeBall: 255 },
  { id: 'great', name: 'Great Ball', common: true, randMax: 200, hpFactor: 8, shakeBall: 200 },
  { id: 'ultra', name: 'Ultra Ball', common: true, randMax: 150, hpFactor: 12, shakeBall: 150 },
  {
    id: 'safari',
    name: 'Safari Ball',
    randMax: 150,
    hpFactor: 12,
    shakeBall: 150,
    limited: { count: 30, label: 'Safari Balls left' },
  },
  { id: 'master', name: 'Master Ball', randMax: 255, hpFactor: 12, shakeBall: 255, always: true },
];

/** `threshold` is the free catch below it; `shakeBonus` is `s` in the shake formula. */
interface Gen1Status {
  id: string;
  label: string;
  threshold: number;
  shakeBonus: number;
}

const STATUSES: Gen1Status[] = [
  { id: 'none', label: 'No status', threshold: 0, shakeBonus: 0 },
  { id: 'sleep', label: 'Asleep or frozen', threshold: 25, shakeBonus: 10 },
  { id: 'other', label: 'Paralyzed, burned or poisoned', threshold: 12, shakeBonus: 5 },
];

const BALLS_BY_ID = new Map(BALLS.map((b) => [b.id, b]));
const STATUSES_BY_ID = new Map(STATUSES.map((s) => [s.id, s]));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * `f` from step 5, already clamped to 1..255. `Ball` is 8 for a Great Ball and 12 otherwise, so lowering
 * HP below ½ (Great) or ⅓ (other) buys nothing.
 */
export function captureF(maxHp: number, currentHp: number, hpFactor: number): number {
  const hp = Math.max(1, Math.floor(currentHp));
  const max = Math.max(hp, Math.floor(maxHp));
  return clamp(Math.floor((max * 255 * 4) / (hp * hpFactor)), 1, 255);
}

/** The Safari Game modifies the catch rate before anything else; only Safari Balls are thrown there. */
function safariCatchRate(catchRate: number, ballId: string, option: unknown): number {
  if (ballId !== 'safari') return catchRate;
  if (option === 'bait') return Math.floor(catchRate / 2);
  if (option === 'rock') return Math.min(255, catchRate * 2);
  return catchRate;
}

/**
 * Exact P(catch) per throw, by counting the outcomes of the two random draws rather than using
 * Bulbapedia's "approximate probability" (which overshoots for high catch rates).
 */
export function gen1Capture(input: CaptureInput): CaptureResult {
  const ball = BALLS_BY_ID.get(input.ballId) ?? BALLS[0]!;
  const status = STATUSES_BY_ID.get(input.statusId) ?? STATUSES[0]!;
  const effectiveCatchRate = clamp(
    safariCatchRate(Math.floor(input.catchRate), ball.id, input.inputs?.['safari']),
    0,
    255,
  );

  if (ball.always) return { ...oddsOf(1), effectiveCatchRate, shakesOnFailure: 3 };

  const f = captureF(input.maxHp, input.currentHp, ball.hpFactor);
  const outcomes = ball.randMax + 1;
  // Step 3: caught outright when N < the status threshold.
  const freeCatches = Math.min(status.threshold, outcomes);
  // Step 4: N - threshold must not exceed the catch rate; the remaining N break free at once.
  const contested = Math.max(
    0,
    Math.min(ball.randMax, status.threshold + effectiveCatchRate) - status.threshold + 1,
  );
  // Step 6–7: M is 0..255, and the Pokémon is caught when f >= M.
  const probability = (freeCatches + (contested * (f + 1)) / 256) / outcomes;

  const d = Math.floor((effectiveCatchRate * 100) / ball.shakeBall);
  let shakes = 3;
  if (d < 256) {
    const x = Math.floor((d * f) / 255) + status.shakeBonus;
    shakes = x < 10 ? 0 : x < 30 ? 1 : x < 70 ? 2 : 3;
  }

  return { ...oddsOf(probability), effectiveCatchRate, shakesOnFailure: shakes };
}

/** The Gen I–II stat formula (`dv.ts`). */
export const gen1Stat = dvStat;

/**
 * Defeating a Pokémon in Gen I gives Stat Exp equal to its base stats, so nothing extra is stored per
 * species (plan §8). Stat Exp caps at 65535 per stat, which is where the `⌈√STATEXP⌉ / 4` term tops out.
 */
export function gen1EffortFromDefeat(
  baseStats: Partial<Record<StatId, number>>,
): Partial<Record<StatId, number>> {
  const yielded: Partial<Record<StatId, number>> = {};
  for (const stat of GEN1_STATS) {
    const value = baseStats[stat];
    if (value !== undefined) yielded[stat] = value;
  }
  return yielded;
}

/** The HP DV is built from the other four (`dv.ts`). */
export const gen1HpDv = hpDv;

/** A Gen I Pokémon becomes Shiny in Gen II when its DVs match this pattern (Individual values §Shininess). */
export const isShinyInGen2 = isShinyDvs;

const GEN1_DVS: DvLayout = {
  drives: { atk: ['atk'], def: ['def'], spe: ['spe'], spc: ['spc'] },
  isShiny: isShinyDvs,
};

/** Every DV set consistent with the stats the player entered (`solveDvs`). */
export function gen1SolveDvs(
  base: Partial<Record<StatId, number>>,
  observations: readonly StatObservation[],
): IvSolution {
  return solveDvs(GEN1_DVS, base, observations);
}

const BULBAPEDIA = 'https://bulbapedia.bulbagarden.net/wiki/';

export const GEN1_MECHANICS: GenerationMechanics = {
  id: 'gen1',
  stats: GEN1_STATS,
  statLabels: STAT_LABELS,
  ivSystem: { kind: 'dv', max: 15, hpDerived: true, label: 'DV' },
  shiny: {
    inGame: false,
    transfer: {
      label: 'Shiny if moved to Generation II',
      description:
        'Generation I has no Shiny Pokémon, but Generation II reads the same DVs: a Pokémon is Shiny ' +
        'there when its Defense, Speed and Special DVs are all 10 and its Attack DV is 2, 3, 6, 7, 10, ' +
        '11, 14 or 15 — about 1 in 8192 at random.',
      isShiny: isShinyInGen2,
      impossibleMethods: ['walk', 'surf', 'cave'],
      impossibleNote:
        'Pokémon met in tall grass, in caves or while surfing draw from a correlated pool of DVs that ' +
        'never contains a Shiny set. Fishing, gift, stationary and traded Pokémon can be any set.',
    },
  },
  capture: {
    balls: BALLS.map(({ id, name, common, limited }) => ({
      id,
      name,
      ...(common ? { common } : {}),
      ...(limited ? { limited } : {}),
    })),
    statuses: STATUSES.map(({ id, label }) => ({ id, label })),
    inputs: [
      {
        kind: 'select',
        id: 'safari',
        label: 'Safari Game',
        hint: 'Bait and rocks change the catch rate until the Pokémon calms down.',
        balls: ['safari'],
        options: [
          { id: 'none', label: 'Nothing thrown' },
          { id: 'bait', label: 'Bait thrown (catch rate halved)' },
          { id: 'rock', label: 'Rock thrown (catch rate doubled)' },
        ],
        defaultValue: 'none',
      },
    ],
    reportsShakes: true,
    shakesNote:
      'In this generation the shakes are fixed for a given ball, status and HP, so more shakes than ' +
      'you have seen before with the same setup means the Pokémon is caught.',
    compute: gen1Capture,
  },
  statValue: gen1Stat,
  effortFromDefeat: gen1EffortFromDefeat,
  effortLabel: 'Stat Exp',
  effortDescription: 'Defeating one gives Stat Exp equal to these values.',
  solveIvs: gen1SolveDvs,
  sources: [
    { label: 'Catch rate', url: `${BULBAPEDIA}Catch_rate` },
    { label: 'Stat', url: `${BULBAPEDIA}Stat` },
    { label: 'Individual values', url: `${BULBAPEDIA}Individual_values` },
    { label: 'Shiny Pokémon', url: `${BULBAPEDIA}Shiny_Pok%C3%A9mon` },
  ],
};
