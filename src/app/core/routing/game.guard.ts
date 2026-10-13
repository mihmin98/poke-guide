import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { findGame } from '../games/registry';
import { PLANNED_GAMES_OPEN } from './planned-games';

/** Resolves `:game` through the registry. Unknown games, and `planned` games in production, go to the picker. */
export const gameGuard: CanActivateFn = (route) => {
  const game = findGame(route.paramMap.get('game') ?? '');
  if (game && (game.status === 'available' || inject(PLANNED_GAMES_OPEN))) return true;
  return inject(Router).createUrlTree(['/games']);
};
