import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PageCache,
  PageSource,
  formatFixture,
  loadFixtures,
  parseFixture,
  type CachedPage,
} from './cache';
import type { MediaWikiClient } from './mediawiki-client';

const page = (title: string, revid = 1): CachedPage => ({
  title,
  resolvedTitle: title,
  revid,
  timestamp: '2026-01-01T00:00:00Z',
  wikitext: `==Pokémon==\n{{p|${title}}}\n<!-- a comment -->`,
  fetchedAt: '2026-01-02T00:00:00Z',
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'poke-guide-cache-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('PageCache', () => {
  it('round-trips pages, including titles with slashes', () => {
    const cache = new PageCache(join(dir, 'raw'));
    expect(cache.read('A/B')).toBeUndefined();
    cache.write(page('A/B'));
    expect(cache.read('A/B')).toEqual(page('A/B'));
  });
});

describe('fixtures', () => {
  it('round-trips through the readable format', () => {
    const text = formatFixture(page('Kanto Route 1'));
    expect(text.split('\n')[1]).toBe('==Pokémon==');
    expect(parseFixture(text)).toEqual(page('Kanto Route 1'));
  });

  it('rejects files without a header', () => {
    expect(() => parseFixture('==Pokémon==')).toThrow(/header/);
  });

  it('loads a directory indexed by requested and resolved title', () => {
    writeFileSync(
      join(dir, 'lab.wikitext'),
      formatFixture({ ...page('Pokémon Lab'), resolvedTitle: 'Pokémon Research Lab' }),
    );
    const fixtures = loadFixtures(dir);
    expect(fixtures.get('Pokémon Lab')?.revid).toBe(1);
    expect(fixtures.get('Pokémon Research Lab')?.revid).toBe(1);
  });
});

describe('PageSource', () => {
  function fakeClient() {
    const getPages = vi.fn(
      async (titles: readonly string[]) =>
        new Map(titles.map((t) => [t, t === 'Missing' ? null : page(t, 9)])),
    );
    return { client: { getPages } as unknown as MediaWikiClient, getPages };
  }

  it('cache-first fetches only missing pages and writes them to the cache', async () => {
    const cache = new PageCache(dir);
    cache.write(page('Cached'));
    const { client, getPages } = fakeClient();
    const source = new PageSource({
      mode: 'cache-first',
      cache,
      client,
      now: () => new Date('2026-02-01T00:00:00Z'),
    });
    const pages = await source.getPages(['Cached', 'New', 'Missing']);
    expect(getPages).toHaveBeenCalledWith(['New', 'Missing']);
    expect(pages.get('Cached')?.revid).toBe(1);
    expect(pages.get('New')).toMatchObject({ revid: 9, fetchedAt: '2026-02-01T00:00:00.000Z' });
    expect(pages.get('Missing')).toBeNull();
    expect(cache.read('New')?.revid).toBe(9);
  });

  it('refresh ignores the cache', async () => {
    const cache = new PageCache(dir);
    cache.write(page('Cached'));
    const { client, getPages } = fakeClient();
    await new PageSource({ mode: 'refresh', cache, client }).getPages(['Cached']);
    expect(getPages).toHaveBeenCalledWith(['Cached']);
    expect(cache.read('Cached')?.revid).toBe(9);
  });

  it('offline uses fixtures, then the cache, and never fetches', async () => {
    const cache = new PageCache(dir);
    cache.write(page('Cached', 2));
    const { client, getPages } = fakeClient();
    const fixtures = new Map([['Fixture', page('Fixture', 3)]]);
    const pages = await new PageSource({ mode: 'offline', cache, client, fixtures }).getPages([
      'Fixture',
      'Cached',
      'Absent',
    ]);
    expect(getPages).not.toHaveBeenCalled();
    expect(pages.get('Fixture')?.revid).toBe(3);
    expect(pages.get('Cached')?.revid).toBe(2);
    expect(pages.get('Absent')).toBeNull();
  });
});
