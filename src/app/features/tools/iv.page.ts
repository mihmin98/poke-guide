import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import type { GameId, Species, StatId } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';
import { mechanicsForGame, type StatObservation } from '../../core/mechanics';
import { Sprite } from '../../shared/components/sprite';
import { formatIvList, narrowingLabel, shinyLabel } from './iv-model';

interface Reading {
  level: number;
  stats: Partial<Record<StatId, number>>;
}

/** `/:game/tools/ivs` (plan §13.11): narrows a Pokémon's DVs from the stats on its summary screen. */
@Component({
  selector: 'app-iv-tool-page',
  imports: [MatButtonModule, MatIconModule, RouterLink, Sprite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ ivLabel() }} calculator</h1>
    @if (mechanics(); as m) {
      @if (species(); as target) {
        <p class="sub">
          Type the stats from the summary screen. Every {{ ivLabel() }} set that could produce them is
          listed; adding a second reading after a few level-ups narrows it further.
        </p>

        <section class="card">
          <div class="row">
            <label class="field wide">
              <span>Pokémon</span>
              <select [value]="dexValue()" (change)="onSpecies($event)">
                @for (option of allSpecies(); track option.dex) {
                  <option [value]="option.dex">#{{ pad(option.dex) }} {{ option.name }}</option>
                }
              </select>
            </label>
            <div class="target">
              <app-sprite [dex]="target.dex" [game]="gameId()" [name]="target.name" [size]="48" />
              <span class="sub">
                Base
                @for (stat of m.stats; track stat) {
                  {{ m.statLabels[stat] }} {{ target.baseStats[stat] ?? '—' }}@if (!$last) {
                    ·
                  }
                }
              </span>
            </div>
          </div>

          <div class="table-wrap">
            <table class="readings">
              <thead>
                <tr>
                  <th scope="col">Reading</th>
                  <th scope="col">Level</th>
                  @for (stat of m.stats; track stat) {
                    <th scope="col">{{ m.statLabels[stat] }}</th>
                  }
                  <th scope="col"><span class="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                @for (reading of readings(); track $index; let row = $index) {
                  <tr>
                    <th scope="row">{{ row + 1 }}</th>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        [value]="reading.level"
                        [attr.aria-label]="'Level for reading ' + (row + 1)"
                        (input)="onLevel(row, $event)"
                      />
                    </td>
                    @for (stat of m.stats; track stat) {
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          [value]="reading.stats[stat] ?? ''"
                          [attr.aria-label]="m.statLabels[stat] + ' for reading ' + (row + 1)"
                          (input)="onStat(row, stat, $event)"
                        />
                      </td>
                    }
                    <td>
                      <button
                        matIconButton
                        type="button"
                        [disabled]="readings().length === 1"
                        [attr.aria-label]="'Remove reading ' + (row + 1)"
                        (click)="removeReading(row)"
                      >
                        <mat-icon>close</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="actions">
            <button matButton type="button" (click)="addReading()">
              <mat-icon aria-hidden="true">add</mat-icon>
              Add a reading
            </button>
            <button matButton type="button" (click)="reset()">Clear</button>
          </div>

          <p class="sub">
            {{ m.effortLabel }} is assumed to be zero, which is true for a Pokémon you have just
            caught. One that has battled will look like it has higher {{ ivLabel() }}s.
          </p>
        </section>

        <section class="card result" [class.error]="solution().contradiction">
          <p class="headline">{{ narrowing() }}</p>
          @if (solution().contradiction) {
            <p class="sub">
              Check the level and the stats — a trained Pokémon needs its {{ m.effortLabel }} taken
              into account, which this tool does not do yet.
            </p>
          } @else {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    @for (stat of m.stats; track stat) {
                      <th scope="col">{{ m.statLabels[stat] }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    @for (stat of m.stats; track stat) {
                      <td>{{ ivList(stat) }}</td>
                    }
                  </tr>
                </tbody>
              </table>
            </div>
            @if (m.ivSystem.hpDerived) {
              <p class="sub">
                The HP {{ ivLabel() }} is not stored: it is built from the last bit of the other four.
              </p>
            }
          }
        </section>

        @if (m.shiny.transfer; as transfer) {
          <section class="card shiny">
            <h2>{{ transfer.label }}</h2>
            <p class="headline">{{ shiny() }}</p>
            <p class="sub">{{ transfer.description }}</p>
            @if (transfer.impossibleNote) {
              <p class="sub">{{ transfer.impossibleNote }}</p>
            }
          </section>
        }

        <section class="assumptions">
          <h2>Sources</h2>
          <ul class="sources">
            @for (source of m.sources; track source.url) {
              <li>
                <a [href]="source.url" target="_blank" rel="noopener noreferrer">
                  {{ source.label }} on Bulbapedia
                </a>
              </li>
            }
          </ul>
          <p class="sub">
            <a [routerLink]="['/', game(), 'tools', 'catch']">Catch chance calculator</a>
          </p>
        </section>
      } @else if (data().isLoading()) {
        <p class="status">Loading {{ gameName() }} data…</p>
      } @else if (data().error()) {
        <p class="status error">
          The {{ gameName() }} data could not be loaded. Check your connection and reload.
        </p>
      } @else {
        <p class="status">No species data for {{ gameName() }}.</p>
      }
    } @else {
      <p class="status">
        The stat rules for {{ gameName() }} have not been written yet.
        <a [routerLink]="['/', game(), 'guide']">Back to the guide</a>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h1,
    h2 {
      margin: 0 0 8px;
    }
    .sub {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .card {
      margin: 16px 0;
      padding: 12px 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    section {
      margin-top: 24px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: flex-end;
      margin-bottom: 12px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1 1 220px;
    }
    .field > span {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
    .target {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 2 1 260px;
    }
    select,
    input[type='number'] {
      max-width: 100%;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 8px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
    td input[type='number'] {
      width: 72px;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
    }
    th,
    td {
      padding: 4px 8px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      font: var(--mat-sys-body-medium);
    }
    thead th {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .headline {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .result.error .headline {
      color: var(--mat-sys-error);
    }
    .shiny .headline {
      color: var(--mat-sys-primary);
    }
    .sources {
      list-style: none;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .status {
      margin: 24px 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class IvToolPage {
  private readonly gameData = inject(GameDataService);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  /** `?dex=25`, so the Pokémon page can link straight to a species. */
  readonly dex = input<string>();

  protected readonly gameId = computed(() => this.game() as GameId);
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
  protected readonly mechanics = computed(() => mechanicsForGame(this.gameId()));
  protected readonly ivLabel = computed(() => this.mechanics()?.ivSystem.label ?? 'IV');
  /** `forGame` creates an `httpResource`, so it must not run inside a reactive context (NG0602). */
  protected readonly data = computed(() => {
    const id = this.gameId();
    return untracked(() => this.gameData.forGame(id));
  });

  protected readonly allSpecies = computed(() => this.data().species());
  private readonly chosenDex = signal<number | undefined>(undefined);
  protected readonly species = computed<Species | undefined>(() => {
    const list = this.allSpecies();
    const wanted = this.chosenDex() ?? Number(this.dex() ?? '');
    return list.find((s) => s.dex === wanted) ?? list[0];
  });
  protected readonly dexValue = computed(() => String(this.species()?.dex ?? ''));

  protected readonly readings = signal<Reading[]>([{ level: 5, stats: {} }]);

  protected readonly solution = computed(() => {
    const mechanics = this.mechanics()!;
    const species = this.species();
    const observations: StatObservation[] = this.readings().map((reading) => ({
      level: reading.level,
      stats: reading.stats,
    }));
    return mechanics.solveIvs(species?.baseStats ?? {}, observations);
  });

  protected readonly narrowing = computed(() => {
    const solution = this.solution();
    const entered = this.readings().some((r) => Object.keys(r.stats).length > 0);
    return narrowingLabel(entered ? solution.combinations : 0, solution.contradiction, this.ivLabel());
  });
  protected readonly shiny = computed(() => shinyLabel(this.solution().shiny));

  protected ivList(stat: StatId): string {
    return formatIvList(this.solution().possible[stat]);
  }
  protected pad(dex: number): string {
    return String(dex).padStart(3, '0');
  }

  protected onSpecies(event: Event): void {
    this.chosenDex.set(Number((event.target as HTMLSelectElement).value));
  }
  protected onLevel(index: number, event: Event): void {
    const level = clampInt((event.target as HTMLInputElement).value, 1, 100, 1);
    this.readings.update((list) => list.map((r, i) => (i === index ? { ...r, level } : r)));
  }
  protected onStat(index: number, stat: StatId, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? undefined : clampInt(raw, 1, 999, 1);
    this.readings.update((list) =>
      list.map((reading, i) => {
        if (i !== index) return reading;
        const stats = { ...reading.stats };
        if (value === undefined) delete stats[stat];
        else stats[stat] = value;
        return { ...reading, stats };
      }),
    );
  }
  protected addReading(): void {
    this.readings.update((list) => {
      const last = list[list.length - 1];
      return [...list, { level: Math.min(100, (last?.level ?? 5) + 5), stats: {} }];
    });
  }
  protected removeReading(index: number): void {
    this.readings.update((list) => (list.length === 1 ? list : list.filter((_, i) => i !== index)));
  }
  protected reset(): void {
    this.readings.set([{ level: 5, stats: {} }]);
  }
}

function clampInt(value: unknown, low: number, high: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(high, Math.max(low, Math.round(number)));
}
