import {
  battleLevels,
  encounterLevels,
  preferredVariant,
  teamLevels,
  trainerLine,
  variantLabel,
  variantPrompt,
} from './milestone-levels';
import type { Milestone, TrainerTeam } from './models';
import { testEncounter, testLocation } from './testing/test-data';

const team = (levels: number[], extra: Partial<TrainerTeam> = {}): TrainerTeam => ({
  trainer: 'Blue',
  pokemon: levels.map((level) => ({ dex: 16, level, moves: [] })),
  ...extra,
});

const milestone = (extra: Partial<Milestone> = {}): Milestone => ({
  no: 1,
  id: 'm',
  label: 'm',
  kind: 'battle',
  part: { red: 1, blue: 1 },
  locationId: 'route-16',
  ...extra,
});

describe('milestone levels (plan §13.12, Phase 19)', () => {
  it('gives a team its lowest and highest level', () => {
    expect(teamLevels(team([12, 14]))).toEqual({ min: 12, max: 14 });
    expect(teamLevels(team([]))).toBeNull();
  });

  it('spans every variant of a battle in the game', () => {
    const rival = milestone({
      teams: {
        red: [
          team([9, 8], { variant: { kind: 'starter', dex: 1 } }),
          team([9, 10], { variant: { kind: 'starter', dex: 4 } }),
        ],
      },
    });
    expect(battleLevels(rival, 'red')).toEqual({ min: 8, max: 10 });
    expect(battleLevels(rival, 'blue')).toBeNull();
  });

  it("reads a static encounter's or gift's levels from its location in the game", () => {
    const snorlax = milestone({ kind: 'encounter', dex: 143 });
    const location = testLocation('route-16', 11, [
      testEncounter(143, ['red'], {
        method: 'static',
        games: { red: [{ levels: { min: 30, max: 30 }, rate: { kind: 'once' } }] },
      }),
      testEncounter(84, ['red']),
    ]);
    expect(encounterLevels(snorlax, 'red', location)).toEqual({ min: 30, max: 30 });
    expect(encounterLevels(snorlax, 'blue', location)).toBeNull();
    expect(encounterLevels(milestone(), 'red', location)).toBeNull();
    expect(encounterLevels(snorlax, 'red', undefined)).toBeNull();
  });

  it('prefers the starter variant you have caught, only when exactly one matches', () => {
    const teams = [1, 4, 7].map((dex) => team([5], { variant: { kind: 'starter', dex } }));
    expect(preferredVariant(teams, new Set([4]))).toBe(1);
    expect(preferredVariant(teams, new Set([4, 7]))).toBe(0);
    expect(preferredVariant(teams, new Set())).toBe(0);
    const eevee = [team([25], { variant: { kind: 'rival-eevee', dex: 134, evolved: false } })];
    expect(preferredVariant(eevee, new Set([134]))).toBe(0);
  });

  it('labels variants and trainers', () => {
    expect(variantLabel({ kind: 'starter', dex: 1 }, 'Bulbasaur')).toBe('If you chose Bulbasaur');
    expect(variantLabel({ kind: 'rival-eevee', dex: 134, evolved: true }, 'Vaporeon')).toBe(
      'If his Eevee becomes Vaporeon',
    );
    expect(variantPrompt({ kind: 'starter', dex: 1 })).toBe('You chose');
    expect(trainerLine(team([12], { trainer: 'Brock', trainerClass: 'Leader', prize: 1386 }))).toBe(
      'Leader Brock · ₽1,386',
    );
    expect(trainerLine(team([5]))).toBe('Blue');
  });
});
