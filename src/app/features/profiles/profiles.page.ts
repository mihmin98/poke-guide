import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { GameId, Profile } from '../../core/domain/models';
import { findGame, listGames } from '../../core/games/registry';
import { ProfileSwitcherService } from '../../core/profiles/profile-switcher.service';
import { ProfileStore } from '../../core/profiles/profile.store';
import { UndoSnackbarService } from '../../core/profiles/undo-snackbar.service';
import {
  ConfirmDialog,
  type ConfirmDialogData,
  ProfileNameDialog,
  type ProfileNameDialogData,
  type ProfileNameDialogResult,
} from './profile-dialogs';

interface ProfileRow {
  profile: Profile;
  /** The registry game, or `undefined` for a profile saved by a newer app (plan §11.4). */
  gameName: string | undefined;
  gameId: GameId;
  isActive: boolean;
  caught: number;
}

/** `/profiles` (plan §12.1): manage profiles. Import and export arrive in Phase 5. */
@Component({
  selector: 'app-profiles-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1>Profiles</h1>
      <button matButton="filled" type="button" (click)="create()">
        <mat-icon aria-hidden="true">add</mat-icon>
        New profile
      </button>
    </header>

    @if (rows().length === 0) {
      <p class="empty">
        You have no profiles yet. Create one to start tracking which Pokémon you have caught, or
        <a routerLink="/games">pick a game</a> to get started.
      </p>
    } @else {
      <ul class="cards">
        @for (row of rows(); track row.profile.id) {
          <li [class]="'game-' + row.gameId" [class.active]="row.isActive">
            <article class="card">
              <div class="info">
                <h2>{{ row.profile.name }}</h2>
                <p class="meta">
                  <span class="chip">{{ row.gameName ?? 'Unsupported game' }}</span>
                  <span>{{ row.caught }} caught</span>
                  @if (row.profile.progressPart; as part) {
                    <span>· Part {{ part }}</span>
                  }
                </p>
              </div>

              @if (row.isActive) {
                <span class="chip active-chip">Active</span>
              } @else if (row.gameName) {
                <button matButton type="button" (click)="setActive(row.profile)">Use</button>
              }

              <button
                matIconButton
                type="button"
                [matMenuTriggerFor]="menu"
                [attr.aria-label]="'Actions for ' + row.profile.name"
              >
                <mat-icon aria-hidden="true">more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item type="button" (click)="rename(row.profile)">
                  <mat-icon aria-hidden="true">edit</mat-icon>
                  <span>Rename</span>
                </button>
                <button mat-menu-item type="button" (click)="duplicate(row.profile)">
                  <mat-icon aria-hidden="true">content_copy</mat-icon>
                  <span>Duplicate</span>
                </button>
                <button mat-menu-item type="button" (click)="remove(row.profile)">
                  <mat-icon aria-hidden="true">delete</mat-icon>
                  <span>Delete</span>
                </button>
              </mat-menu>
            </article>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .empty {
      max-width: 60ch;
      color: var(--mat-sys-on-surface-variant);
    }
    .cards {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
    .card {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 72px;
      padding: 8px 8px 8px 16px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .active .card {
      border-color: var(--mat-sys-primary);
    }
    .info {
      flex: 1;
      min-width: 0;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
      overflow-wrap: anywhere;
    }
    .meta {
      margin: 4px 0 0;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .chip {
      padding: 2px 8px;
      border-radius: 8px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .active-chip {
      font: var(--mat-sys-label-small);
    }
  `,
})
export class ProfilesPage {
  private readonly profiles = inject(ProfileStore);
  private readonly dialog = inject(MatDialog);
  private readonly undoSnackbar = inject(UndoSnackbarService);
  private readonly switcher = inject(ProfileSwitcherService);

  protected readonly rows = computed<ProfileRow[]>(() => {
    const activeId = this.profiles.activeProfileId();
    return this.profiles.profiles().map((profile) => ({
      profile,
      gameName: findGame(profile.game)?.name,
      gameId: profile.game,
      isActive: profile.id === activeId,
      caught: profile.caught.length,
    }));
  });

  protected async create(): Promise<void> {
    const result = await this.openNameDialog({
      title: 'New profile',
      confirmLabel: 'Create',
      name: '',
      games: listGames({ includePlanned: isDevMode() }),
    });
    if (!result) return;
    this.profiles.createProfile(result.name, result.game);
    void this.undoSnackbar.show();
  }

  protected async rename(profile: Profile): Promise<void> {
    const result = await this.openNameDialog({
      title: 'Rename profile',
      confirmLabel: 'Rename',
      name: profile.name,
      game: profile.game,
    });
    if (!result || result.name === profile.name) return;
    this.profiles.renameProfile(profile.id, result.name);
    void this.undoSnackbar.show();
  }

  protected duplicate(profile: Profile): void {
    this.profiles.duplicateProfile(profile.id);
    void this.undoSnackbar.show();
  }

  protected async remove(profile: Profile): Promise<void> {
    const data: ConfirmDialogData = {
      title: `Delete ${profile.name}?`,
      message: `This profile has ${profile.caught.length} caught Pokémon. You can undo this right after.`,
      confirmLabel: 'Delete',
    };
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, true>(ConfirmDialog, { data })
        .afterClosed(),
    );
    if (!confirmed) return;
    this.profiles.deleteProfile(profile.id);
    void this.undoSnackbar.show();
  }

  protected async setActive(profile: Profile): Promise<void> {
    await this.switcher.switchTo(profile.id);
    void this.undoSnackbar.show();
  }

  private openNameDialog(
    data: ProfileNameDialogData,
  ): Promise<ProfileNameDialogResult | undefined> {
    return firstValueFrom(
      this.dialog
        .open<ProfileNameDialog, ProfileNameDialogData, ProfileNameDialogResult>(
          ProfileNameDialog,
          {
            data,
          },
        )
        .afterClosed(),
    );
  }
}
