/**
 * Validates the committed data files (plan §17, run by CI): `public/data/<group>.json` and
 * `<group>.pokedex.json` pass the build's checks, and their item numbers match `item-numbers.json`.
 * Never touches the network or writes anything.
 *
 *   npm run data:validate
 *
 * Options: `--group <id>` (default: every version group). The exit code is 1 when there are errors.
 */
import { parseArgs } from 'node:util';
import { printIssues } from './core/assemble';
import { checkCommittedGroup, loadCommittedGroup } from './core/committed-data';
import { VERSION_GROUP_CONFIGS } from './version-groups';
import type { VersionGroupConfig } from './version-groups/types';

function main(): void {
  const { values } = parseArgs({ options: { group: { type: 'string' } } });
  const known = Object.keys(VERSION_GROUP_CONFIGS).join(', ');
  const configs =
    values.group === undefined
      ? Object.values(VERSION_GROUP_CONFIGS)
      : [VERSION_GROUP_CONFIGS[values.group as keyof typeof VERSION_GROUP_CONFIGS]];
  if (configs.length === 0 || configs.some((c) => !c)) {
    throw new Error(`Unknown --group "${values.group ?? ''}". Known groups: ${known}`);
  }
  let ok = true;
  for (const config of configs as VersionGroupConfig[]) {
    const issues = checkCommittedGroup(loadCommittedGroup(config.id));
    const errors = issues.filter((i) => i.level === 'error').length;
    console.log(`\n== ${config.id} ==`);
    printIssues(issues.filter((i) => i.level === 'error'));
    console.log(errors === 0 ? 'OK' : `${errors} error(s)`);
    if (errors > 0) ok = false;
  }
  if (!ok) process.exitCode = 1;
}

try {
  main();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
