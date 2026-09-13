/**
 * Captures raw wikitext fixtures for parser tests.
 *
 *   npm run data:fixtures               uses the cache, fetches what's missing
 *   npm run data:fixtures -- --refresh  refetches every fixture page
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { PageCache, PageSource, formatFixture } from './core/cache';
import { MediaWikiClient } from './core/mediawiki-client';
import { fixturesDir, rawCacheDir, repoRoot } from './core/paths';
import { RBY_FIXTURE_PAGES, type FixturePage } from './version-groups/rby/fixture-pages';

const FIXTURE_PAGES: Record<string, readonly FixturePage[]> = { rby: RBY_FIXTURE_PAGES };

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { group: { type: 'string' }, refresh: { type: 'boolean', default: false } },
  });
  const group = values.group ?? '';
  const pages = FIXTURE_PAGES[group];
  if (!pages) throw new Error(`Unknown --group "${group}". Known: ${Object.keys(FIXTURE_PAGES).join(', ')}`);

  const source = new PageSource({
    mode: values.refresh ? 'refresh' : 'cache-first',
    cache: new PageCache(rawCacheDir()),
    client: new MediaWikiClient({ log: console.warn }),
    log: console.log,
  });
  const fetched = await source.getPages(pages.map((p) => p.title));

  const dir = fixturesDir(group);
  mkdirSync(dir, { recursive: true });
  const missing: string[] = [];
  for (const { name, title } of pages) {
    const page = fetched.get(title);
    if (!page) {
      missing.push(title);
      continue;
    }
    const file = join(dir, `${name}.wikitext`);
    writeFileSync(file, formatFixture(page));
    const redirect = page.resolvedTitle === title ? '' : ` → ${page.resolvedTitle}`;
    console.log(`${relative(repoRoot(), file)}  ${title}${redirect} (rev ${page.revid})`);
  }
  if (missing.length > 0) {
    console.error(`Missing pages: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
