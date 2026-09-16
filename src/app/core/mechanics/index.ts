// FRAMEWORK-FREE: selects a generation's rules (plan §4.5). No Angular imports.
import { getGame, versionGroupOf } from '../games/registry';
import type { GameId } from '../games/types';
import { GEN1_MECHANICS } from './gen1';
import type { GenerationMechanics } from './types';

export * from './types';

const MECHANICS: readonly GenerationMechanics[] = [GEN1_MECHANICS];
const BY_ID = new Map(MECHANICS.map((m) => [m.id, m]));

/** `undefined` for a generation whose module isn't written yet (gen2, gen3…). */
export function findMechanics(id: string): GenerationMechanics | undefined {
  return BY_ID.get(id);
}

/** The rules for a game's version group, or `undefined` while that generation is still `planned`. */
export function mechanicsForGame(game: GameId): GenerationMechanics | undefined {
  return findMechanics(versionGroupOf(getGame(game)).mechanicsId);
}
