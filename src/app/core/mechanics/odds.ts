// FRAMEWORK-FREE: turning a per-throw probability into the figures the catch tools show. No Angular imports.
import type { CaptureResult } from './types';

/** Balls needed for `target` confidence, from independent throws. */
export function throwsFor(probability: number, target: number): number {
  if (probability >= 1) return 1;
  return Math.ceil(Math.log(1 - target) / Math.log(1 - probability));
}

/** The shared part of every `CaptureResult`, from the exact chance of one throw. */
export function oddsOf(
  probability: number,
): Pick<CaptureResult, 'probability' | 'expectedThrows' | 'throwsFor' | 'guaranteed'> {
  return {
    probability,
    expectedThrows: probability > 0 ? 1 / probability : null,
    throwsFor:
      probability > 0
        ? {
            p50: throwsFor(probability, 0.5),
            p90: throwsFor(probability, 0.9),
            p99: throwsFor(probability, 0.99),
          }
        : null,
    guaranteed: probability >= 1,
  };
}
