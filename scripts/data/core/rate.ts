import type { Rate } from '../../../src/app/core/domain/models';
import { splitTooltips, stripMarkup } from './markup';

export interface ParsedRate {
  rate: Rate;
  /** Tooltip text, e.g. "If Pikachu's friendship is 147 or higher." */
  note?: string;
}

/** Parses `50%`, `One`, `Purchase for {{PDollar}}500`, `{{tt|One|note}}`. Unrecognized text becomes `unknown`. */
export function parseRate(raw: string): ParsedRate {
  const { text, notes } = splitTooltips(raw);
  const clean = stripMarkup(text);
  const rate = rateFromText(clean);
  return notes.length > 0 ? { rate, note: notes.join(' ') } : { rate };
}

function rateFromText(text: string): Rate {
  const percent = /^(\d+(?:\.\d+)?)\s*%$/.exec(text);
  if (percent) return { kind: 'percent', value: Number(percent[1]) };
  if (/^one$/i.test(text)) return { kind: 'once' };
  const price = /^purchase\b.*?₽\s*([\d,]+)$/i.exec(text);
  if (price) return { kind: 'price', value: Number(price[1]!.replace(/,/g, '')) };
  return { kind: 'unknown', text };
}
