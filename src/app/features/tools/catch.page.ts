import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import type { GameId, Species } from '../../core/domain/models';
import {
  mechanicsForGame,
  type CaptureInputDef,
  type CaptureInputValue,
} from '../../core/mechanics';
import { findGame } from '../../core/games/registry';
import { Sprite } from '../../shared/components/sprite';
import { catchRateFor } from '../location/location-model';
import {
  buildCatchGrid,
  chanceWithin,
  estimateMaxHp,
  formatChance,
  formatOdds,
  hpAtPercent,
  inputsForBall,
  resolveInputs,
} from './catch-model';

/** `/:game/tools/catch` (plan §13.11): exact capture odds, driven entirely by the generation's rules. */
@Component({
  selector: 'app-catch-tool-page',
  imports: [MatIconModule, RouterLink, Sprite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Catch chance calculator</h1>
    @if (mechanics(); as m) {
      <p class="sub">
        Exact odds for {{ gameName() }}, counting every outcome of the game's own capture algorithm.
      </p>

      @if (species(); as target) {
        <section class="card controls">
          <div class="row">
            <label class="field wide">
              <span>Pokémon</span>
              <select [value]="dexValue()" (change)="onSpecies($event)">
                @for (option of allSpecies(); track option.dex) {
                  <option [value]="option.dex">#{{ pad(option.dex) }} {{ option.name }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Ball</span>
              <select [value]="ballId()" (change)="onBall($event)">
                @for (ball of m.capture.balls; track ball.id) {
                  <option [value]="ball.id">{{ ball.name }}</option>
                }
              </select>
            </label>

            <label class="field">
              <span>Status</span>
              <select [value]="statusId()" (change)="onStatus($event)">
                @for (status of m.capture.statuses; track status.id) {
                  <option [value]="status.id">{{ status.label }}</option>
                }
              </select>
            </label>

            @for (def of visibleInputs(); track def.id) {
              @switch (def.kind) {
                @case ('select') {
                  <label class="field">
                    <span [title]="def.hint ?? ''">{{ def.label }}</span>
                    <select [value]="inputText(def)" (change)="onSelectInput(def.id, $event)">
                      @for (option of optionsOf(def); track option.id) {
                        <option [value]="option.id">{{ option.label }}</option>
                      }
                    </select>
                  </label>
                }
                @case ('number') {
                  <label class="field narrow">
                    <span [title]="def.hint ?? ''">{{ def.label }}</span>
                    <input
                      type="number"
                      [min]="rangeOf(def).min"
                      [max]="rangeOf(def).max"
                      [value]="inputText(def)"
                      (input)="onNumberInput(def, $event)"
                    />
                  </label>
                }
                @case ('boolean') {
                  <label class="field check" [title]="def.hint ?? ''">
                    <input
                      type="checkbox"
                      [checked]="resolvedInputs()[def.id] === true"
                      (change)="onBooleanInput(def.id, $event)"
                    />
                    <span>{{ def.label }}</span>
                  </label>
                }
              }
            }
          </div>

          <div class="row">
            <label class="field narrow">
              <span>Level</span>
              <input
                type="number"
                min="1"
                max="100"
                [value]="chosenLevel()"
                (input)="onLevel($event)"
              />
            </label>
            <label class="field narrow">
              <span>Max HP</span>
              <input
                type="number"
                min="1"
                max="999"
                [value]="maxHp()"
                (input)="onMaxHp($event)"
              />
            </label>
            <label class="field narrow">
              <span>Current HP</span>
              <input
                type="number"
                min="1"
                max="999"
                [value]="currentHp()"
                (input)="onCurrentHp($event)"
              />
            </label>
            <label class="field slider">
              <span>HP left: {{ hpPercent() }}%</span>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                [value]="hpPercent()"
                (input)="onHpPercent($event)"
              />
            </label>
          </div>
          <p class="sub">
            Max HP is an estimate for level {{ chosenLevel() }} with average {{ m.ivSystem.label }}s
            and no {{ m.effortLabel }} — type the real number from the battle screen for an exact
            answer.
          </p>
        </section>

        <section class="card result">
          <div class="target">
            <app-sprite [dex]="target.dex" [game]="gameId()" [name]="target.name" [size]="64" />
            <div>
              <h2>{{ target.name }}</h2>
              <p class="sub">
                Catch rate {{ catchRate() }}
                @if (result().effectiveCatchRate !== catchRate()) {
                  → {{ result().effectiveCatchRate }} for this throw
                }
                · {{ currentHp() }}/{{ maxHp() }} HP · {{ ballName() }} · {{ statusLabel() }}
              </p>
            </div>
          </div>

          <p class="headline">{{ chance(result().probability) }}</p>
          <p class="sub">per throw — {{ odds(result().expectedThrows) }}</p>
          @if (result().notes; as notes) {
            <ul class="notes">
              @for (note of notes; track note) {
                <li>{{ note }}</li>
              }
            </ul>
          }

          <dl class="facts">
            @if (result().throwsFor; as needed) {
              <div>
                <dt>Balls for a 50% chance</dt>
                <dd>{{ needed.p50 }}</dd>
              </div>
              <div>
                <dt>90%</dt>
                <dd>{{ needed.p90 }}</dd>
              </div>
              <div>
                <dt>99%</dt>
                <dd>{{ needed.p99 }}</dd>
              </div>
            }
            @if (m.capture.reportsShakes && result().shakesOnFailure !== undefined) {
              <div>
                <dt>Shakes when it breaks free</dt>
                <dd>{{ shakeLabel(result().shakesOnFailure!) }}</dd>
              </div>
            }
          </dl>

          @if (m.capture.reportsShakes && m.capture.shakesNote) {
            <p class="sub">{{ m.capture.shakesNote }}</p>
          }

          @if (limited(); as supply) {
            <p class="limited">
              <mat-icon aria-hidden="true">pets</mat-icon>
              With {{ ballsLeft() }} {{ supply.label }}, the chance of catching it is
              <strong>{{ chance(withinLimited()) }}</strong
              >.
              <label>
                <span class="sr-only">{{ supply.label }}</span>
                <input
                  type="number"
                  min="1"
                  [max]="supply.count"
                  [value]="ballsLeft()"
                  (input)="onBallsLeft($event)"
                />
              </label>
            </p>
          }
        </section>

        <section>
          <h2>Every ball and status at {{ hpPercent() }}% HP</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Ball</th>
                  @for (status of grid().statuses; track status.id) {
                    <th scope="col">{{ status.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of grid().rows; track row.ball.id) {
                  <tr>
                    <th scope="row">{{ row.ball.name }}</th>
                    @for (cell of row.cells; track cell.statusId) {
                      <td [class.best]="cell.best">
                        {{ chance(cell.result.probability) }}
                        @if (cell.best) {
                          <span class="sr-only">(best)</span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="sub">The best ball per column is highlighted, ignoring the Master Ball.</p>
        </section>

        <section class="assumptions">
          <h2>Assumptions and sources</h2>
          <ul>
            <li>Every throw is independent: the odds above assume nothing changes between balls.</li>
            <li>
              The catch rate is the one this game uses for {{ target.name }}, including any per-game
              value.
            </li>
            <li>
              <a [routerLink]="['/', game(), 'pokemon', target.slug]">{{ target.name }}</a> has its
              own page with base stats and DV information.
            </li>
          </ul>
          <ul class="sources">
            @for (source of m.sources; track source.url) {
              <li>
                <a [href]="source.url" target="_blank" rel="noopener noreferrer">
                  {{ source.label }} on {{ source.site ?? 'Bulbapedia' }}
                </a>
              </li>
            }
          </ul>
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
        The capture rules for {{ gameName() }} have not been written yet.
        <a [routerLink]="['/', game(), 'guide']">Back to the guide</a>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h1 {
      margin: 0;
    }
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
    }
    .row + .row {
      margin-top: 12px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1 1 160px;
    }
    .field > span {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
    .field.wide {
      flex: 2 1 220px;
    }
    .field.narrow {
      flex: 0 1 100px;
    }
    .field.slider {
      flex: 1 1 200px;
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
    input[type='range'] {
      accent-color: var(--mat-sys-primary);
      width: 100%;
    }
    .target {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .target h2 {
      margin: 0;
    }
    .headline {
      margin: 12px 0 0;
      font: var(--mat-sys-display-small);
      color: var(--mat-sys-primary);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 32px;
      margin: 16px 0 0;
    }
    .facts dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
    .facts dd {
      margin: 0;
      font: var(--mat-sys-body-medium);
    }
    .field.check {
      flex: 0 1 auto;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding-bottom: 6px;
    }
    .field.check > span {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface);
    }
    .notes {
      margin: 12px 0 0;
      padding-left: 20px;
      font: var(--mat-sys-body-medium);
    }
    .limited {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 16px 0 0;
      font: var(--mat-sys-body-medium);
    }
    .limited input {
      width: 72px;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      min-width: 420px;
    }
    th,
    td {
      padding: 6px 12px;
      text-align: right;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      font: var(--mat-sys-body-medium);
    }
    thead th,
    tbody th {
      text-align: left;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    td.best {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: 600;
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
  `,
})
export class CatchToolPage {
  private readonly gameData = inject(GameDataService);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  /** `?dex=25&level=7`, so a Pokémon page or an encounter row can open the tool ready to use. */
  readonly dex = input<string>();
  readonly level = input<string>();

  protected readonly gameId = computed(() => this.game() as GameId);
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
  protected readonly mechanics = computed(() => mechanicsForGame(this.gameId()));
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

  protected readonly ballId = signal('poke');
  protected readonly statusId = signal('none');
  /** The player's input choices; the rest keep their defaults (`resolvedInputs`). */
  private readonly chosenInputs = signal<Record<string, CaptureInputValue>>({});

  /** Seeded from `?level=`, then the player's to change. */
  protected readonly chosenLevel = linkedSignal(() => clampInt(this.level(), 1, 100, 20));
  /** Follows the species and level until the player types the real number from the battle screen. */
  protected readonly maxHp = linkedSignal(() => {
    const mechanics = this.mechanics();
    const species = this.species();
    return mechanics && species ? estimateMaxHp(mechanics, species.baseStats, this.chosenLevel()) : 1;
  });
  /** Keeps its share of the max when the max changes, so the slider doesn't jump. */
  protected readonly currentHp = linkedSignal<number, number>({
    source: this.maxHp,
    computation: (maxHp, previous) =>
      previous && previous.source > 0
        ? hpAtPercent(maxHp, (previous.value / previous.source) * 100)
        : maxHp,
  });
  protected readonly hpPercent = computed(() =>
    Math.max(1, Math.round((this.currentHp() / this.maxHp()) * 100)),
  );

  protected readonly catchRate = computed(() =>
    catchRateFor(this.species(), this.gameId(), undefined),
  );

  protected readonly visibleInputs = computed(() =>
    inputsForBall(this.mechanics()!, this.ballId()),
  );
  protected readonly resolvedInputs = computed(() =>
    resolveInputs(this.mechanics()!, this.chosenInputs(), this.chosenLevel()),
  );

  /** Everything but the ball and status, shared by the headline result and the grid. */
  private readonly situation = computed(() => ({
    catchRate: this.catchRate() ?? 0,
    currentHp: this.currentHp(),
    maxHp: this.maxHp(),
    level: this.chosenLevel(),
    target: this.species(),
    game: this.gameId(),
    inputs: this.resolvedInputs(),
  }));

  protected readonly result = computed(() =>
    this.mechanics()!.capture.compute({
      ...this.situation(),
      ballId: this.ballId(),
      statusId: this.statusId(),
    }),
  );

  protected readonly grid = computed(() => buildCatchGrid(this.mechanics()!, this.situation()));

  /** Safari Balls, Park Balls: handed out in a fixed number. */
  protected readonly limited = computed(
    () => this.mechanics()?.capture.balls.find((b) => b.id === this.ballId())?.limited,
  );
  protected readonly ballsLeft = linkedSignal(() => this.limited()?.count ?? 1);
  protected readonly withinLimited = computed(() =>
    chanceWithin(this.result().probability, this.ballsLeft()),
  );
  protected readonly ballName = computed(
    () => this.mechanics()?.capture.balls.find((b) => b.id === this.ballId())?.name ?? '',
  );
  protected readonly statusLabel = computed(
    () => this.mechanics()?.capture.statuses.find((s) => s.id === this.statusId())?.label ?? '',
  );

  protected readonly chance = formatChance;
  protected readonly odds = formatOdds;
  protected pad(dex: number): string {
    return String(dex).padStart(3, '0');
  }
  protected shakeLabel(shakes: number): string {
    return shakes === 0 ? 'the ball misses' : `${shakes} ${shakes === 1 ? 'shake' : 'shakes'}`;
  }
  protected inputText(def: CaptureInputDef): string {
    return String(this.resolvedInputs()[def.id] ?? '');
  }
  protected optionsOf(def: CaptureInputDef): { id: string; label: string }[] {
    return def.kind === 'select' ? def.options : [];
  }
  protected rangeOf(def: CaptureInputDef): { min: number; max: number } {
    return def.kind === 'number' ? def : { min: 0, max: 0 };
  }
  protected onSpecies(event: Event): void {
    this.chosenDex.set(Number((event.target as HTMLSelectElement).value));
  }
  protected onBall(event: Event): void {
    this.ballId.set((event.target as HTMLSelectElement).value);
  }
  protected onStatus(event: Event): void {
    this.statusId.set((event.target as HTMLSelectElement).value);
  }
  protected onSelectInput(id: string, event: Event): void {
    this.setInput(id, (event.target as HTMLSelectElement).value);
  }
  protected onNumberInput(def: CaptureInputDef, event: Event): void {
    const { min, max } = this.rangeOf(def);
    const raw = (event.target as HTMLInputElement).value;
    this.setInput(def.id, clampInt(raw, min, max, Number(this.inputText(def)) || min));
  }
  protected onBooleanInput(id: string, event: Event): void {
    this.setInput(id, (event.target as HTMLInputElement).checked);
  }
  private setInput(id: string, value: CaptureInputValue): void {
    this.chosenInputs.update((current) => ({ ...current, [id]: value }));
  }
  protected onLevel(event: Event): void {
    this.chosenLevel.set(clampInt((event.target as HTMLInputElement).value, 1, 100, 20));
  }
  protected onMaxHp(event: Event): void {
    this.maxHp.set(clampInt((event.target as HTMLInputElement).value, 1, 999, this.maxHp()));
  }
  protected onCurrentHp(event: Event): void {
    this.currentHp.set(clampInt((event.target as HTMLInputElement).value, 1, this.maxHp(), 1));
  }
  protected onHpPercent(event: Event): void {
    this.currentHp.set(hpAtPercent(this.maxHp(), Number((event.target as HTMLInputElement).value)));
  }
  protected onBallsLeft(event: Event): void {
    const count = this.limited()?.count ?? 1;
    this.ballsLeft.set(clampInt((event.target as HTMLInputElement).value, 1, count, count));
  }
}

function clampInt(value: unknown, low: number, high: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(high, Math.max(low, Math.round(number)));
}
