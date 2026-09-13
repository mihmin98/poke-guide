/** URL- and id-safe slugs: `Nidoran♀` → `nidoran-f`, `Farfetch'd` → `farfetchd`, `Area 1 - East` → `area-1-east`. */
export function slugify(input: string): string {
  return input
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
