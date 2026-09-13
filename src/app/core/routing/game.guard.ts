import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { findGame } from '../games/registry';

/** Resolves `:game` through the registry. Unknown games, and `planned` games in production, go to the picker. */
export const gameGuard: CanActivateFn = (route) => {
  const game = findGame(route.paramMap.get('game') ?? '');
  if (game && (game.status === 'available' || isDevMode())) return true;
  return inject(Router).createUrlTree(['/games']);
};
