// FRAMEWORK-FREE: level spec helpers shared by the app and the data pipeline. No Angular imports.
import type { LevelSpec } from './models';

/** Union of two level specs (split rows for the same game are merged; time-of-day slots are shown as one). */
export function unionLevels(a: LevelSpec | null, b: LevelSpec | null): LevelSpec | null {
  if (!a) return b;
  if (!b) return a;
  const expand = (spec: LevelSpec) =>
    spec.values ?? Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i);
  const values = [...new Set([...expand(a), ...expand(b)])].sort((x, y) => x - y);
  const min = values[0]!;
  const max = values[values.length - 1]!;
  return values.length === max - min + 1 ? { min, max } : { min, max, values };
}
