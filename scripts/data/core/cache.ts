/**
 * Raw page storage: the gitignored on-disk cache (`scripts/data/cache/raw/`), committed fixtures
 * (`__fixtures__/*.wikitext`), and a `PageSource` that combines them with the API client.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { FetchedPage, MediaWikiClient } from './mediawiki-client';

export interface CachedPage extends FetchedPage {
  fetchedAt: string;
}

const cachedPage = z.object({
  title: z.string(),
  resolvedTitle: z.string(),
  revid: z.number(),
  timestamp: z.string(),
  wikitext: z.string(),
  fetchedAt: z.string(),
});

export class PageCache {
  constructor(readonly dir: string) {}

  private fileFor(title: string): string {
    return join(this.dir, `${encodeURIComponent(title)}.json`);
  }

  read(title: string): CachedPage | undefined {
    const file = this.fileFor(title);
    if (!existsSync(file)) return undefined;
    return cachedPage.parse(JSON.parse(readFileSync(file, 'utf8')));
  }

  write(page: CachedPage): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.fileFor(page.title), JSON.stringify(page, null, 2) + '\n');
  }
}

// ---- fixtures: readable wikitext with a one-line JSON header comment ----

const FIXTURE_HEADER = /^<!-- poke-guide fixture: (\{.*\}) -->\n/;
const fixtureMeta = cachedPage.omit({ wikitext: true });

export function formatFixture(page: CachedPage): string {
  const { wikitext, ...meta } = page;
  return `<!-- poke-guide fixture: ${JSON.stringify(meta)} -->\n${wikitext}`;
}

export function parseFixture(content: string): CachedPage {
  const match = FIXTURE_HEADER.exec(content);
  if (!match) throw new Error('Fixture is missing its "poke-guide fixture" header line');
  const meta = fixtureMeta.parse(JSON.parse(match[1]!));
  return { ...meta, wikitext: content.slice(match[0].length) };
}

export function readFixture(file: string): CachedPage {
  return parseFixture(readFileSync(file, 'utf8'));
}

/** All `.wikitext` fixtures in a directory, indexed by requested and resolved title. */
export function loadFixtures(dir: string): Map<string, CachedPage> {
  const pages = new Map<string, CachedPage>();
  if (!existsSync(dir)) return pages;
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.wikitext'))
    .sort()) {
    const page = readFixture(join(dir, name));
    pages.set(page.title, page);
    pages.set(page.resolvedTitle, page);
  }
  return pages;
}

// ---- page source ----

/**
 * `cache-first`: use the cache, fetch only what's missing.
 * `refresh`: fetch everything and rewrite the cache.
 * `offline`: fixtures, then cache; never touches the network.
 */
export type FetchMode = 'cache-first' | 'refresh' | 'offline';

export interface PageSourceOptions {
  mode: FetchMode;
  cache: PageCache;
  client?: MediaWikiClient;
  fixtures?: Map<string, CachedPage>;
  now?: () => Date;
  log?: (message: string) => void;
}

export class PageSource {
  constructor(private readonly options: PageSourceOptions) {}

  /** Pages by requested title; `null` when the page doesn't exist (or isn't available offline). */
  async getPages(titles: readonly string[]): Promise<Map<string, CachedPage | null>> {
    const { mode, cache, client, fixtures } = this.options;
    const result = new Map<string, CachedPage | null>();
    const toFetch: string[] = [];

    for (const title of new Set(titles)) {
      const local = mode === 'refresh' ? undefined : (fixtures?.get(title) ?? cache.read(title));
      if (local) result.set(title, local);
      else if (mode === 'offline') result.set(title, null);
      else toFetch.push(title);
    }

    if (toFetch.length > 0) {
      if (!client) throw new Error(`No MediaWiki client to fetch ${toFetch.length} page(s)`);
      this.options.log?.(`Fetching ${toFetch.length} page(s) from Bulbapedia`);
      const fetchedAt = (this.options.now?.() ?? new Date()).toISOString();
      for (const [title, page] of await client.getPages(toFetch)) {
        if (!page) {
          result.set(title, null);
          continue;
        }
        const cached = { ...page, fetchedAt };
        cache.write(cached);
        result.set(title, cached);
      }
    }
    return result;
  }
}
