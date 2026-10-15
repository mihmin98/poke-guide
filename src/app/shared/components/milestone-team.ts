import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import {
  preferredVariant,
  trainerLine,
  variantLabel,
  variantPrompt,
} from '../../core/domain/milestone-levels';
import type { GameId, PokemonType, Species, TrainerTeam } from '../../core/domain/models';
import { POKEMON_TYPES } from '../../core/games/pokemon-types';
import { ProfileStore } from '../../core/profiles/profile.store';
import { Sprite } from './sprite';
import { TypeBadge } from './type-badge';

let nextId = 0;
const TYPE_LABELS = new Map<PokemonType, string>(POKEMON_TYPES.map((t) => [t.id, t.label]));

/**
 * A story battle's team (plan §13.12, Phase 19): variant tabs when the team depends on your starter (or, in
 * Yellow, on how the rival's Eevee evolves), the trainer and prize, and each Pokémon with its level, gender and
 * moves. The first tab shown is the starter you've marked caught, when exactly one of them is.
 */
@Component({
  selector: 'app-milestone-team',
  imports: [RouterLink, Sprite, TypeBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tabs().length > 1) {
      <div class="variants">
        <span class="prompt" aria-hidden="true">{{ prompt() }}</span>
        <div role="tablist" [attr.aria-label]="prompt()">
          @for (tab of tabs(); track $index) {
            <button
              type="button"
              role="tab"
              [id]="id + '-tab-' + $index"
              [attr.aria-selected]="$index === selected()"
              [attr.aria-controls]="id + '-panel'"
              [attr.aria-label]="tab.label"
              [tabIndex]="$index === selected() ? 0 : -1"
              (click)="selected.set($index)"
              (keydown)="onKeydown($event)"
            >
              {{ tab.name }}
            </button>
          }
        </div>
      </div>
    }
    @if (team(); as shown) {
      <div
        class="panel"
        [id]="id + '-panel'"
        [attr.role]="tabs().length > 1 ? 'tabpanel' : null"
        [attr.aria-labelledby]="tabs().length > 1 ? id + '-tab-' + selected() : null"
      >
        <p class="trainer">{{ line() }}</p>
        <ul class="members">
          @for (member of members(); track $index) {
            <li>
              <app-sprite [dex]="member.dex" [game]="game()" [size]="40" />
              <span class="who">
                @if (member.slug) {
                  <a [routerLink]="['/', game(), 'pokemon', member.slug]">{{ member.name }}</a>
                } @else {
                  <span>{{ member.name }}</span>
                }
                @if (member.gender) {
                  <span
                    class="gender"
                    aria-hidden="true"
                    [title]="member.gender === 'male' ? 'Male' : 'Female'"
                  >
                    {{ member.gender === 'male' ? '♂' : '♀' }}
                  </span>
                  <span class="sr-only">{{ member.gender }}</span>
                }
                <span class="level">Lv {{ member.level }}</span>
              </span>
              <span class="types">
                @for (type of member.types; track type) {
                  <app-type-badge [type]="type" />
                }
              </span>
              @if (member.moves.length) {
                <ul class="moves" aria-label="Moves">
                  @for (move of member.moves; track $index) {
                    <li
                      [style.--type-color]="'var(--type-' + move.type + ')'"
                      [title]="typeLabel(move.type)"
                    >
                      {{ move.name }}
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .variants {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin-bottom: 8px;
    }
    .prompt {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    [role='tablist'] {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    [role='tab'] {
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: none;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    [role='tab'][aria-selected='true'] {
      border-color: transparent;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .trainer {
      margin: 0 0 4px;
      font: var(--mat-sys-title-small);
    }
    .members {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .members > li {
      display: grid;
      grid-template-columns: 40px 1fr auto;
      grid-template-areas:
        'sprite who types'
        'sprite moves moves';
      align-items: center;
      column-gap: 8px;
    }
    app-sprite {
      grid-area: sprite;
    }
    .who {
      grid-area: who;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 6px;
      font: var(--mat-sys-body-medium);
    }
    .who a {
      color: var(--mat-sys-primary);
    }
    .level {
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface-variant);
    }
    .types {
      grid-area: types;
      display: flex;
      gap: 4px;
    }
    .moves {
      grid-area: moves;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 2px 0 4px;
      padding: 0;
      list-style: none;
    }
    .moves li {
      padding: 1px 8px;
      border-left: 3px solid var(--type-color);
      border-radius: 6px;
      font: var(--mat-sys-label-medium);
      background: color-mix(
        in srgb,
        var(--type-color) 16%,
        var(--mat-sys-surface-container-highest)
      );
    }
  `,
})
export class MilestoneTeam {
  private readonly gameData = inject(GameDataService);
  private readonly profiles = inject(ProfileStore);

  /** One team, or one per variant. */
  readonly teams = input.required<readonly TrainerTeam[]>();
  readonly game = input.required<GameId>();

  protected readonly id = `milestone-team-${nextId++}`;

  /** `forGame` creates an `httpResource`, so it must not run in a reactive context (NG0602). */
  private readonly data = computed(() => {
    const game = this.game();
    return untracked(() => this.gameData.forGame(game));
  });

  private readonly speciesByDex = computed(
    () => this.data().view()?.speciesByDex ?? new Map<number, Species>(),
  );

  /** Starters only count when the active profile is for this game. */
  private readonly caught = computed<ReadonlySet<number>>(() =>
    this.profiles.canEditCatches(this.game()) ? this.profiles.caughtSet() : new Set(),
  );

  /** Follows the starter guess until you pick a tab; a new guess (you catch another starter) resets it. */
  protected readonly selected = linkedSignal(() => preferredVariant(this.teams(), this.caught()));

  protected readonly tabs = computed(() =>
    this.teams().flatMap((team) => {
      if (!team.variant) return [];
      const name = this.nameOf(team.variant.dex);
      return [{ name, label: variantLabel(team.variant, name) }];
    }),
  );
  protected readonly prompt = computed(() => {
    const variant = this.teams()[0]?.variant;
    return variant ? variantPrompt(variant) : '';
  });

  protected readonly team = computed(() => this.teams()[this.selected()] ?? this.teams()[0]);
  protected readonly line = computed(() => {
    const team = this.team();
    return team ? trainerLine(team) : '';
  });
  protected readonly members = computed(() => {
    const byDex = this.speciesByDex();
    return (this.team()?.pokemon ?? []).map((member) => {
      const species = byDex.get(member.dex);
      return {
        ...member,
        name: species?.name ?? `#${member.dex}`,
        slug: species?.slug,
        types: species?.types ?? [],
      };
    });
  });

  protected typeLabel(type: PokemonType): string {
    return `${TYPE_LABELS.get(type) ?? type} move`;
  }

  private nameOf(dex: number): string {
    return this.speciesByDex().get(dex)?.name ?? `#${dex}`;
  }

  /** Arrow keys, Home and End move between the tabs and select them (the ARIA tabs pattern). */
  protected onKeydown(event: KeyboardEvent): void {
    const count = this.tabs().length;
    const current = this.selected();
    const next =
      event.key === 'ArrowRight'
        ? (current + 1) % count
        : event.key === 'ArrowLeft'
          ? (current - 1 + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.selected.set(next);
    const tablist = (event.currentTarget as HTMLElement).parentElement;
    tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }
}
