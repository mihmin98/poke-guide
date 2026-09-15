import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { GameId } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';

/**
 * A species sprite from the game's sprite set (plan §13.1): fixed size, pixelated, never a layout shift.
 * `dimmed` draws the uncaught silhouette used by the guide's sprite strips.
 */
@Component({
  selector: 'app-sprite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      [src]="src()"
      [alt]="alt()"
      [width]="size()"
      [height]="size()"
      loading="lazy"
      decoding="async"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    img {
      image-rendering: pixelated;
      object-fit: contain;
    }
    :host([data-dimmed='true']) img {
      filter: brightness(0) opacity(0.35);
    }
    @media (forced-colors: active) {
      :host([data-dimmed='true']) img {
        opacity: 0.4;
        filter: none;
      }
    }
  `,
  host: { '[attr.data-dimmed]': 'dimmed()' },
})
export class Sprite {
  readonly dex = input.required<number>();
  readonly game = input.required<GameId>();
  /** Species name, for the alt text. Empty renders a decorative sprite. */
  readonly name = input<string>('');
  /** Uncaught species are drawn as a silhouette. */
  readonly dimmed = input(false);
  /** Rendered box in CSS pixels; Gen I sprites are 56×56. */
  readonly size = input(56);

  protected readonly src = computed(() => {
    const setId = findGame(this.game())?.spriteSetId ?? 'gen1-rb';
    return `sprites/${setId}/${String(this.dex()).padStart(3, '0')}.png`;
  });

  protected readonly alt = computed(() => this.name());
}
