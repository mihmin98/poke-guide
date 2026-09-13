/** Test helpers for committed wikitext fixtures. */
import { join } from 'node:path';
import { readFixture, type CachedPage } from '../core/cache';
import { fixturesDir } from '../core/paths';

export function fixture(group: string, name: string): CachedPage {
  return readFixture(join(fixturesDir(group), `${name}.wikitext`));
}
