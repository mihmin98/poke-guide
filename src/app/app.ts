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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import type { Profile } from './core/domain/models';
import { GAMES, findGame } from './core/games/registry';
import { ProfileSwitcherService } from './core/profiles/profile-switcher.service';
import { ProfileStore } from './core/profiles/profile.store';
import { UndoSnackbarService } from './core/profiles/undo-snackbar.service';
import { CurrentGameService } from './core/routing/current-game.service';
import { StorageService } from './core/storage/storage.service';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  active: boolean;
}

interface ProfileItem {
  profile: Profile;
  gameName: string;
  caught: number;
  isActive: boolean;
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
  private readonly profiles = inject(ProfileStore);
  private readonly undoSnackbar = inject(UndoSnackbarService);
  private readonly switcher = inject(ProfileSwitcherService);
  private readonly storage = inject(StorageService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly game = this.currentGame.game;
  protected readonly activeProfile = this.profiles.activeProfile;

  /** The switcher's list, grouped by game so profiles for one game stay together (plan §12.1). */
  protected readonly profileItems = computed<ProfileItem[]>(() => {
    const activeId = this.profiles.activeProfileId();
    return [...this.profiles.profiles()]
      .map((profile) => ({
        profile,
        gameName: findGame(profile.game)?.name ?? 'Unsupported game',
        caught: profile.caught.length,
        isActive: profile.id === activeId,
      }))
      .sort((a, b) => a.gameName.localeCompare(b.gameName));
  });

  /** "New profile…" goes to onboarding for the current game, or to the picker when there is none. */
  protected readonly newProfileLink = computed(() => {
    const game = this.game();
    return game ? `/${game.id}/welcome` : '/games';
  });

  protected async switchTo(profile: Profile): Promise<void> {
    await this.switcher.switchTo(profile.id);
    void this.undoSnackbar.show();
  }

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

    // Saved state that could not be read (plan §11.5). `newer` is not data loss: the app is older
    // than the save, so the wording must not suggest the progress was thrown away.
    let announced = false;
    effect(() => {
      const recovery = this.storage.recovery();
      if (!recovery || announced) return;
      announced = true;
      const backed = recovery.backupKey
        ? 'Your saved progress was backed up in this browser.'
        : 'Your saved progress could not be backed up.';
      const message =
        recovery.reason === 'newer'
          ? `This copy of Poké Guide is older than your saved progress, so it started empty. ${backed}`
          : `Your saved progress could not be read, so Poké Guide started empty. ${backed}`;
      this.snackBar.open(message, 'Dismiss');
    });
  }
}
