import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { findGame } from '../games/registry';
import type { GameDefinition } from '../games/types';
import { ProfileStore } from '../profiles/profile.store';

/** The game selected by the URL (`/:game/...`), remembered while visiting game-independent pages. */
@Injectable({ providedIn: 'root' })
export class CurrentGameService {
  private readonly router = inject(Router);
  private readonly profiles = inject(ProfileStore);

  /** Current URL path after redirects, without query or fragment. */
  readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => this.pathOf(e.urlAfterRedirects)),
    ),
    { initialValue: this.pathOf(this.router.url) },
  );

  /** The game named by the first URL segment, if any. */
  readonly urlGame = computed(() => findGame(this.path().split('/')[1] ?? ''));

  /** The active profile's game, when this build still knows it. */
  private readonly profileGame = computed(() =>
    findGame(this.profiles.activeProfile()?.game ?? ''),
  );

  /**
   * The game the shell is themed and linked for. The URL wins (plan §11.3: the URL decides which
   * data is shown), so opening someone else's Red link keeps showing Red. Off a `/:game/` route the
   * active profile decides, so switching profiles on `/profiles` repoints Guide and Checklist.
   */
  readonly game = linkedSignal<
    { url: GameDefinition | undefined; profile: GameDefinition | undefined },
    GameDefinition | undefined
  >({
    source: () => ({ url: this.urlGame(), profile: this.profileGame() }),
    computation: ({ url, profile }, previous) => url ?? profile ?? previous?.value,
  });

  private pathOf(url: string): string {
    return (
      '/' +
      (this.router.parseUrl(url).root.children['primary']?.segments ?? [])
        .map((s) => s.path)
        .join('/')
    );
  }
}
