/**
 * Sprite sets (plan §7.10): resolves Bulbagarden Archives files per sprite set and syncs them to
 * `public/sprites/<setId>/<dex3>.png`. A local file whose SHA-1 matches the archive is left alone, so
 * reruns only download what changed; every download is checked against the archive's SHA-1.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getGame } from '../../../src/app/core/games/registry';
import type { VersionGroupConfig } from '../version-groups/types';
import type { ImageInfo } from './mediawiki-client';

export interface SpriteJob {
  setId: string;
  dex: number;
  /** `File:Spr_1b_001.png` */
  fileTitle: string;
  /** Path relative to the sprites directory: `gen1-rb/001.png`. */
  path: string;
}

export interface SpriteSource {
  getImageInfo(fileTitles: readonly string[]): Promise<Map<string, ImageInfo | null>>;
  download(url: string): Promise<Uint8Array>;
}

export interface SpriteSyncResult {
  downloaded: SpriteJob[];
  unchanged: SpriteJob[];
  /** File not on the archive. */
  missing: SpriteJob[];
  /** Download didn't match the archive's SHA-1; nothing was written. */
  corrupt: SpriteJob[];
}

const dex3 = (dex: number) => String(dex).padStart(3, '0');

export function spriteFileTitle(filePattern: string, dex: number): string {
  if (!filePattern.includes('{dex3}')) throw new Error(`Sprite pattern "${filePattern}" has no {dex3}`);
  return `File:${filePattern.replaceAll('{dex3}', dex3(dex))}`;
}

/** One job per species per sprite set used by the version group's games. Throws on an unconfigured set. */
export function spriteJobs(config: VersionGroupConfig): SpriteJob[] {
  const setIds = [...new Set(config.games.map((game) => getGame(game).spriteSetId))];
  const jobs: SpriteJob[] = [];
  for (const setId of setIds) {
    const set = config.spriteSets[setId];
    if (!set) throw new Error(`Version group ${config.id}: sprite set "${setId}" has no filePattern`);
    const [first, last] = config.speciesRange;
    for (let dex = first; dex <= last; dex++) {
      jobs.push({ setId, dex, fileTitle: spriteFileTitle(set.filePattern, dex), path: `${setId}/${dex3(dex)}.png` });
    }
  }
  return jobs;
}

const sha1 = (bytes: Uint8Array) => createHash('sha1').update(bytes).digest('hex');

export async function syncSprites(
  jobs: readonly SpriteJob[],
  source: SpriteSource,
  spritesDir: string,
  log: (message: string) => void = () => undefined,
): Promise<SpriteSyncResult> {
  const result: SpriteSyncResult = { downloaded: [], unchanged: [], missing: [], corrupt: [] };
  const infos = await source.getImageInfo(jobs.map((job) => job.fileTitle));
  for (const job of jobs) {
    const info = infos.get(job.fileTitle);
    if (!info) {
      result.missing.push(job);
      continue;
    }
    const file = join(spritesDir, job.path);
    if (existsSync(file) && sha1(readFileSync(file)) === info.sha1.toLowerCase()) {
      result.unchanged.push(job);
      continue;
    }
    const bytes = await source.download(info.url);
    if (sha1(bytes) !== info.sha1.toLowerCase()) {
      result.corrupt.push(job);
      continue;
    }
    mkdirSync(join(spritesDir, job.setId), { recursive: true });
    writeFileSync(file, bytes);
    result.downloaded.push(job);
    log(`  ${job.path} ← ${job.fileTitle}`);
  }
  return result;
}
