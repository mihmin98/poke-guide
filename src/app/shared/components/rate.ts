import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Rate } from '../../core/domain/models';

export const RARITY_PIPS = 5;

/** How many of the `RARITY_PIPS` bar segments a percentage fills (plan §13.5). */
export function rarityPips(percent: number): number {
  if (percent >= 30) return 5;
  if (percent >= 15) return 4;
  if (percent >= 10) return 3;
  if (percent >= 5) return 2;
  return 1;
}

export function rarityLabel(percent: number): string {
  if (percent >= 30) return 'Very common';
  if (percent >= 15) return 'Common';
  if (percent >= 10) return 'Uncommon';
  if (percent >= 5) return 'Rare';
  return 'Very rare';
}

/** `12%` · `One` · `180 coins` · `₽500`, or the raw text of an unknown rate. */
export function formatRate(rate: Rate): string {
  switch (rate.kind) {
    case 'percent':
      return `${rate.value}%`;
    case 'once':
      return 'One';
    case 'price':
      return `₽${rate.value.toLocaleString('en')}`;
    case 'coins':
      return `${rate.value.toLocaleString('en')} coins`;
    case 'unknown':
      return rate.text;
  }
}

/** An encounter rate: a percentage with a rarity bar, or the price/one-off text. */
@Component({
  selector: 'app-rate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="text">{{ text() }}</span>
    @if (pips(); as filled) {
      <span class="bar" [attr.aria-label]="hint()">
        @for (pip of pipSlots; track pip) {
          <span class="pip" [class.on]="pip <= filled"></span>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .text {
      font-variant-numeric: tabular-nums;
    }
    .bar {
      display: inline-flex;
      gap: 2px;
    }
    .pip {
      width: 4px;
      height: 12px;
      border-radius: 1px;
      background: var(--mat-sys-surface-variant);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .pip.on {
      background: var(--mat-sys-primary);
      border-color: var(--mat-sys-primary);
    }
  `,
})
export class RateDisplay {
  readonly rate = input.required<Rate>();

  protected readonly pipSlots = Array.from({ length: RARITY_PIPS }, (_, i) => i + 1);
  protected readonly text = computed(() => formatRate(this.rate()));
  protected readonly pips = computed(() => {
    const rate = this.rate();
    return rate.kind === 'percent' ? rarityPips(rate.value) : 0;
  });
  protected readonly hint = computed(() => {
    const rate = this.rate();
    return rate.kind === 'percent' ? rarityLabel(rate.value) : '';
  });
}
