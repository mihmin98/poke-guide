// FRAMEWORK-FREE: story battle teams and levels (plan §13.12, Phase 19). No Angular imports.
import { unionLevels } from './levels';
import type {
  GameId,
  GameLocation,
  LevelSpec,
  Milestone,
  TeamVariant,
  TrainerTeam,
} from './models';

/** The lowest and highest level of a team. */
export function teamLevels(team: TrainerTeam): LevelSpec | null {
  const levels = team.pokemon.map((p) => p.level);
  return levels.length ? { min: Math.min(...levels), max: Math.max(...levels) } : null;
}

/** The milestone's teams in `game`; empty when it has none there. */
export function teamsIn(milestone: Milestone, game: GameId): readonly TrainerTeam[] {
  return milestone.teams?.[game] ?? [];
}

/** The level range over every variant of the milestone's battle in `game`, as one continuous range. */
export function battleLevels(milestone: Milestone, game: GameId): LevelSpec | null {
  const ranges = teamsIn(milestone, game)
    .map(teamLevels)
    .filter((l): l is LevelSpec => l !== null);
  if (ranges.length === 0) return null;
  return {
    min: Math.min(...ranges.map((l) => l.min)),
    max: Math.max(...ranges.map((l) => l.max)),
  };
}

/**
 * A static encounter's or gift's level (Snorlax: Lv 30): the levels of the milestone's `dex` encounters at its
 * location in `game`. `null` for milestones without `dex` or an encounter with levels.
 */
export function encounterLevels(
  milestone: Milestone,
  game: GameId,
  location: GameLocation | undefined,
): LevelSpec | null {
  if (milestone.dex === undefined || !location) return null;
  let levels: LevelSpec | null = null;
  for (const area of location.subAreas)
    for (const encounter of area.encounters)
      if (encounter.dex === milestone.dex)
        for (const slot of encounter.games[game] ?? []) levels = unionLevels(levels, slot.levels);
  return levels;
}

/**
 * The variant to show first: the starter variant whose starter is in `caught`, when exactly one is; otherwise
 * the first. `caught` should be empty unless the active profile is for this game.
 */
export function preferredVariant(
  teams: readonly TrainerTeam[],
  caught: ReadonlySet<number>,
): number {
  const matches = teams
    .map((team, index) => ({ team, index }))
    .filter(({ team }) => team.variant?.kind === 'starter' && caught.has(team.variant.dex));
  return matches.length === 1 ? matches[0]!.index : 0;
}

/** "If you chose Bulbasaur" · "If his Eevee becomes Vaporeon". */
export function variantLabel(variant: TeamVariant, name: string): string {
  return variant.kind === 'starter' ? `If you chose ${name}` : `If his Eevee becomes ${name}`;
}

/** The words before the variant tabs: "You chose" · "His Eevee becomes". */
export function variantPrompt(variant: TeamVariant): string {
  return variant.kind === 'starter' ? 'You chose' : 'His Eevee becomes';
}

/** "Leader Brock · ₽1,386". */
export function trainerLine(team: TrainerTeam): string {
  const who = team.trainerClass ? `${team.trainerClass} ${team.trainer}` : team.trainer;
  return team.prize === undefined ? who : `${who} · ₽${team.prize.toLocaleString('en-US')}`;
}
