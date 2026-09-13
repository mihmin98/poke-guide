import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { GAMES } from './core/games/registry';
import { CurrentGameService } from './core/routing/current-game.service';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  active: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatIconModule, MatMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly currentGame = inject(CurrentGameService);
  protected readonly game = this.currentGame.game;

  protected readonly navItems = computed<NavItem[]>(() => {
    const game = this.game();
    const path = this.currentGame.path();
    const gameLink = (page: string) => (game ? `/${game.id}/${page}` : '/games');
    const isActive = (page: string) => !!game && path.startsWith(`/${game.id}/${page}`);
    return [
      { label: 'Guide', icon: 'menu_book', link: gameLink('guide'), active: isActive('guide') },
      {
        label: 'Checklist',
        icon: 'checklist',
        link: gameLink('checklist'),
        active: isActive('checklist'),
      },
      {
        label: 'Profiles',
        icon: 'account_circle',
        link: '/profiles',
        active: path.startsWith('/profiles'),
      },
    ];
  });

  protected readonly moreActive = computed(() =>
    ['/games', '/settings', '/about'].some((p) => this.currentGame.path().startsWith(p)),
  );

  constructor() {
    // On <html> so overlays (menus, dialogs) outside <app-root> get the game's tokens too.
    const rootElement = inject(DOCUMENT).documentElement;
    effect(() => {
      const id = this.game()?.id;
      for (const game of GAMES) rootElement.classList.toggle(`game-${game.id}`, game.id === id);
    });
  }
}
