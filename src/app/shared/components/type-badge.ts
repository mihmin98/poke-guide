import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { POKEMON_TYPES, type PokemonType } from '../../core/games/pokemon-types';

const LABELS = new Map<PokemonType, string>(POKEMON_TYPES.map((t) => [t.id, t.label]));

/** A Pokémon type badge using the generated `--type-*` tokens (plan §13.1). */
@Component({
  selector: 'app-type-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ label() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 6px;
      font: var(--mat-sys-label-small);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
      background: var(--type-color);
      color: var(--type-on-color);
    }
  `,
  host: {
    '[style.--type-color]': '"var(--type-" + type() + ")"',
    '[style.--type-on-color]': '"var(--type-" + type() + "-on)"',
  },
})
export class TypeBadge {
  readonly type = input.required<PokemonType>();

  protected readonly label = computed(() => LABELS.get(this.type()) ?? this.type());
}
