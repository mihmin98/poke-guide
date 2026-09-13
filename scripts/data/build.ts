/**
 * Builds a version group's data files (plan §7.2): `public/data/<group>.json` and `<group>.pokedex.json`.
 *
 *   npm run data:build      uses the cache, fetches only what's missing
 *   npm run data:refresh    refetches every page
 *   npm run data:offline    fixtures and cache only, never touches the network
 *
 * Options: `--group <id>` or `--all`, `--refresh`, `--offline`, `--dry-run` (report only).
 * Nothing is written when there are errors; the exit code is then 1.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { getVersionGroup } from '../../src/app/core/games/registry';
import {
  assembleVersionGroup,
  listPageTitles,
  speciesForConfig,
  speciesPageTitles,
  type BuildIssue,
} from './core/assemble';
import { PageCache, PageSource, loadFixtures, type CachedPage, type FetchMode } from './core/cache';
import { MediaWikiClient } from './core/mediawiki-client';
import { fixturesDir, rawCacheDir, repoRoot } from './core/paths';
import { NATIONAL_DEX_LIST_PAGE } from './core/species-list';
import { VERSION_GROUP_CONFIGS } from './version-groups';
import type { VersionGroupConfig } from './version-groups/types';

function printIssues(issues: readonly BuildIssue[]): void {
  for (const level of ['note', 'warning', 'error'] as const) {
    const selected = issues.filter((i) => i.level === level);
    if (selected.length === 0) continue;
    console.log(`\n${level.toUpperCase()}S (${selected.length})`);
    for (const found of selected)
      console.log(`  ${found.page ? `[${found.page}] ` : ''}${found.message}`);
  }
}

/** Offline builds use the committed category snapshot (`__fixtures__/category-members.json`) when there is one. */
function categorySnapshot(config: VersionGroupConfig): string[] | null {
  const file = join(fixturesDir(config.id), 'category-members.json');
  if (!existsSync(file)) return null;
  return (JSON.parse(readFileSync(file, 'utf8')) as { members: string[] }).members;
}

async function buildGroup(
  config: VersionGroupConfig,
  mode: FetchMode,
  dryRun: boolean,
): Promise<boolean> {
  console.log(`\n== ${config.id} (${mode}) ==`);
  const client = mode === 'offline' ? undefined : new MediaWikiClient({ log: console.warn });
  const source = new PageSource({
    mode,
    cache: new PageCache(rawCacheDir()),
    client,
    fixtures: mode === 'offline' ? loadFixtures(fixturesDir(config.id)) : undefined,
    log: console.log,
  });

  const pages = new Map<string, CachedPage | null>(await source.getPages(listPageTitles(config)));
  const list = pages.get(NATIONAL_DEX_LIST_PAGE);
  if (!list) throw new Error(`"${NATIONAL_DEX_LIST_PAGE}" is not available`);
  for (const [title, page] of await source.getPages(
    speciesPageTitles(config, speciesForConfig(list, config)),
  )) {
    pages.set(title, page);
  }

  let categoryMembers: string[] | null = null;
  if (client) {
    try {
      categoryMembers = await client.getCategoryMembers(config.locationCategory);
    } catch (error) {
      console.warn(`Could not fetch ${config.locationCategory}: ${String(error)}`);
    }
  } else {
    categoryMembers = categorySnapshot(config);
  }
  if (client) console.log(`${client.requestCount} request(s) to Bulbapedia`);

  const { data, pokedex, issues } = assembleVersionGroup(
    config,
    (title) => pages.get(title) ?? null,
    {
      builtAt: new Date().toISOString(),
      categoryMembers,
    },
  );
  printIssues(issues);

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const encounters = data.locations.flatMap((l) => l.subAreas.flatMap((a) => a.encounters)).length;
  console.log(
    `\n${data.species.length} species, ${data.locations.length} locations, ${encounters} encounters, ` +
      `${pokedex.moves.length} moves · ${errors} error(s), ${warnings} warning(s)`,
  );
  if (errors > 0) {
    console.error(`Not writing ${config.id} data: fix the errors first.`);
    return false;
  }
  if (dryRun) return true;

  const dataFile = join(repoRoot(), 'public', getVersionGroup(config.id).dataFile);
  const pokedexFile = dataFile.replace(/\.json$/, '.pokedex.json');
  mkdirSync(dirname(dataFile), { recursive: true });
  for (const [file, content] of [
    [dataFile, data],
    [pokedexFile, pokedex],
  ] as const) {
    // Compact: pretty-printed rby.json is about 790 KB against 245 KB (both about 20–30 KB gzipped).
    const json = JSON.stringify(content) + '\n';
    writeFileSync(file, json);
    console.log(
      `Wrote ${relative(repoRoot(), file)} (${Math.round(Buffer.byteLength(json) / 1024)} KB)`,
    );
  }
  return true;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      group: { type: 'string' },
      all: { type: 'boolean', default: false },
      refresh: { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (values.refresh && values.offline)
    throw new Error('--refresh and --offline exclude each other');
  const known = Object.keys(VERSION_GROUP_CONFIGS).join(', ');
  const configs = values.all
    ? Object.values(VERSION_GROUP_CONFIGS)
    : [VERSION_GROUP_CONFIGS[values.group as keyof typeof VERSION_GROUP_CONFIGS]];
  if (configs.length === 0 || configs.some((c) => !c)) {
    throw new Error(`Pass --all or --group <id>. Known groups: ${known}`);
  }
  const mode: FetchMode = values.offline ? 'offline' : values.refresh ? 'refresh' : 'cache-first';
  let ok = true;
  for (const config of configs as VersionGroupConfig[]) {
    ok = (await buildGroup(config, mode, values['dry-run'])) && ok;
  }
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
