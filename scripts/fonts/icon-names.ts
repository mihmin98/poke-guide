/**
 * Finds the Material Symbols the app renders, so the self-hosted icon font can be cut down to exactly
 * those glyphs (plan §13.10). Icons are ligatures: `<mat-icon>search</mat-icon>` draws the glyph whose
 * name is the text, so a name missing from the subset shows up as the word itself.
 *
 * Three forms are recognised, and the app must only use these:
 * - `<mat-icon …>name</mat-icon>`, or an interpolation inside it whose quoted strings are the names
 *   (`{{ open ? 'expand_less' : 'expand_more' }}`);
 * - an `icon: 'name'` property, for icons chosen from data (nav items, the method registry);
 * - an `icon('name')` call (`src/app/shared/icon.ts`), for any other name picked in code.
 */
const MAT_ICON = /<mat-icon\b[^>]*>([\s\S]*?)<\/mat-icon\s*>/g;
const ICON_PROPERTY = /\bicon(?::\s*|\(\s*)'([a-z0-9_]+)'/g;
const QUOTED = /'([a-z0-9_]+)'/g;
const NAME = /^[a-z0-9_]+$/;

export interface IconScan {
  names: string[];
  /** `file: content` for `<mat-icon>` bodies that are neither a name nor an interpolation. */
  problems: string[];
}

export function collectIconNames(files: readonly { path: string; text: string }[]): IconScan {
  const names = new Set<string>();
  const problems: string[] = [];
  for (const { path, text } of files) {
    for (const [, body = ''] of text.matchAll(MAT_ICON)) {
      const content = body.trim();
      if (content.includes('{{')) {
        for (const [, name] of content.matchAll(QUOTED)) names.add(name!);
      } else if (NAME.test(content)) {
        names.add(content);
      } else {
        problems.push(`${path}: <mat-icon>${content}</mat-icon>`);
      }
    }
    for (const [, name] of text.matchAll(ICON_PROPERTY)) names.add(name!);
  }
  return { names: [...names].sort(), problems };
}
