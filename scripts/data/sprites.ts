/**
 * Downloads a version group's sprite sets (plan §7.10) to `public/sprites/<setId>/<dex3>.png`.
 *
 *   npm run data:sprites    only downloads files that are missing or differ from Bulbagarden Archives
 *
 * Options: `--group <id>` or `--all`. Exit code 1 when a file is missing on the archive or fails its SHA-1 check.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ARCHIVES_API, MediaWikiClient } from './core/mediawiki-client';
import { repoRoot } from './core/paths';
import { spriteJobs, syncSprites } from './core/sprites';
import { VERSION_GROUP_CONFIGS } from './version-groups';
import type { VersionGroupConfig } from './version-groups/types';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { group: { type: 'string' }, all: { type: 'boolean', default: false } },
  });
  const configs: VersionGroupConfig[] = values.all
    ? Object.values(VERSION_GROUP_CONFIGS)
    : [VERSION_GROUP_CONFIGS[values.group as keyof typeof VERSION_GROUP_CONFIGS]].filter(
        (c): c is VersionGroupConfig => c !== undefined,
      );
  if (configs.length === 0) throw new Error('Pass --group <id> (with a pipeline config) or --all');

  const client = new MediaWikiClient({ endpoint: ARCHIVES_API, log: console.warn });
  const spritesDir = join(repoRoot(), 'public', 'sprites');
  let ok = true;
  for (const config of configs) {
    const jobs = spriteJobs(config);
    console.log(`\n== ${config.id}: ${jobs.length} sprites ==`);
    const result = await syncSprites(jobs, client, spritesDir, console.log);
    console.log(
      `downloaded ${result.downloaded.length}, unchanged ${result.unchanged.length}, ` +
        `missing ${result.missing.length}, failed SHA-1 ${result.corrupt.length}`,
    );
    for (const job of result.missing) console.log(`  MISSING ${job.fileTitle} (${job.path})`);
    for (const job of result.corrupt) console.log(`  SHA-1 MISMATCH ${job.fileTitle} (${job.path})`);
    if (result.missing.length > 0 || result.corrupt.length > 0) ok = false;
  }
  console.log(`\n${client.requestCount} requests`);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
