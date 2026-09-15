import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { GameId } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';
import { ProfileSwitcherService } from '../../core/profiles/profile-switcher.service';
import { ProfileStore } from '../../core/profiles/profile.store';

/**
 * Explains why catch toggles are disabled on a `/:game/` page (plan §11.3, §13.5): either there is
 * no profile yet, or the active one is for another game. It offers the shortest way out — switch to
 * a profile for this game, or create one.
 */
@Component({
  selector: 'app-game-mismatch-banner',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <aside role="status">
        <mat-icon aria-hidden="true">info</mat-icon>
        <p>{{ text }}</p>
        @if (switchTarget(); as target) {
          <button matButton="filled" type="button" (click)="switchTo(target.id)">
            Use “{{ target.name }}”
          </button>
        } @else {
          <a matButton="filled" [routerLink]="['/', game(), 'welcome']">Create a profile</a>
        }
      </aside>
    }
  `,
  styles: `
    aside {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin: 12px 0;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    p {
      flex: 1;
      min-width: 12ch;
      margin: 0;
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class GameMismatchBanner {
  private readonly profiles = inject(ProfileStore);
  private readonly switcher = inject(ProfileSwitcherService);

  /** The game shown by the route. */
  readonly game = input.required<GameId>();

  private readonly gameName = computed(() => findGame(this.game())?.name ?? this.game());

  protected readonly message = computed(() => {
    if (this.profiles.canEditCatches(this.game())) return null;
    const active = this.profiles.activeProfile();
    if (!active) {
      return `You have no profile yet, so nothing is saved. Create one for ${this.gameName()} to track what you have caught.`;
    }
    const activeGame = findGame(active.game)?.name ?? active.game;
    return `“${active.name}” is a ${activeGame} profile, so catches can't be saved while you are viewing ${this.gameName()}.`;
  });

  /** A profile for this game to switch to, if the user already has one. */
  protected readonly switchTarget = computed(() =>
    this.profiles.profiles().find((p) => p.game === this.game()),
  );

  protected async switchTo(id: string): Promise<void> {
    await this.switcher.switchTo(id);
  }
}
