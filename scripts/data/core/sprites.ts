/**
 * Sprite sets (plan §7.10): resolves Bulbagarden Archives files per sprite set and syncs them to
 * `public/sprites/<setId>/<dex3>.png`. A local file whose SHA-1 matches the archive is left alone, so
 * reruns only download what changed; every download is checked against the archive's SHA-1.
 *
 * Sets marked `stillFrame` (Crystal's animated PNGs) keep only the PNG's default image. The stored file then no
 * longer matches the archive, so the archive SHA-1 of each converted file is kept in a committed manifest
 * (`scripts/data/sprite-sources/<setId>.json`) and compared instead.
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
  /** Keep only the first frame of an animated PNG. */
  stillFrame?: true;
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
  if (!filePattern.includes('{dex3}'))
    throw new Error(`Sprite pattern "${filePattern}" has no {dex3}`);
  return `File:${filePattern.replaceAll('{dex3}', dex3(dex))}`;
}

/** One job per species per sprite set used by the version group's games. Throws on an unconfigured set. */
export function spriteJobs(config: VersionGroupConfig): SpriteJob[] {
  const setIds = [...new Set(config.games.map((game) => getGame(game).spriteSetId))];
  const jobs: SpriteJob[] = [];
  for (const setId of setIds) {
    const set = config.spriteSets[setId];
    if (!set)
      throw new Error(`Version group ${config.id}: sprite set "${setId}" has no filePattern`);
    const [first, last] = config.speciesRange;
    for (let dex = first; dex <= last; dex++) {
      jobs.push({
        setId,
        dex,
        fileTitle: spriteFileTitle(set.filePattern, dex),
        path: `${setId}/${dex3(dex)}.png`,
        ...(set.stillFrame ? { stillFrame: true as const } : {}),
      });
    }
  }
  return jobs;
}

const sha1 = (bytes: Uint8Array) => createHash('sha1').update(bytes).digest('hex');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** APNG animation chunks; without them an APNG is a plain PNG of its default image (the first frame). */
const ANIMATION_CHUNKS = new Set(['acTL', 'fcTL', 'fdAT']);

/** Drops the animation chunks of an APNG. A plain PNG comes back unchanged; anything else throws. */
export function pngStillFrame(bytes: Uint8Array): Uint8Array {
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error('Not a PNG file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let sawImage = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk');
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error(`Truncated PNG chunk ${type}`);
    if (type === 'IDAT') sawImage = true;
    if (!ANIMATION_CHUNKS.has(type)) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  if (!sawImage) throw new Error('PNG has no IDAT image data');
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Archive SHA-1 per converted file (`001.png` → sha1), for `stillFrame` sets. */
type SourceManifest = Record<string, string>;

function readManifest(file: string): SourceManifest {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as SourceManifest) : {};
}

export async function syncSprites(
  jobs: readonly SpriteJob[],
  source: SpriteSource,
  spritesDir: string,
  log: (message: string) => void = () => undefined,
  /** Where `stillFrame` manifests live (`scripts/data/sprite-sources`). */
  manifestDir?: string,
): Promise<SpriteSyncResult> {
  const result: SpriteSyncResult = { downloaded: [], unchanged: [], missing: [], corrupt: [] };
  const manifests = new Map<string, SourceManifest>();
  const manifestFile = (setId: string) => {
    if (!manifestDir) throw new Error('Sprite set with stillFrame needs a manifest directory');
    return join(manifestDir, `${setId}.json`);
  };
  const manifestOf = (setId: string) => {
    let manifest = manifests.get(setId);
    if (!manifest) {
      manifest = readManifest(manifestFile(setId));
      manifests.set(setId, manifest);
    }
    return manifest;
  };

  const infos = await source.getImageInfo(jobs.map((job) => job.fileTitle));
  for (const job of jobs) {
    const info = infos.get(job.fileTitle);
    if (!info) {
      result.missing.push(job);
      continue;
    }
    const archiveSha1 = info.sha1.toLowerCase();
    const file = join(spritesDir, job.path);
    const name = job.path.slice(job.setId.length + 1);
    const current = job.stillFrame
      ? existsSync(file) && manifestOf(job.setId)[name] === archiveSha1
      : existsSync(file) && sha1(readFileSync(file)) === archiveSha1;
    if (current) {
      result.unchanged.push(job);
      continue;
    }
    const bytes = await source.download(info.url);
    if (sha1(bytes) !== archiveSha1) {
      result.corrupt.push(job);
      continue;
    }
    mkdirSync(join(spritesDir, job.setId), { recursive: true });
    writeFileSync(file, job.stillFrame ? pngStillFrame(bytes) : bytes);
    if (job.stillFrame) manifestOf(job.setId)[name] = archiveSha1;
    result.downloaded.push(job);
    log(`  ${job.path} ← ${job.fileTitle}`);
  }
  for (const [setId, manifest] of manifests) {
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    mkdirSync(manifestDir!, { recursive: true });
    writeFileSync(manifestFile(setId), `${JSON.stringify(sorted, null, 2)}\n`);
  }
  return result;
}
