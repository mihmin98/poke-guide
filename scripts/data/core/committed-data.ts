/**
 * Checks the committed outputs of a version group without touching the network (`npm run data:validate`,
 * plan §17): the data files pass the build's validation, and their item numbers agree with the committed
 * registry (plan §7.13), entry for entry.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PokedexData, VersionGroupData } from '../../../src/app/core/domain/models';
import { getVersionGroup } from '../../../src/app/core/games/registry';
import type { VersionGroupId } from '../../../src/app/core/games/types';
import type { BuildIssue } from './assemble';
import { parseItemNumbers, type ItemNumberRegistry } from './item-numbers';
import { repoRoot, versionGroupDir } from './paths';
import { validateVersionGroup } from './validate';

export interface CommittedGroup {
  data: VersionGroupData;
  pokedex: PokedexData;
  registry: ItemNumberRegistry;
}

const itemKey = (locationId: string, subArea: string | null, itemId: string) =>
  `${itemId} in ${locationId}${subArea ? ` (${subArea})` : ''}`;

export function checkCommittedGroup({ data, pokedex, registry }: CommittedGroup): BuildIssue[] {
  const issues = [...validateVersionGroup(data, pokedex).issues];
  const error = (message: string) => issues.push({ level: 'error', message });

  if (registry.versionGroupId !== data.versionGroupId)
    error(
      `Item registry is for "${registry.versionGroupId}", data file for "${data.versionGroupId}"`,
    );
  const registered = new Map(registry.items.map((e) => [e.no, e]));
  const seen = new Set<number>();
  for (const location of data.locations) {
    for (const item of location.items) {
      seen.add(item.no);
      const key = itemKey(location.id, item.subArea, item.itemId);
      const entry = registered.get(item.no);
      if (!entry) error(`Item #${item.no} (${key}) is not in the item registry`);
      else if (itemKey(entry.locationId, entry.subArea, entry.itemId) !== key)
        error(
          `Item #${item.no} is ${key} in the data but ` +
            `${itemKey(entry.locationId, entry.subArea, entry.itemId)} in the item registry`,
        );
      if (item.no >= registry.next)
        error(`Item #${item.no} is not below the registry's next number (${registry.next})`);
    }
  }
  for (const entry of registry.items) {
    if (!seen.has(entry.no))
      error(
        `Registry item #${entry.no} (${itemKey(entry.locationId, entry.subArea, entry.itemId)}) ` +
          'is missing from the data',
      );
  }
  return issues;
}

/** Reads a version group's committed data files and item registry. */
export function loadCommittedGroup(id: VersionGroupId): CommittedGroup {
  const dataFile = join(repoRoot(), 'public', getVersionGroup(id).dataFile);
  const pokedexFile = dataFile.replace(/\.json$/, '.pokedex.json');
  const registryFile = join(versionGroupDir(id), 'item-numbers.json');
  for (const file of [dataFile, pokedexFile, registryFile])
    if (!existsSync(file)) throw new Error(`${file} is missing`);
  return {
    data: JSON.parse(readFileSync(dataFile, 'utf8')) as VersionGroupData,
    pokedex: JSON.parse(readFileSync(pokedexFile, 'utf8')) as PokedexData,
    registry: parseItemNumbers(readFileSync(registryFile, 'utf8')),
  };
}
