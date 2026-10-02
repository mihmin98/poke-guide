// FRAMEWORK-FREE: Generation II rules (plan §4.5, §13.11). No Angular imports.
//
// The algorithms follow Bulbapedia, with integer maths:
//   Capture method (Generation II)  https://bulbapedia.bulbagarden.net/wiki/Catch_rate  (rev 4612204)
//   Poké Ball effectiveness rates (Apricorn balls)  same page, and .../wiki/Pok%C3%A9_Ball (rev 4631237)
//   Stat → Formula → Generations I and II  .../wiki/Stat  (rev 4605719)
//   Individual values → Generation I and II (gender, Shininess, Unown's letter)  (rev 4625391)
//   Shiny Pokémon → Generation II (1/8192; 1/64 for an egg from a Shiny parent)  (rev 4624856)
// Bulbapedia leaves some steps out, so every step was checked against pret's disassemblies,
// pokecrystal 5beda23 and pokegold 62388c7 (`engine/items/item_effects.asm` `PokeBallEffect` and the
// ball multipliers, `engine/battle_anims/pokeball_wobble.asm`, `engine/pokemon/mon_stats.asm`
// `GetGender`, `engine/gfx/load_pics.asm` `GetUnownLetter`):
//   - The Level Ball skips the HP and status steps: its multiplied catch rate is the final value.
//   - The Level Ball doubles when the wild level is below the player's, again below ⌊player / 2⌋ and
//     again below ⌊player / 4⌋ (so 41 against 20 is still 2×).
//   - Every multiplier saturates at 255; the Heavy Ball's −20 floors at 1 on a borrow (0 if it lands
//     exactly on 0, which the HP step then lifts to 1).
//   - The Heavy Ball reads the Pokédex weight in pounds and converts it; bucketing `weightKg` gives the
//     same result for all 251 species. Only Crystal reads the wrong bank for Kadabra, Tauros and
//     Sunflora, which Bulbapedia records as +40.
//   - Shakes are random in Generation II (each passes with a chance from the wobble table), so the
//     break-free animation tells nothing about the odds: `reportsShakes` is off.
//   - Gender compares `16 × Attack DV + Speed DV` with the species' ratio byte (31, 63, 127, 191);
//     since every byte ends in 15, only the Attack DV matters.
import type { GameId, StatId } from '../domain/models';
import { dvStat, isShinyDvs, solveDvs, type DvLayout } from './dv';
import { oddsOf } from './odds';
import type {
  CaptureInput,
  CaptureResult,
  DvSet,
  DvTraitDef,
  GenerationMechanics,
  IvSolution,
  IvSolveOptions,
  StatObservation,
  TargetSpecies,
} from './types';

export const GEN2_STATS: StatId[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
  /** The stored DV behind both Special stats, as fixed DV sets name it. */
  spc: 'Special',
};

/** Above this the game's 8-bit HP maths breaks; no Pokémon met in the games has that much (Bulbapedia). */
const MAX_HP = 341;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const saturate = (value: number) => Math.min(255, value);

/** The species the Fast Ball boosts: the first three entries of the flee list (a game bug). */
const FAST_BALL_SPECIES = new Set([81, 88, 114]);

/** Games whose Heavy Ball reads the wrong Pokédex bank for these species, landing on +40. */
const HEAVY_BALL_WRONG_BANK: { games: readonly GameId[]; dex: ReadonlySet<number> } = {
  games: ['crystal'],
  dex: new Set([64, 128, 192]),
};

/** Weight limits in tenths of a kilogram and what each band adds; heavier still adds 40. */
const HEAVY_BALL_BANDS: readonly { below: number; add: number }[] = [
  { below: 1024, add: -20 },
  { below: 2048, add: 0 },
  { below: 3072, add: 20 },
  { below: 4096, add: 30 },
];

interface Gen2Ball {
  id: string;
  name: string;
  common?: boolean;
  limited?: { count: number; label: string };
  /** The Master Ball never fails. */
  always?: boolean;
  /** The Level Ball's rate is final: no HP or status step. */
  skipsHpAndStatus?: boolean;
  /** The ball's change to the catch rate (8-bit), with a note for anything worth explaining. */
  modify?(rate: number, input: CaptureInput, notes: string[]): number;
}

function inputValue(input: CaptureInput, id: string): unknown {
  return input.inputs?.[id];
}

/** pret `LevelBallMultiplier`. */
export function levelBallMultiplier(wildLevel: number, yourLevel: number): number {
  if (wildLevel >= yourLevel) return 1;
  let limit = yourLevel >> 1;
  if (wildLevel >= limit) return 2;
  limit >>= 1;
  if (wildLevel >= limit) return 4;
  return 8;
}

/** pret `HeavyBallMultiplier`: what the Heavy Ball adds to the catch rate, or `undefined` without a weight. */
export function heavyBallModifier(
  target: TargetSpecies | undefined,
  game?: GameId,
): number | undefined {
  if (!target) return undefined;
  if (
    game &&
    HEAVY_BALL_WRONG_BANK.games.includes(game) &&
    HEAVY_BALL_WRONG_BANK.dex.has(target.dex)
  ) {
    return 40;
  }
  const tenths = Math.round(target.weightKg * 10);
  return HEAVY_BALL_BANDS.find((band) => tenths < band.below)?.add ?? 40;
}

const BALLS: Gen2Ball[] = [
  { id: 'poke', name: 'Poké Ball', common: true },
  {
    id: 'great',
    name: 'Great Ball',
    common: true,
    modify: (rate) => saturate(rate + (rate >> 1)),
  },
  { id: 'ultra', name: 'Ultra Ball', common: true, modify: (rate) => saturate(rate * 2) },
  { id: 'master', name: 'Master Ball', always: true },
  {
    id: 'level',
    name: 'Level Ball',
    skipsHpAndStatus: true,
    modify: (rate, input, notes) => {
      const wild = input.level;
      const yours = inputValue(input, 'your-level');
      const multiplier =
        wild !== undefined && typeof yours === 'number' ? levelBallMultiplier(wild, yours) : 1;
      notes.push(
        `Level Ball: ${multiplier}×. It skips the HP and status steps, so weakening the Pokémon or ` +
          'putting it to sleep does not help.',
      );
      return saturate(rate * multiplier);
    },
  },
  {
    id: 'lure',
    name: 'Lure Ball',
    modify: (rate, input, notes) => {
      if (inputValue(input, 'fishing') !== true) return rate;
      notes.push('Lure Ball: 3× on a Pokémon hooked with a rod.');
      return saturate(rate * 3);
    },
  },
  {
    id: 'moon',
    name: 'Moon Ball',
    modify: (rate, _input, notes) => {
      notes.push('A game bug means the Moon Ball never gets its 4× bonus in these games.');
      return rate;
    },
  },
  { id: 'friend', name: 'Friend Ball' },
  {
    id: 'fast',
    name: 'Fast Ball',
    modify: (rate, input, notes) => {
      if (input.target && FAST_BALL_SPECIES.has(input.target.dex)) {
        notes.push('Fast Ball: 4×.');
        return saturate(rate * 4);
      }
      notes.push(
        'A game bug limits the Fast Ball’s 4× bonus to Magnemite, Grimer and Tangela, not every ' +
          'Pokémon that flees.',
      );
      return rate;
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Ball',
    modify: (rate, input, notes) => {
      const add = heavyBallModifier(input.target, input.game);
      if (add === undefined || !input.target) return rate;
      const sign = add > 0 ? '+' : add < 0 ? '−' : '±';
      notes.push(
        `Heavy Ball: ${input.target.weightKg} kg, ${sign}${Math.abs(add)} to the catch rate.`,
      );
      if (add < 0) return rate + add < 0 ? 1 : rate + add;
      return saturate(rate + add);
    },
  },
  {
    id: 'love',
    name: 'Love Ball',
    modify: (rate, input, notes) => {
      const yours = inputValue(input, 'love');
      if (input.target?.genderRatio === 'genderless') {
        notes.push('The Love Ball does nothing for a genderless Pokémon.');
        return rate;
      }
      if (yours === 'same-gender') {
        notes.push(
          'Love Ball: 8×, because a game bug rewards the same gender instead of the opposite one.',
        );
        return saturate(rate * 8);
      }
      if (yours === 'opposite-gender') {
        notes.push(
          'A game bug gives the Love Ball’s 8× bonus to the same gender, not the opposite one.',
        );
      }
      return rate;
    },
  },
  {
    id: 'park',
    name: 'Park Ball',
    limited: { count: 20, label: 'Park Balls left' },
    modify: (rate) => saturate(rate + (rate >> 1)),
  },
];

/** `bonus` is added after the HP step; `note` explains a status that should help but doesn't. */
interface Gen2Status {
  id: string;
  label: string;
  bonus: number;
  note?: string;
}

const STATUSES: Gen2Status[] = [
  { id: 'none', label: 'No status', bonus: 0 },
  { id: 'sleep', label: 'Asleep or frozen', bonus: 10 },
  {
    id: 'other',
    label: 'Paralyzed, burned or poisoned',
    bonus: 0,
    note: 'A game bug skips the bonus for paralysis, burns and poison: only sleep and freezing help.',
  },
];

const BALLS_BY_ID = new Map(BALLS.map((b) => [b.id, b]));
const STATUSES_BY_ID = new Map(STATUSES.map((s) => [s.id, s]));

/**
 * The HP step: `max(⌊(3 × HPmax − 2 × HPcurrent) × rate / (3 × HPmax)⌋, 1)`, where both products are
 * quartered (rounding down each time) when 3 × HPmax doesn't fit in a byte, and a quartered 2 × HPcurrent
 * of 0 becomes 1.
 */
export function gen2HpStep(rate: number, maxHp: number, currentHp: number): number {
  const max = clamp(Math.floor(maxHp), 1, MAX_HP);
  const hp = clamp(Math.floor(currentHp), 1, max);
  let max3 = max * 3;
  let hp2 = hp * 2;
  if (max3 > 255) {
    max3 >>= 2;
    hp2 >>= 2;
    if (hp2 === 0) hp2 = 1;
  }
  return Math.max(1, Math.floor((rate * (max3 - hp2)) / max3));
}

/**
 * Exact P(catch) per throw. The final value `a` is compared with one random byte, and the Pokémon is
 * caught when the byte is at most `a`: (a + 1) / 256.
 */
export function gen2Capture(input: CaptureInput): CaptureResult {
  const ball = BALLS_BY_ID.get(input.ballId) ?? BALLS[0]!;
  const status = STATUSES_BY_ID.get(input.statusId) ?? STATUSES[0]!;
  const catchRate = clamp(Math.floor(input.catchRate), 0, 255);
  if (ball.always) return { ...oddsOf(1), effectiveCatchRate: catchRate };

  const notes: string[] = [];
  const rate = ball.modify ? ball.modify(catchRate, input, notes) : catchRate;
  let final = rate;
  if (!ball.skipsHpAndStatus) {
    final = saturate(gen2HpStep(rate, input.maxHp, input.currentHp) + status.bonus);
    if (status.note) notes.push(status.note);
  }
  return {
    ...oddsOf((final + 1) / 256),
    effectiveCatchRate: rate,
    ...(notes.length ? { notes } : {}),
  };
}

/** The ratio byte `GetGender` compares with: 1/8 female → 31, 1/4 → 63, 1/2 → 127, 3/4 → 191. */
function genderByte(femaleShare: number): number {
  return Math.round(femaleShare * 256) - 1;
}

/** Gen II gender from the DVs, for species that can be either gender. */
export function gen2Gender(dvs: DvSet, femaleShare: number): 'male' | 'female' {
  return dvs.atk * 16 + dvs.spe <= genderByte(femaleShare) ? 'female' : 'male';
}

const UNOWN = 201;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The middle two bits of the Attack, Defense, Speed and Special DVs, in that order, divided by 10. */
export function unownLetter(dvs: DvSet): string {
  const middle = (dv: number) => (dv >> 1) & 3;
  const combined =
    (middle(dvs.atk) << 6) | (middle(dvs.def) << 4) | (middle(dvs.spe) << 2) | middle(dvs.spc);
  return LETTERS[Math.floor(combined / 10)]!;
}

const isMixedGender = (species: TargetSpecies): boolean =>
  typeof species.genderRatio === 'number' && species.genderRatio > 0 && species.genderRatio < 1;

export const GEN2_DV_TRAITS: DvTraitDef[] = [
  {
    id: 'gender',
    label: 'Gender',
    options: [
      { id: 'male', label: 'Male' },
      { id: 'female', label: 'Female' },
    ],
    appliesTo: isMixedGender,
    valueOf: (dvs, species) => gen2Gender(dvs, species.genderRatio as number),
  },
  {
    id: 'shiny',
    label: 'Shiny',
    options: [
      { id: 'no', label: 'No' },
      { id: 'yes', label: 'Yes' },
    ],
    appliesTo: () => true,
    valueOf: (dvs) => (isShinyDvs(dvs) ? 'yes' : 'no'),
  },
  {
    id: 'unown-letter',
    label: 'Unown letter',
    options: [...LETTERS].map((letter) => ({ id: letter, label: letter })),
    appliesTo: (species) => species.dex === UNOWN,
    valueOf: unownLetter,
  },
];

const GEN2_DVS: DvLayout = {
  drives: { atk: ['atk'], def: ['def'], spe: ['spe'], spc: ['spa', 'spd'] },
  isShiny: isShinyDvs,
  traits: GEN2_DV_TRAITS,
};

/** Every DV set consistent with the stats and summary-screen traits the player entered. */
export function gen2SolveDvs(
  base: Partial<Record<StatId, number>>,
  observations: readonly StatObservation[],
  options?: IvSolveOptions,
): IvSolution {
  return solveDvs(GEN2_DVS, base, observations, options);
}

/**
 * Stat Exp equal to the defeated species' base stats. There are five Stat Exp values: Special Attack
 * and Special Defense share one, which grows by the base Special Attack (pret `GiveExperiencePoints`
 * reads the first five base stats: HP, Attack, Defense, Speed, Special Attack).
 */
export function gen2EffortFromDefeat(
  baseStats: Partial<Record<StatId, number>>,
): Partial<Record<StatId, number>> {
  const yielded: Partial<Record<StatId, number>> = {};
  for (const stat of ['hp', 'atk', 'def', 'spe'] as const) {
    const value = baseStats[stat];
    if (value !== undefined) yielded[stat] = value;
  }
  if (baseStats.spa !== undefined) yielded.spc = baseStats.spa;
  return yielded;
}

const BULBAPEDIA = 'https://bulbapedia.bulbagarden.net/wiki/';

export const GEN2_MECHANICS: GenerationMechanics = {
  id: 'gen2',
  stats: GEN2_STATS,
  statLabels: STAT_LABELS,
  ivSystem: { kind: 'dv', max: 15, hpDerived: true, label: 'DV' },
  shiny: {
    inGame: true,
    odds: 8192,
    dvRule: {
      label: 'Shiny Pokémon',
      description:
        'A Pokémon is Shiny when its Defense, Speed and Special DVs are all 10 and its Attack DV is ' +
        '2, 3, 6, 7, 10, 11, 14 or 15 — 1 in 8192 at random. An egg takes its Defense and part of its ' +
        'Special DV from one parent (the one of the other gender, or Ditto), so a Shiny parent gives ' +
        'a 1 in 64 chance.',
      isShiny: isShinyDvs,
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
        kind: 'number',
        id: 'your-level',
        label: 'Your Pokémon’s level',
        hint: 'The Level Ball compares it with the wild Pokémon’s level.',
        balls: ['level'],
        min: 1,
        max: 100,
        defaultValue: 'target-level',
      },
      {
        kind: 'boolean',
        id: 'fishing',
        label: 'Hooked with a rod',
        balls: ['lure'],
        defaultValue: false,
      },
      {
        kind: 'select',
        id: 'love',
        label: 'Your Pokémon',
        hint: 'The Love Ball compares your Pokémon in battle with the wild one.',
        balls: ['love'],
        options: [
          { id: 'other', label: 'Another species' },
          { id: 'same-gender', label: 'Same species, same gender' },
          { id: 'opposite-gender', label: 'Same species, other gender' },
        ],
        defaultValue: 'other',
      },
    ],
    reportsShakes: false,
    compute: gen2Capture,
  },
  statValue: dvStat,
  effortFromDefeat: gen2EffortFromDefeat,
  effortLabel: 'Stat Exp',
  effortDescription:
    'Defeating one gives Stat Exp equal to these values, except that Sp. Atk and Sp. Def share one ' +
    'Special Stat Exp, which grows by the Sp. Atk value.',
  dvTraits: GEN2_DV_TRAITS,
  solveIvs: gen2SolveDvs,
  sources: [
    { label: 'Catch rate', url: `${BULBAPEDIA}Catch_rate` },
    { label: 'Poké Ball', url: `${BULBAPEDIA}Pok%C3%A9_Ball` },
    { label: 'Stat', url: `${BULBAPEDIA}Stat` },
    { label: 'Individual values', url: `${BULBAPEDIA}Individual_values` },
    { label: 'Shiny Pokémon', url: `${BULBAPEDIA}Shiny_Pok%C3%A9mon` },
    {
      label: 'The capture code',
      site: 'pret/pokecrystal',
      url:
        'https://github.com/pret/pokecrystal/blob/5beda23ffa505f62e1dad7e3d7c214d1737b3358/' +
        'engine/items/item_effects.asm',
    },
  ],
};
