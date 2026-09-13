import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The repository root: the nearest directory at or above the working directory holding `angular.json`. */
export function repoRoot(start = process.cwd()): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'angular.json'))) return dir;
    if (dirname(dir) === dir) throw new Error(`No angular.json found above ${start}`);
  }
}

export const dataScriptsDir = () => join(repoRoot(), 'scripts', 'data');
export const rawCacheDir = () => join(dataScriptsDir(), 'cache', 'raw');
export const versionGroupDir = (id: string) => join(dataScriptsDir(), 'version-groups', id);
export const fixturesDir = (id: string) => join(versionGroupDir(id), '__fixtures__');
