import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { groupGamesByGeneration, listGames, regionName } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { PLANNED_GAMES_OPEN } from '../../core/routing/planned-games';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

@Component({
  selector: 'app-game-picker-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Choose a game</h1>
    @for (group of groups; track group.generation) {
      <section [attr.aria-labelledby]="'gen-' + group.generation">
        <h2 [id]="'gen-' + group.generation">{{ group.title }}</h2>
        @for (row of group.rows; track row[0]!.versionGroupId) {
          <ul class="cards">
            @for (game of row; track game.id) {
              <li [class]="'game-' + game.id">
                @if (game.status === 'available' || plannedGamesOpen) {
                  @let count = profileCounts()[game.id] ?? 0;
                  <!-- A game with no profile goes to onboarding (plan §11.3). -->
                  <a class="card" [routerLink]="['/', game.id, count > 0 ? 'guide' : 'welcome']">
                    <span class="swatch" aria-hidden="true"></span>
                    <span class="name">
                      {{ game.name }} <span class="year">{{ game.releaseYear }}</span>
                    </span>
                    @if (game.status === 'planned') {
                      <span class="badge">Coming Soon</span>
                    }
                    <span class="action">
                      {{ count === 0 ? 'Start' : count === 1 ? '1 profile' : count + ' profiles' }}
                    </span>
                  </a>
                } @else {
                  <div class="card soon">
                    <span class="swatch" aria-hidden="true"></span>
                    <span class="name">
                      {{ game.name }} <span class="year">{{ game.releaseYear }}</span>
                    </span>
                    <span class="badge">Coming Soon</span>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    section {
      margin-bottom: 24px;
    }
    .cards {
      list-style: none;
      padding: 0;
      margin: 0 0 12px;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
    .card {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 64px;
      padding: 0 16px;
      border-radius: 12px;
      text-decoration: none;
      color: var(--mat-sys-on-surface);
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    a.card:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .card:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
      border: 4px solid var(--mat-sys-primary);
      box-sizing: border-box;
    }
    .name {
      flex: 1;
      font: var(--mat-sys-title-medium);
    }
    .year {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .soon {
      background: none;
      border-style: dashed;
      color: var(--mat-sys-on-surface-variant);
    }
    .soon .swatch {
      opacity: 0.6;
    }
    .badge {
      font: var(--mat-sys-label-small);
      padding: 2px 8px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .action {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
    }
  `,
})
export class GamePickerPage {
  private readonly profiles = inject(ProfileStore);

  /** How many profiles exist per game id, for the card's "N profiles" label. */
  protected readonly profileCounts = computed(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const profile of this.profiles.profiles()) {
      counts[profile.game] = (counts[profile.game] ?? 0) + 1;
    }
    return counts;
  });

  /** `planned` games are always listed, as "Coming Soon"; they only open in dev builds. */
  protected readonly plannedGamesOpen = inject(PLANNED_GAMES_OPEN);

  protected readonly groups = groupGamesByGeneration(listGames({ includePlanned: true })).map(
    (group) => {
      const regions = [...new Set(group.rows.flat().flatMap((g) => g.regions))].map(regionName);
      return { ...group, title: `Generation ${ROMAN[group.generation]} — ${regions.join(', ')}` };
    },
  );
}
