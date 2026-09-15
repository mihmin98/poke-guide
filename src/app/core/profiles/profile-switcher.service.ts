import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { findGame } from '../games/registry';
import { CurrentGameService } from '../routing/current-game.service';
import { ProfileStore } from './profile.store';

/** Sections under `/:game/` that are safe to carry across a game switch. */
const PORTABLE_SECTIONS = new Set(['guide', 'checklist']);

/**
 * Makes a profile active and follows it to its game. Switching profiles is an explicit "I am
 * playing this run now", so staying on the previous game's pages would only put the user straight
 * into the game-mismatch state (plan §11.3).
 */
@Injectable({ providedIn: 'root' })
export class ProfileSwitcherService {
  private readonly router = inject(Router);
  private readonly currentGame = inject(CurrentGameService);
  private readonly profiles = inject(ProfileStore);

  /** Activates `id`, then navigates if the URL is pinned to a different game. */
  async switchTo(id: string): Promise<void> {
    this.profiles.setActive(id);
    await this.followActiveProfile();
  }

  /**
   * Navigates to the active profile's game when the current URL names a different one. On a page
   * with no game in the URL (`/profiles`, `/settings`) nothing moves: `CurrentGameService` already
   * repoints the nav, so the user stays where they are.
   */
  async followActiveProfile(): Promise<void> {
    const urlGame = this.currentGame.urlGame();
    const game = this.profiles.activeProfile()?.game;
    if (!urlGame || !game || urlGame.id === game || !findGame(game)) return;

    // Keep the section (guide → guide), but drop deeper segments: a location or Pokémon from the
    // old game may not exist in the new one.
    const section = this.currentGame.path().split('/')[2] ?? '';
    await this.router.navigate(['/', game, PORTABLE_SECTIONS.has(section) ? section : 'guide']);
  }
}
