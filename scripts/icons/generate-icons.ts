/**
 * Draws the app icon (a Poké Ball) at every size the manifest and browsers ask for (plan §13.10), with
 * no image tooling: each shape is a signed distance, anti-aliased by pixel coverage, and the PNGs are
 * encoded with Node's zlib. The output is deterministic and committed.
 *
 *   npm run icons   write public/icons/*.png, public/favicon.ico and public/favicon.svg
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const root = process.cwd();
if (!existsSync(resolve(root, 'angular.json'))) {
  throw new Error('Run this script from the repository root (npm run icons).');
}

type Rgb = readonly [number, number, number];
const INK: Rgb = [0x1f, 0x1f, 0x1f];
const RED: Rgb = [0xe3, 0x35, 0x0d];
const WHITE: Rgb = [0xfa, 0xfa, 0xfa];
/** The neutral shell color (`--mat-sys-surface-container`, light), also the manifest `theme_color`. */
const BACKGROUND: Rgb = [0xf9, 0xeb, 0xe9];

/** Signed distance to a shape in ball units (radius 1, y down); negative inside. */
type Shape = (x: number, y: number) => number;
const disc =
  (r: number): Shape =>
  (x, y) =>
    Math.hypot(x, y) - r;
const band =
  (halfHeight: number): Shape =>
  (_x, y) =>
    Math.abs(y) - halfHeight;
const topHalf: Shape = (_x, y) => y;
const both =
  (a: Shape, b: Shape): Shape =>
  (x, y) =>
    Math.max(a(x, y), b(x, y));

/** Painted in order, each over the previous ones. */
const LAYERS: [Shape, Rgb][] = [
  [disc(1), INK],
  [disc(0.9), WHITE],
  [both(disc(0.9), topHalf), RED],
  [both(disc(1), band(0.09)), INK],
  [disc(0.34), INK],
  [disc(0.23), WHITE],
];

interface Layout {
  size: number;
  /** Ball radius as a fraction of the canvas size. */
  radius: number;
  background: Rgb | null;
}

function render({ size, radius, background }: Layout): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const unitsPerPixel = 1 / (radius * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - size / 2) * unitsPerPixel;
      const y = (py + 0.5 - size / 2) * unitsPerPixel;
      let [r, g, b] = background ?? [0, 0, 0];
      let alpha = background ? 1 : 0;
      for (const [shape, color] of LAYERS) {
        const coverage = Math.min(1, Math.max(0, 0.5 - shape(x, y) / unitsPerPixel));
        if (coverage === 0) continue;
        // "Over" compositing, in straight (non-premultiplied) alpha.
        const out = coverage + alpha * (1 - coverage);
        const mix = (c: number, under: number) =>
          (c * coverage + under * alpha * (1 - coverage)) / out;
        [r, g, b] = [mix(color[0], r), mix(color[1], g), mix(color[2], b)];
        alpha = out;
      }
      pixels.set(
        [Math.round(r), Math.round(g), Math.round(b), Math.round(alpha * 255)],
        (py * size + px) * 4,
      );
    }
  }
  return encodePng(size, pixels);
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An 8-bit RGBA PNG with no row filtering. */
function encodePng(size: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // bit depth, RGBA, deflate, adaptive filtering, no interlace
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** An ICO file holding PNG images (supported by every current browser). */
function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0);
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const hex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** The same drawing as an SVG favicon, for crisp tabs at any density. */
function svg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2">
  <circle r="1" fill="${hex(INK)}"/>
  <circle r="0.9" fill="${hex(WHITE)}"/>
  <path d="M-0.9 0A0.9 0.9 0 0 1 0.9 0Z" fill="${hex(RED)}"/>
  <rect x="-0.99" y="-0.09" width="1.98" height="0.18" fill="${hex(INK)}"/>
  <circle r="0.34" fill="${hex(INK)}"/>
  <circle r="0.23" fill="${hex(WHITE)}"/>
</svg>
`;
}

function write(path: string, content: Buffer | string): void {
  writeFileSync(resolve(root, path), content);
  console.log(`wrote ${path}`);
}

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
// "any" icons: transparent, the ball filling most of the canvas.
for (const size of [192, 512]) {
  write(`public/icons/icon-${size}.png`, render({ size, radius: 0.46, background: null }));
}
// Maskable icons keep the ball inside the 40%-radius safe zone that every mask shape preserves.
for (const size of [192, 512]) {
  write(
    `public/icons/maskable-${size}.png`,
    render({ size, radius: 0.34, background: BACKGROUND }),
  );
}
// iOS fills transparency with black, so the touch icon gets the background too.
write(
  'public/icons/apple-touch-icon.png',
  render({ size: 180, radius: 0.4, background: BACKGROUND }),
);
write(
  'public/favicon.ico',
  encodeIco(
    [16, 32, 48].map((size) => ({
      size,
      png: render({ size, radius: 0.48, background: null }),
    })),
  ),
);
write('public/favicon.svg', svg());
