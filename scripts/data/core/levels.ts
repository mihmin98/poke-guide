import type { LevelSpec } from '../../../src/app/core/domain/models';
import { stripMarkup } from './markup';

const TOKEN = /^(\d+)(?:\s*[-–]\s*(\d+))?$/;

/** Parses `5`, `2-5`, `8, 10, 12`, `2-3, 6`. Returns null for anything else. */
export function parseLevels(raw: string): LevelSpec | null {
  const text = stripMarkup(raw);
  if (!text) return null;
  const levels = new Set<number>();
  for (const token of text.split(',')) {
    const match = TOKEN.exec(token.trim());
    if (!match) return null;
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (to < from) return null;
    for (let level = from; level <= to; level++) levels.add(level);
  }
  const values = [...levels].sort((a, b) => a - b);
  const min = values[0]!;
  const max = values[values.length - 1]!;
  return values.length === max - min + 1 ? { min, max } : { min, max, values };
}

export { unionLevels } from '../../../src/app/core/domain/levels';
