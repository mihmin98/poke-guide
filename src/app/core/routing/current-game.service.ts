import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { findGame } from '../games/registry';
import type { GameDefinition } from '../games/types';

/** The game selected by the URL (`/:game/...`), remembered while visiting game-independent pages. */
@Injectable({ providedIn: 'root' })
export class CurrentGameService {
  private readonly router = inject(Router);

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

  /** The URL game, or the last one visited. */
  readonly game = linkedSignal<GameDefinition | undefined, GameDefinition | undefined>({
    source: this.urlGame,
    computation: (game, previous) => game ?? previous?.value,
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
