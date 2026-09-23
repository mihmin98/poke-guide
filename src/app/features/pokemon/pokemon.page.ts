import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import type { GameId } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';
import { CatchToggle } from '../../shared/components/catch-toggle';
import { GameMismatchBanner } from '../../shared/components/game-mismatch-banner';
import { LevelRange } from '../../shared/components/level-range';
import { RateDisplay } from '../../shared/components/rate';
import { Sprite } from '../../shared/components/sprite';
import { TypeBadge } from '../../shared/components/type-badge';
import { pageTitle } from '../../shared/page-title';
import { mechanicsForGame } from '../../core/mechanics';
import { unobtainableLabel } from '../checklist/checklist-model';
import { catchDifficulty, catchRateFor } from '../location/location-model';
import { buildCatchGrid, formatChance } from '../tools/catch-model';
import { buildLearnset, buildPokemonView, entriesFor, genderText } from './pokemon-model';

/** The highest Gen I base stat is 255 (Chansey's HP), so the bars are scaled to it. */
const MAX_BASE_STAT = 255;

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

const GROWTH_RATES: Record<string, string> = {
  erratic: 'Erratic',
  fast: 'Fast',
  'medium-fast': 'Medium Fast',
  'medium-slow': 'Medium Slow',
  slow: 'Slow',
  fluctuating: 'Fluctuating',
};

/** `/:game/pokemon/:key` (plan §13.7): where to find a species, its family, entry and learnsets. */
@Component({
  selector: 'app-pokemon-page',
  imports: [
    MatIconModule,
    RouterLink,
    CatchToggle,
    GameMismatchBanner,
    LevelRange,
    RateDisplay,
    Sprite,
    TypeBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <header class="head">
        <app-sprite [dex]="v.species.dex" [game]="gameId()" [name]="v.species.name" [size]="96" />
        <div>
          <p class="num">#{{ pad(v.species.dex) }}</p>
          <h1>{{ v.species.name }}</h1>
          <p class="types">
            @for (type of v.species.types; track type) {
              <app-type-badge [type]="type" />
            }
          </p>
          <p class="sub">{{ v.species.category }} Pokémon</p>
        </div>
        <app-catch-toggle [dex]="v.species.dex" [game]="gameId()" [name]="v.species.name" />
      </header>

      <app-game-mismatch-banner [game]="gameId()" />

      <section class="card facts">
        <dl>
          <div>
            <dt>Height</dt>
            <dd>{{ v.species.heightM }} m</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{{ v.species.weightKg }} kg</dd>
          </div>
          <div>
            <dt>Growth rate</dt>
            <dd>{{ growthRate(v.species.growthRate) }}</dd>
          </div>
          <div>
            <dt>Base experience</dt>
            <dd>{{ v.species.baseExp }}</dd>
          </div>
          @if (v.species.eggGroups; as groups) {
            @if (groups.length) {
              <div>
                <dt>Egg groups</dt>
                <dd>{{ groups.join(', ') }}</dd>
              </div>
            }
          }
          @if (v.species.genderRatio !== undefined) {
            <div>
              <dt>Gender</dt>
              <dd>{{ gender(v.species.genderRatio) }}</dd>
            </div>
          }
          @if (catchRate(); as rate) {
            <div>
              <dt>Catch rate</dt>
              <dd>
                {{ rate }}
                <span class="difficulty" [class]="'cr-' + difficulty(rate)">{{
                  difficultyLabel(difficulty(rate))
                }}</span>
              </dd>
            </div>
          }
        </dl>
        @if (catchRateNote(); as note) {
          <p class="sub">{{ note }}</p>
        }
      </section>

      @if (statRows().length) {
        <section>
          <h2>Base stats in {{ generationName() }}</h2>
          <ul class="stats">
            @for (row of statRows(); track row.stat) {
              <li>
                <span class="stat-label">{{ row.label }}</span>
                <span class="bar" aria-hidden="true">
                  <span [style.width.%]="row.percent"></span>
                </span>
                <span class="stat-value">{{ row.value }}</span>
              </li>
            }
            <li class="total">
              <span class="stat-label">Total</span>
              <span class="bar" aria-hidden="true"></span>
              <span class="stat-value">{{ statTotal() }}</span>
            </li>
          </ul>
          <p class="sub">
            Defeating one gives {{ effortLabel() }} equal to these values.
          </p>
          <p class="sub">
            A Pokémon's own stats also depend on its {{ ivLabel() }}s and {{ effortLabel() }} —
            <a [routerLink]="['/', game(), 'tools', 'ivs']" [queryParams]="{ dex: v.species.dex }">
              work them out from the summary screen</a
            >.
          </p>
        </section>
      }

      @if (catchGrid(); as grid) {
        <section>
          <h2>Catching it at full HP</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Ball</th>
                  @for (status of grid.statuses; track status.id) {
                    <th scope="col">{{ status.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of grid.rows; track row.ball.id) {
                  <tr>
                    <th scope="row">{{ row.ball.name }}</th>
                    @for (cell of row.cells; track cell.statusId) {
                      <td [class.best]="cell.best">{{ chance(cell.result.probability) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="sub">
            Chance per throw with a full-health target.
            <a [routerLink]="['/', game(), 'tools', 'catch']" [queryParams]="{ dex: v.species.dex }">
              Open the catch calculator</a
            >
            to change the HP, throw bait or rocks and see how many balls you need.
          </p>
        </section>
      }

      @if (shinyTransfer(); as transfer) {
        <section>
          <h2>{{ transfer.label }}</h2>
          <p>{{ transfer.description }}</p>
          <p class="sub">
            <a [routerLink]="['/', game(), 'tools', 'ivs']" [queryParams]="{ dex: v.species.dex }">
              Check a caught {{ v.species.name }} in the {{ ivLabel() }} calculator</a
            >.
          </p>
          @if (transfer.impossibleNote) {
            <p class="sub">{{ transfer.impossibleNote }}</p>
          }
        </section>
      }

      <section>
        <h2>Where to find it in {{ gameName() }}</h2>
        @if (v.obtainable) {
          <ul class="sources">
            @for (source of v.sources; track $index) {
              <li>
                @if (source.locationId) {
                  <a [routerLink]="['/', game(), 'guide', source.locationId]">{{ source.label }}</a>
                } @else {
                  {{ source.label }}
                }
                @if (source.detail) {
                  · {{ source.detail }}
                }
                · Part {{ source.part }}
              </li>
            }
          </ul>
          @for (label of v.exclusiveGroupLabels; track label) {
            <p class="sub">One choice only: {{ label }}.</p>
          }
        } @else {
          <p class="status">
            Not obtainable in {{ gameName() }} without trading.
            @if (v.unobtainableReason) {
              {{ reasonLabel(v.unobtainableReason) }}.
            }
            @if (v.unobtainableDetail) {
              {{ v.unobtainableDetail }}.
            }
          </p>
        }
      </section>

      @if (v.otherGames.length) {
        <section>
          <h2>Other games in this version group</h2>
          @for (other of v.otherGames; track other.game) {
            <h3>{{ name(other.game) }}</h3>
            <ul class="sources">
              @for (place of other.places; track $index) {
                <li>
                  <a [routerLink]="['/', other.game, 'guide', place.locationId]">{{
                    place.locationName
                  }}</a>
                  · {{ place.methodLabel }}
                  @if (place.levels) {
                    · <app-level-range [levels]="place.levels" />
                  }
                  @if (place.rate) {
                    · <app-rate [rate]="place.rate" />
                  }
                  @if (place.times) {
                    · {{ place.times }}
                  }
                </li>
              }
            </ul>
          }
        </section>
      }

      @if (v.family.length) {
        <section>
          <h2>Evolution line</h2>
          <ul class="family">
            @for (step of v.family; track $index) {
              <li>
                <a [routerLink]="['/', game(), 'pokemon', slug(step.fromDex)]">
                  <app-sprite
                    [dex]="step.fromDex"
                    [game]="gameId()"
                    [name]="step.fromName"
                    [size]="48"
                  />
                  {{ step.fromName }}
                </a>
                <span class="arrow">
                  <mat-icon aria-hidden="true">arrow_forward</mat-icon>
                  {{ step.detail }}
                  @if (step.requiresTrade) {
                    <span class="warn">not possible without trading</span>
                  }
                </span>
                <a [routerLink]="['/', game(), 'pokemon', slug(step.toDex)]">
                  <app-sprite
                    [dex]="step.toDex"
                    [game]="gameId()"
                    [name]="step.toName"
                    [size]="48"
                  />
                  {{ step.toName }}
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <section>
        <h2>Pokédex entry</h2>
        @if (pokedexLoading()) {
          <p class="status">Loading the Pokédex…</p>
        } @else {
          @for (entry of entries(); track $index) {
            <blockquote>
              <p>{{ entry.text }}</p>
              <cite>{{ gameNames(entry.games) }}</cite>
            </blockquote>
          } @empty {
            <p class="status">No Pokédex entry in this version group.</p>
          }
        }
      </section>

      <section>
        <h2>Moves in {{ gameName() }}</h2>
        @if (pokedexLoading()) {
          <p class="status">Loading the learnset…</p>
        } @else {
          <h3>By level up</h3>
          <div class="table-wrap">
            <table class="moves">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Move</th>
                  <th>Type</th>
                  <th>Power</th>
                  <th>Acc.</th>
                  <th>PP</th>
                </tr>
              </thead>
              <tbody>
                @for (row of learnset().levelUp; track $index) {
                  <tr>
                    <td>{{ row.level }}</td>
                    <td>{{ row.move.name }}</td>
                    <td><app-type-badge [type]="row.move.type" /></td>
                    <td>{{ row.move.power ?? '—' }}</td>
                    <td>{{ row.move.accuracy === null ? '—' : row.move.accuracy + '%' }}</td>
                    <td>{{ row.move.pp }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">No level-up moves.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (learnset().machines.length) {
            <h3>By TM / HM</h3>
            <ul class="machines">
              @for (move of learnset().machines; track move.id) {
                <li>
                  <span class="tm">{{ move.machine }}</span> {{ move.name }}
                  <app-type-badge [type]="move.type" />
                </li>
              }
            </ul>
          }

          @if (learnset().egg.length) {
            <h3>By breeding</h3>
            <ul class="machines">
              @for (move of learnset().egg; track move.id) {
                <li>{{ move.name }} <app-type-badge [type]="move.type" /></li>
              }
            </ul>
          }

          @if (learnset().tutor.length) {
            <h3>By move tutor</h3>
            <ul class="machines">
              @for (move of learnset().tutor; track move.id) {
                <li>{{ move.name }} <app-type-badge [type]="move.type" /></li>
              }
            </ul>
          }

          @if (learnset().prevo.length) {
            <h3>From a pre-evolution</h3>
            <ul class="machines">
              @for (row of learnset().prevo; track row.move.id) {
                <li>
                  {{ row.move.name }} <span class="sub">— from {{ row.from.join(', ') }}</span>
                </li>
              }
            </ul>
          }
        }
      </section>

      <p class="source-link">
        <a [href]="bulbapediaUrl(v.species.name)" target="_blank" rel="noopener noreferrer">
          {{ v.species.name }} on Bulbapedia
        </a>
      </p>

      <nav class="prev-next">
        @if (v.previous; as prev) {
          <a [routerLink]="['/', game(), 'pokemon', prev.slug]">← {{ prev.name }}</a>
        }
        @if (v.next; as next) {
          <a class="next" [routerLink]="['/', game(), 'pokemon', next.slug]">{{ next.name }} →</a>
        }
      </nav>
    } @else if (data().isLoading()) {
      <p class="status">Loading {{ gameName() }} data…</p>
    } @else if (data().error()) {
      <p class="status error">
        The {{ gameName() }} data could not be loaded. Check your connection and reload.
      </p>
    } @else {
      <p class="status">
        No Pokémon called “{{ key() }}” in {{ gameName() }}.
        <a [routerLink]="['/', game(), 'checklist']">Back to the checklist</a>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .head > div {
      flex: 1 1 200px;
    }
    h1 {
      margin: 0;
    }
    .num {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .types {
      display: flex;
      gap: 4px;
      margin: 8px 0 0;
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
    .facts dl {
      display: flex;
      flex-wrap: wrap;
      gap: 16px 32px;
      margin: 0;
    }
    .facts dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
    .facts dd {
      margin: 0;
      font: var(--mat-sys-body-medium);
    }
    section {
      margin-top: 24px;
    }
    h2 {
      margin: 0 0 8px;
    }
    h3 {
      margin: 16px 0 4px;
    }
    .sources,
    .machines {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .sources li,
    .machines li {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      padding: 4px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .tm {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .family {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .family li {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .family a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: inherit;
    }
    .arrow {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .warn {
      color: var(--mat-sys-error);
    }
    blockquote {
      margin: 0 0 12px;
      padding: 8px 12px;
      border-left: 3px solid var(--mat-sys-primary);
      background: var(--mat-sys-surface-container-low);
    }
    blockquote p {
      margin: 0;
    }
    cite {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-small);
    }
    th,
    td {
      text-align: left;
      padding: 4px 8px 4px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .status {
      color: var(--mat-sys-on-surface-variant);
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .source-link {
      margin-top: 24px;
      font: var(--mat-sys-body-small);
    }
    .prev-next {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 24px 0;
    }
    .prev-next .next {
      margin-left: auto;
    }
    .difficulty {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 999px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    .difficulty.cr-easy {
      background: color-mix(in srgb, green 18%, var(--mat-sys-surface-container-high));
    }
    .difficulty.cr-hard {
      background: color-mix(in srgb, var(--mat-sys-error) 18%, var(--mat-sys-surface-container-high));
    }
    .stats {
      list-style: none;
      margin: 0;
      padding: 0;
      max-width: 480px;
    }
    .stats li {
      display: grid;
      grid-template-columns: 64px 1fr 40px;
      align-items: center;
      gap: 8px;
      padding: 2px 0;
      font: var(--mat-sys-body-small);
    }
    .stats .stat-label {
      color: var(--mat-sys-on-surface-variant);
    }
    .stats .bar {
      height: 8px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-high);
      overflow: hidden;
    }
    .stats .bar > span {
      display: block;
      height: 100%;
      background: var(--mat-sys-primary);
    }
    .stats .stat-value {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .stats .total {
      font-weight: 600;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    td.best {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: 600;
    }
  `,
})
export class PokemonPage {
  private readonly gameData = inject(GameDataService);

  /** Route params, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();
  /** A species slug, or a National Dex number. */
  readonly key = input.required<string>();

  constructor() {
    pageTitle(() => {
      const name = this.view()?.species.name;
      return name && `${name} · ${this.gameName()}`;
    });
  }

  protected readonly gameId = computed(() => this.game() as GameId);
  protected readonly gameName = computed(() => findGame(this.game())?.name ?? '');
  /**
   * `forGame` creates the `httpResource` for a version group, which starts an effect, so it must not
   * run inside a reactive context (NG0602).
   */
  protected readonly data = computed(() => {
    const id = this.gameId();
    return untracked(() => this.gameData.forGame(id));
  });

  /** The Pokédex file is only requested once this page is opened (plan §11.4). */
  private readonly pokedexResource = computed(() => untracked(() => this.data().pokedex()));
  private readonly pokedex = computed(() => {
    const resource = this.pokedexResource();
    return resource.hasValue() ? resource.value() : undefined;
  });
  protected readonly pokedexLoading = computed(() => this.pokedexResource().isLoading());

  protected readonly view = computed(() => {
    const data = this.data().data();
    const view = this.data().view();
    if (!data || !view) return undefined;
    return buildPokemonView({
      data,
      view,
      game: this.gameId(),
      key: this.key().toLowerCase(),
      entries: this.data().checklist(),
    });
  });

  protected readonly entries = computed(() => {
    const dex = this.view()?.species.dex;
    return dex === undefined ? [] : entriesFor(this.pokedex(), dex, this.gameId());
  });

  protected readonly learnset = computed(() => {
    const dex = this.view()?.species.dex;
    const byDex = this.data().speciesByDex();
    return buildLearnset(
      this.pokedex(),
      dex ?? 0,
      this.gameId(),
      (d) => (byDex.get(d)?.name ?? `#${d}`) as string,
    );
  });

  private readonly mechanics = computed(() => mechanicsForGame(this.gameId()));
  protected readonly ivLabel = computed(() => this.mechanics()?.ivSystem.label ?? 'IV');
  protected readonly effortLabel = computed(() => this.mechanics()?.effortLabel ?? 'EVs');
  protected readonly shinyTransfer = computed(() => this.mechanics()?.shiny.transfer);
  protected readonly generationName = computed(() => {
    const game = findGame(this.game());
    return game ? `Generation ${ROMAN[game.generation] ?? game.generation}` : 'this generation';
  });

  /** The value this game uses, which can differ from the version group's (Yellow Dragonair is 27). */
  protected readonly catchRate = computed(() =>
    catchRateFor(this.view()?.species, this.gameId(), undefined),
  );
  protected readonly catchRateNote = computed(() => {
    const species = this.view()?.species;
    if (!species) return undefined;
    const perGame = species.catchRateByGame?.[this.gameId()];
    const note = species.catchRateNote;
    const differs =
      perGame !== undefined && perGame !== species.catchRate
        ? `${this.gameName()} uses ${perGame} where the other games in this version group use ${species.catchRate}.`
        : undefined;
    return [differs, note].filter(Boolean).join(' ') || undefined;
  });

  protected readonly statRows = computed(() => {
    const mechanics = this.mechanics();
    const species = this.view()?.species;
    if (!mechanics || !species) return [];
    return mechanics.stats
      .filter((stat) => species.baseStats[stat] !== undefined)
      .map((stat) => {
        const value = species.baseStats[stat]!;
        return {
          stat,
          label: mechanics.statLabels[stat] ?? stat,
          value,
          percent: Math.min(100, Math.round((value / MAX_BASE_STAT) * 100)),
        };
      });
  });
  protected readonly statTotal = computed(() =>
    this.statRows().reduce((sum, row) => sum + row.value, 0),
  );

  /** The quick grid (plan §13.11): every ball and status against a full-health target. */
  protected readonly catchGrid = computed(() => {
    const mechanics = this.mechanics();
    const catchRate = this.catchRate();
    if (!mechanics || catchRate === undefined) return undefined;
    return buildCatchGrid(mechanics, { catchRate, currentHp: 100, maxHp: 100 });
  });

  protected readonly chance = formatChance;
  protected readonly difficulty = catchDifficulty;
  protected difficultyLabel(level: string): string {
    return level === 'easy' ? 'easy' : level === 'medium' ? 'tricky' : 'hard';
  }

  protected reasonLabel = unobtainableLabel;

  protected pad(dex: number): string {
    return String(dex).padStart(3, '0');
  }

  protected gender = genderText;

  protected growthRate(rate: string): string {
    return GROWTH_RATES[rate] ?? rate;
  }

  protected name(game: GameId): string {
    return findGame(game)?.name ?? game;
  }

  protected gameNames(games: readonly GameId[]): string {
    return games.map((game) => this.name(game)).join(', ');
  }

  protected slug(dex: number): string {
    return this.data().speciesByDex().get(dex)?.slug ?? String(dex);
  }

  /** From the name, not the slug: `Ho-Oh`, `Nidoran♀`, `Mr. Mime` keep their page titles. */
  protected bulbapediaUrl(name: string): string {
    const title = encodeURIComponent(`${name} (Pokémon)`.replace(/ /g, '_'));
    return `https://bulbapedia.bulbagarden.net/wiki/${title}`;
  }
}
