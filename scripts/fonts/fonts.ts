/**
 * Self-hosts the app's fonts (plan §13.10), so the app needs no third-party request and works offline:
 * Roboto (variable, weights 400–700, only the subsets the UI and data use) and a Material Symbols
 * Outlined file cut down to the icons the app renders (see `icon-names.ts`).
 *
 *   npm run fonts             download from Google Fonts into src/theme/fonts/, write the SCSS
 *   npm run fonts -- --check  offline: fail if the app uses an icon the committed subset lacks
 *
 * Both fonts are under open licenses (Roboto: OFL 1.1, Material Symbols: Apache 2.0).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { collectIconNames } from './icon-names';

const root = process.cwd();
if (!existsSync(resolve(root, 'angular.json'))) {
  throw new Error('Run this script from the repository root (npm run fonts).');
}

const FONT_DIR = 'src/theme/fonts';
const SCSS_FILE = 'src/theme/fonts.generated.scss';
const MANIFEST_FILE = `${FONT_DIR}/fonts.json`;
const ICON_FILE = 'material-symbols-outlined.woff2';

/**
 * Roboto subsets to keep: `latin` and `latin-ext` (é, ₽), `symbols` (♀ ♂ → ⌈⌉ ⅓) and `math` (√ ≥).
 * Each face carries its `unicode-range`, so a browser only downloads the ones a page needs.
 */
const ROBOTO_SUBSETS = ['latin', 'latin-ext', 'symbols', 'math'];
const ROBOTO_CSS = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400..700&display=swap';
/** One optical size, weight and grade, no fill: all `mat-icon` uses. */
const ICON_CSS = (names: string[]) =>
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0' +
  `&icon_names=${names.join(',')}&display=block`;
/** Google Fonts picks the font format from the User-Agent; this one gets woff2. */
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

interface Manifest {
  icons: string[];
  robotoSubsets: string[];
}

function sourceFiles(dir: string): { path: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(ts|html)$/.test(e.name) && !e.name.endsWith('.spec.ts'))
    .map((e) => {
      const path = join(e.parentPath, e.name);
      return { path: relative(root, path), text: readFileSync(path, 'utf8') };
    });
}

function scanIcons(): string[] {
  const scan = collectIconNames(sourceFiles(resolve(root, 'src/app')));
  if (scan.problems.length) {
    throw new Error(
      `Icons the font subset can't be built for (use a literal name or an \`icon: '…'\` property):\n  ${scan.problems.join('\n  ')}`,
    );
  }
  return scan.names;
}

function check(): void {
  const manifestPath = resolve(root, MANIFEST_FILE);
  if (!existsSync(manifestPath))
    throw new Error(`${MANIFEST_FILE} is missing. Run \`npm run fonts\`.`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const used = scanIcons();
  const missing = used.filter((n) => !manifest.icons.includes(n));
  const unused = manifest.icons.filter((n) => !used.includes(n));
  const files = [ICON_FILE, ...manifest.robotoSubsets.map((s) => `roboto-${s}.woff2`)];
  const absent = files.filter((f) => !existsSync(resolve(root, FONT_DIR, f)));
  const errors = [
    ...(missing.length ? [`icons not in the font subset: ${missing.join(', ')}`] : []),
    ...(unused.length ? [`icons in the subset but no longer used: ${unused.join(', ')}`] : []),
    ...(absent.length ? [`missing font files: ${absent.join(', ')}`] : []),
  ];
  if (errors.length) {
    console.error(`Fonts are out of date. Run \`npm run fonts\`.\n  ${errors.join('\n  ')}`);
    process.exitCode = 1;
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

async function fetchFile(url: string, name: string): Promise<void> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(resolve(root, FONT_DIR, name), bytes);
  console.log(`wrote ${FONT_DIR}/${name} (${(bytes.length / 1024).toFixed(1)} KB)`);
}

interface Face {
  subset: string | null;
  url: string;
  unicodeRange: string | null;
}

/** The `@font-face` blocks of a Google Fonts stylesheet, each with the `/* subset *\/` comment above it. */
function parseFaces(css: string): Face[] {
  const faces: Face[] = [];
  for (const [, subset, body = ''] of css.matchAll(
    /(?:\/\* ([\w-]+) \*\/\s*)?@font-face\s*{([^}]*)}/g,
  )) {
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    if (!url) throw new Error(`@font-face without a url: ${body}`);
    faces.push({
      subset: subset ?? null,
      url,
      unicodeRange: /unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? null,
    });
  }
  return faces;
}

async function download(): Promise<void> {
  const icons = scanIcons();
  mkdirSync(resolve(root, FONT_DIR), { recursive: true });

  const roboto = parseFaces(await fetchText(ROBOTO_CSS));
  const kept = ROBOTO_SUBSETS.map((subset) => {
    const face = roboto.find((f) => f.subset === subset);
    if (!face?.unicodeRange) throw new Error(`Roboto has no "${subset}" subset any more.`);
    return { ...face, subset, file: `roboto-${subset}.woff2` };
  });
  for (const face of kept) await fetchFile(face.url, face.file);

  const [iconFace, ...extra] = parseFaces(await fetchText(ICON_CSS(icons)));
  if (!iconFace || extra.length) throw new Error('Expected exactly one Material Symbols face.');
  await fetchFile(iconFace.url, ICON_FILE);

  const robotoRules = kept.map(
    (face) => `/* ${face.subset} */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400 700;
  font-stretch: 100%;
  font-display: swap;
  src: url('./fonts/${face.file}') format('woff2');
  unicode-range: ${face.unicodeRange};
}
`,
  );
  const scss = `// GENERATED by scripts/fonts/fonts.ts. Do not edit; run \`npm run fonts\`.
// Roboto (OFL 1.1) and Material Symbols Outlined (Apache 2.0), self-hosted from Google Fonts.

${robotoRules.join('\n')}
/* Material Symbols Outlined: only the ${icons.length} icons the app uses */
@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('./fonts/${ICON_FILE}') format('woff2');
}

// \`MAT_ICON_DEFAULT_OPTIONS.fontSet\` puts this class on every <mat-icon>.
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
`;
  writeFileSync(resolve(root, SCSS_FILE), scss);
  console.log(`wrote ${SCSS_FILE}`);
  const manifest: Manifest = { icons, robotoSubsets: ROBOTO_SUBSETS };
  writeFileSync(resolve(root, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${MANIFEST_FILE} (${icons.length} icons)`);
}

if (process.argv.includes('--check')) {
  check();
} else {
  download().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
