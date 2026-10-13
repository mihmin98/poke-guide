import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import type { GameId } from '../../core/domain/models';
import { getGame } from '../../core/games/registry';

/**
 * A species sprite from the game's sprite set (plan §13.1): fixed size, pixelated, never a layout shift.
 * `dimmed` draws the uncaught silhouette used by the guide's sprite strips. Sprites are cached only once
 * seen (plan §13.10), so offline an unseen one fails to load: it shows a same-size placeholder instead
 * of a broken image, and tries again when the connection comes back.
 */
@Component({
  selector: 'app-sprite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (failed()) {
      <span
        class="placeholder"
        role="img"
        [attr.aria-label]="alt() || null"
        [attr.aria-hidden]="alt() ? null : 'true'"
        [style.width.px]="size()"
        [style.height.px]="size()"
      ></span>
    } @else {
      <img
        [src]="src()"
        [alt]="alt()"
        [width]="size()"
        [height]="size()"
        loading="lazy"
        decoding="async"
        (error)="failed.set(true)"
      />
    }
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
    .placeholder {
      display: grid;
      place-items: center;
    }
    .placeholder::before {
      content: '';
      width: 50%;
      height: 50%;
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: 50%;
    }
    @media (forced-colors: active) {
      :host([data-dimmed='true']) img {
        opacity: 0.4;
        filter: none;
      }
      .placeholder::before {
        border-color: GrayText;
      }
    }
  `,
  host: { '[attr.data-dimmed]': 'dimmed()', '(window:online)': 'failed.set(false)' },
})
export class Sprite {
  readonly dex = input.required<number>();
  readonly game = input.required<GameId>();
  /** Species name, for the alt text. Empty renders a decorative sprite. */
  readonly name = input<string>('');
  /** Uncaught species are drawn as a silhouette. */
  readonly dimmed = input(false);
  /** Rendered box in CSS pixels; Gen I and II sprites are 56×56. */
  readonly size = input(56);

  protected readonly src = computed(() => {
    const setId = getGame(this.game()).spriteSetId;
    return `sprites/${setId}/${String(this.dex()).padStart(3, '0')}.png`;
  });

  protected readonly alt = computed(() => this.name());

  /** The image failed to load; reset by a new sprite or by the browser coming back online. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
}
