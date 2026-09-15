/** Roman-numeral generation labels used in Bulbapedia headings and template parameters. */

const ROMAN_VALUES: readonly [string, number][] = [
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
];

export function toRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 39)
    throw new Error(`Unsupported generation ${value}`);
  let rest = value;
  let out = '';
  for (const [numeral, amount] of ROMAN_VALUES) {
    while (rest >= amount) {
      out += numeral;
      rest -= amount;
    }
  }
  return out;
}

export function fromRoman(numeral: string): number | null {
  const upper = numeral.trim().toUpperCase();
  if (!/^[IVX]+$/.test(upper)) return null;
  let value = 0;
  let i = 0;
  for (const [symbol, amount] of ROMAN_VALUES) {
    while (upper.startsWith(symbol, i)) {
      value += amount;
      i += symbol.length;
    }
  }
  return i === upper.length && toRoman(value) === upper ? value : null;
}

export interface GenerationRange {
  from: number;
  /** `Infinity` for "onward". */
  to: number;
}

const RANGE = /^Generations?\s+([IVX]+)(?:\s*(?:[-–]|\s+to\s+)\s*([IVX]+)|\s+(onwards?|only))?$/i;

/**
 * `Generations I-V` / `Generations I to V` → 1..5, `Generation VI onward(s)` → 6..∞, `Generation I` → 1..1.
 * Plain text input.
 */
export function parseGenerationRange(text: string): GenerationRange | null {
  const match = RANGE.exec(text.trim());
  if (!match) return null;
  const from = fromRoman(match[1]!);
  if (from === null) return null;
  if (match[2]) {
    const to = fromRoman(match[2]);
    return to !== null && to >= from ? { from, to } : null;
  }
  return { from, to: match[3]?.toLowerCase().startsWith('onward') ? Infinity : from };
}
