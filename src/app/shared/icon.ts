/**
 * Marks a Material Symbols name chosen in code, e.g. a lookup table or a fallback. The self-hosted icon
 * font only holds the icons `npm run fonts` finds (scripts/fonts/icon-names.ts), and it only sees
 * literal `<mat-icon>` text, `icon: '…'` properties and `icon('…')` calls. Any other string would
 * render as its own name.
 */
export function icon<const T extends string>(name: T): T {
  return name;
}
