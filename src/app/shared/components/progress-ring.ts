import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Fraction done, clamped to 0–1; a total of 0 counts as complete-but-empty (0). */
export function progressFraction(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, value / total));
}

/** A progress ring with "caught / total" in the middle (plan §13.4). */
@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 48 48" role="img" [attr.aria-label]="ariaLabel()">
      <circle class="track" cx="24" cy="24" [attr.r]="radius" />
      <circle
        class="bar"
        cx="24"
        cy="24"
        [attr.r]="radius"
        [attr.stroke-dasharray]="circumference"
        [attr.stroke-dashoffset]="offset()"
      />
    </svg>
    <span class="text" aria-hidden="true">
      <strong>{{ value() }}</strong>
      <span class="total">/ {{ total() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    svg {
      width: 48px;
      height: 48px;
      flex: none;
      transform: rotate(-90deg);
    }
    circle {
      fill: none;
      stroke-width: 5;
    }
    .track {
      stroke: var(--mat-sys-surface-container-highest);
    }
    .bar {
      stroke: var(--mat-sys-primary);
      stroke-linecap: round;
      transition: stroke-dashoffset 200ms ease;
    }
    .text {
      font: var(--mat-sys-title-medium);
      font-variant-numeric: tabular-nums;
    }
    .total {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class ProgressRing {
  readonly value = input.required<number>();
  readonly total = input.required<number>();
  /** Names what is being counted: "caught in Kanto". */
  readonly label = input('caught');

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;

  protected readonly fraction = computed(() => progressFraction(this.value(), this.total()));
  protected readonly offset = computed(() => CIRCUMFERENCE * (1 - this.fraction()));
  protected readonly ariaLabel = computed(
    () => `${this.value()} of ${this.total()} ${this.label()}`,
  );
}
