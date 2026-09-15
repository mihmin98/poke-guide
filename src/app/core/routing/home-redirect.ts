import { inject } from '@angular/core';
import { type RedirectFunction, type UrlTree } from '@angular/router';
import { findGame } from '../games/registry';
import { ProfileStore } from '../profiles/profile.store';

/**
 * `/` goes to the active profile's game (plan §11.3), or to the game picker when there is no
 * usable profile. A profile for a game that is no longer in the registry falls back to the picker.
 */
export const homeRedirect: RedirectFunction = (): string | UrlTree => {
  const game = inject(ProfileStore).activeProfile()?.game;
  return game && findGame(game) ? `/${game}/guide` : '/games';
};
