// Pure view model for the IV/DV calculator (plan §13.11): no Angular, so it can be unit-tested on its own.
import type { ShinyVerdict } from '../../core/mechanics';

/** "7", "0–15", "2, 6, 10–12" — consecutive values collapse into ranges. */
export function formatIvList(values: readonly number[] | undefined): string {
  if (!values || values.length === 0) return '—';
  const sorted = [...values].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0]!;
  let previous = start;
  for (const value of sorted.slice(1)) {
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = value;
    previous = value;
  }
  parts.push(start === previous ? `${start}` : `${start}–${previous}`);
  return parts.join(', ');
}

/** How sure the answer is, for the summary line above the table. `label` is the generation's ("DV"). */
export function narrowingLabel(
  combinations: number,
  contradiction: boolean,
  label: string,
): string {
  if (contradiction) return `No ${label} set matches those stats`;
  if (combinations === 0) return 'Enter the stats from the summary screen';
  if (combinations === 1) return `Exactly one ${label} set matches`;
  return `${combinations.toLocaleString()} ${label} sets still match`;
}

export function shinyLabel(verdict: ShinyVerdict): string {
  switch (verdict) {
    case 'yes':
      return 'Yes';
    case 'no':
      return 'No';
    default:
      return 'Possible — narrow it down further';
  }
}
