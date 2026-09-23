import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rbyConfig } from '../version-groups/rby/config';
import type { ImageInfo } from './mediawiki-client';
import {
  pngStillFrame,
  spriteFileTitle,
  spriteJobs,
  syncSprites,
  type SpriteSource,
} from './sprites';

const sha1 = (bytes: Uint8Array) => createHash('sha1').update(bytes).digest('hex');
const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('spriteFileTitle', () => {
  it('pads the dex number', () => {
    expect(spriteFileTitle('Spr_1b_{dex3}.png', 7)).toBe('File:Spr_1b_007.png');
    expect(spriteFileTitle('Spr_1y_{dex3}.png', 151)).toBe('File:Spr_1y_151.png');
  });

  it('rejects a pattern without {dex3}', () => {
    expect(() => spriteFileTitle('Spr_1b.png', 1)).toThrow(/no \{dex3\}/);
  });
});

describe('spriteJobs', () => {
  it('covers each sprite set of the rby games once, over the species range', () => {
    const jobs = spriteJobs(rbyConfig);
    expect(jobs).toHaveLength(302);
    expect(jobs[0]).toEqual({
      setId: 'gen1-rb',
      dex: 1,
      fileTitle: 'File:Spr_1b_001.png',
      path: 'gen1-rb/001.png',
    });
    expect(jobs.at(-1)).toEqual({
      setId: 'gen1-y',
      dex: 151,
      fileTitle: 'File:Spr_1y_151.png',
      path: 'gen1-y/151.png',
    });
  });

  it('throws when a game uses an unconfigured sprite set', () => {
    expect(() =>
      spriteJobs({ ...rbyConfig, spriteSets: { 'gen1-rb': { filePattern: 'Spr_1b_{dex3}.png' } } }),
    ).toThrow(/"gen1-y" has no filePattern/);
  });
});

describe('syncSprites', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sprites-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const job = (dex: number) => ({
    setId: 'gen1-rb',
    dex,
    fileTitle: `File:Spr_1b_00${dex}.png`,
    path: `gen1-rb/00${dex}.png`,
  });

  function source(files: Record<string, { content: string; sha1?: string } | null>) {
    const downloads: string[] = [];
    const fake: SpriteSource = {
      getImageInfo: async (titles) =>
        new Map<string, ImageInfo | null>(
          titles.map((title) => {
            const file = files[title];
            return [
              title,
              file
                ? { url: `https://x/${title}`, sha1: file.sha1 ?? sha1(bytesOf(file.content)) }
                : null,
            ];
          }),
        ),
      download: async (url) => {
        downloads.push(url);
        return bytesOf(files[url.slice('https://x/'.length)]!.content);
      },
    };
    return { fake, downloads };
  }

  it('downloads new files, skips matching ones, and reports missing and corrupt files', async () => {
    mkdirSync(join(dir, 'gen1-rb'));
    writeFileSync(join(dir, 'gen1-rb/002.png'), 'same');
    writeFileSync(join(dir, 'gen1-rb/003.png'), 'stale');
    const { fake, downloads } = source({
      'File:Spr_1b_001.png': { content: 'new' },
      'File:Spr_1b_002.png': { content: 'same' },
      'File:Spr_1b_003.png': { content: 'updated' },
      'File:Spr_1b_004.png': null,
      'File:Spr_1b_005.png': { content: 'truncated', sha1: 'ABCDEF' },
    });

    const result = await syncSprites([1, 2, 3, 4, 5].map(job), fake, dir);

    expect(result.downloaded.map((j) => j.dex)).toEqual([1, 3]);
    expect(result.unchanged.map((j) => j.dex)).toEqual([2]);
    expect(result.missing.map((j) => j.dex)).toEqual([4]);
    expect(result.corrupt.map((j) => j.dex)).toEqual([5]);
    expect(downloads).toEqual([
      'https://x/File:Spr_1b_001.png',
      'https://x/File:Spr_1b_003.png',
      'https://x/File:Spr_1b_005.png',
    ]);
    expect(readFileSync(join(dir, 'gen1-rb/001.png'), 'utf8')).toBe('new');
    expect(readFileSync(join(dir, 'gen1-rb/003.png'), 'utf8')).toBe('updated');
    expect(existsSync(join(dir, 'gen1-rb/005.png'))).toBe(false);
  });
});

/** A PNG chunk (the CRC isn't checked by `pngStillFrame`, so it's left zero). */
function chunk(type: string, data: number[] = []): number[] {
  const length = [24, 16, 8, 0].map((shift) => (data.length >>> shift) & 0xff);
  return [...length, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
}
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('pngStillFrame', () => {
  it('drops the animation chunks of an APNG and keeps the default image', () => {
    const apng = new Uint8Array([
      ...SIGNATURE,
      ...chunk('IHDR', [1, 2, 3]),
      ...chunk('acTL', [0, 0, 0, 2]),
      ...chunk('fcTL', [9]),
      ...chunk('IDAT', [7, 7]),
      ...chunk('fcTL', [9]),
      ...chunk('fdAT', [8, 8]),
      ...chunk('IEND'),
    ]);
    const still = [...SIGNATURE, ...chunk('IHDR', [1, 2, 3]), ...chunk('IDAT', [7, 7]), ...chunk('IEND')];
    expect([...pngStillFrame(apng)]).toEqual(still);
    // A plain PNG is unchanged.
    expect([...pngStillFrame(new Uint8Array(still))]).toEqual(still);
  });

  it('rejects files that are not PNGs or have no image data', () => {
    expect(() => pngStillFrame(bytesOf('GIF89a'))).toThrow(/Not a PNG/);
    expect(() => pngStillFrame(new Uint8Array([...SIGNATURE, ...chunk('IEND')]))).toThrow(/IDAT/);
  });
});

describe('syncSprites with still frames', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sprites-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('stores the still frame and skips it next time through the manifest', async () => {
    const apng = new Uint8Array([
      ...SIGNATURE,
      ...chunk('IHDR'),
      ...chunk('acTL'),
      ...chunk('IDAT', [1]),
      ...chunk('IEND'),
    ]);
    const downloads: string[] = [];
    const fake: SpriteSource = {
      getImageInfo: async (titles) =>
        new Map(titles.map((t) => [t, { url: `https://x/${t}`, sha1: sha1(apng) }])),
      download: async (url) => {
        downloads.push(url);
        return apng;
      },
    };
    const jobs = [
      {
        setId: 'gen2-c',
        dex: 1,
        fileTitle: 'File:Spr_2c_001.png',
        path: 'gen2-c/001.png',
        stillFrame: true as const,
      },
    ];
    const manifests = join(dir, 'sources');

    const first = await syncSprites(jobs, fake, dir, undefined, manifests);
    expect(first.downloaded).toHaveLength(1);
    expect([...readFileSync(join(dir, 'gen2-c/001.png'))]).toEqual([...pngStillFrame(apng)]);
    expect(JSON.parse(readFileSync(join(manifests, 'gen2-c.json'), 'utf8'))).toEqual({
      '001.png': sha1(apng),
    });

    const second = await syncSprites(jobs, fake, dir, undefined, manifests);
    expect(second.unchanged).toHaveLength(1);
    expect(downloads).toHaveLength(1);
  });
});
