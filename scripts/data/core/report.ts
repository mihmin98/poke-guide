/**
 * Per-group markdown report (plan §7.8): obtainable counts per game, unobtainable species with reasons, encounters
 * added or removed per location since the previous build, and the build's warnings and notes. Deterministic (no
 * timestamps), so the committed report only changes when the data does.
 */
import { buildGameView } from '../../../src/app/core/domain/game-view';
import { buildJourney, type JourneyPart } from '../../../src/app/core/domain/journey';
import type { GameId, VersionGroupData } from '../../../src/app/core/domain/models';
import { findGame } from '../../../src/app/core/games/registry';
import type { BuildIssue } from './assemble';
import type { GameChecklist } from './validate';

export interface ReportInput {
  data: VersionGroupData;
  /** The data file before this build, or `null` for the first build. */
  previous: VersionGroupData | null;
  issues: readonly BuildIssue[];
  checklists: readonly GameChecklist[];
}

function encounterKeys(data: VersionGroupData): Map<string, Set<string>> {
  const names = new Map(data.species.map((s) => [s.dex, s.name]));
  const keys = new Map<string, Set<string>>();
  for (const location of data.locations) {
    const set = new Set<string>();
    for (const area of location.subAreas) {
      for (const e of area.encounters) {
        const trade = e.trade ? ` for #${e.trade.giveDex}` : '';
        set.add(
          `${area.id} · ${e.method} · #${e.dex} ${names.get(e.dex) ?? '?'}${trade} · ${Object.keys(e.games).join('/')}`,
        );
      }
    }
    keys.set(location.id, set);
  }
  return keys;
}

const gameName = (id: string) => findGame(id)?.name ?? id;

/** One line per part: areas, **milestones** (with the area they go back to) and {what an unlock opens}. */
function journeyLines(
  data: VersionGroupData,
  game: GameId,
  journey: readonly JourneyPart[],
): string[] {
  const unlocks = new Map((data.unlocks[game] ?? []).map((u) => [u.id, u.label]));
  return journey.map((part) => {
    const steps = part.steps.map((step) => {
      if (step.kind === 'area') return step.location.name;
      if (step.kind === 'milestone') {
        const back = step.revisit
          ? ` (back to ${data.locations.find((l) => l.id === step.milestone.locationId)?.name})`
          : '';
        return `**${step.milestone.label}**${back}`;
      }
      const what = step.unlocks.map((id) => unlocks.get(id) ?? id).join(', ') || 'Later items';
      return `{${what} opens: ${step.areas.map((a) => a.location.name).join(', ')}}`;
    });
    return `- Part ${part.part}: ${steps.join(' → ')}`;
  });
}

export function renderReport({ data, previous, issues, checklists }: ReportInput): string {
  const lines: string[] = [`# ${data.versionGroupId} data report`, ''];
  const names = new Map(data.species.map((s) => [s.dex, s.name]));
  const encounters = data.locations.flatMap((l) => l.subAreas.flatMap((a) => a.encounters)).length;
  lines.push(
    `${data.species.length} species, ${data.locations.length} locations, ${encounters} encounters, ` +
      `${data.locations.flatMap((l) => l.items).length} items, ${data.sources.length} source pages.`,
    '',
    '## Obtainable per game',
    '',
    '| Game | Obtainable | Max in one save | Other version | Trade evolution | Event-only | Other game | Not in game |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const { game, entries, maxInOneSave } of checklists) {
    const reason = (r: string) => entries.filter((e) => e.unobtainableReason === r).length;
    lines.push(
      `| ${gameName(game)} | ${entries.filter((e) => e.obtainable).length} / ${entries.length} | ${maxInOneSave} | ` +
        `${reason('other-version')} | ${reason('trade-evolution')} | ${reason('event-only')} | ${reason('requires-other-game')} | ` +
        `${reason('not-in-game')} |`,
    );
  }

  if (data.milestones) {
    lines.push(
      '',
      '## Story milestones',
      '',
      '| Game | Milestones | Required | Optional |',
      '|---|---|---|---|',
    );
    for (const game of data.games) {
      const here = data.milestones.filter((m) => m.part[game] !== undefined);
      const optional = here.filter((m) => m.optional).length;
      lines.push(
        `| ${gameName(game)} | ${here.length} | ${here.length - optional} | ${optional} |`,
      );
    }
  }

  if (data.milestones) {
    // The Story and Guide order (plan §13.13), for reviewing the `after` anchors; games with the same journey share
    // a heading.
    lines.push('', '## Journey', '');
    const byText = new Map<string, GameId[]>();
    for (const game of data.games) {
      const text = journeyLines(data, game, buildJourney(buildGameView(data, game), game)).join(
        '\n',
      );
      byText.set(text, [...(byText.get(text) ?? []), game]);
    }
    for (const [text, games] of byText)
      lines.push(`### ${games.map(gameName).join(', ')}`, '', text, '');
    lines.pop();
  }

  lines.push('', '## Unobtainable species', '');
  for (const { game, entries } of checklists) {
    lines.push(`### ${gameName(game)}`, '');
    for (const e of entries.filter((x) => !x.obtainable)) {
      const detail = e.unobtainableDetail ? ` (${e.unobtainableDetail})` : '';
      lines.push(`- #${e.dex} ${names.get(e.dex) ?? '?'}: ${e.unobtainableReason ?? '?'}${detail}`);
    }
    lines.push('');
  }

  lines.push('## Encounter changes since the previous build', '');
  if (!previous) {
    lines.push('No previous build.', '');
  } else {
    const before = encounterKeys(previous);
    const after = encounterKeys(data);
    let changed = false;
    for (const id of [...new Set([...before.keys(), ...after.keys()])]) {
      const old = before.get(id) ?? new Set<string>();
      const now = after.get(id) ?? new Set<string>();
      const added = [...now].filter((k) => !old.has(k));
      const removed = [...old].filter((k) => !now.has(k));
      if (added.length === 0 && removed.length === 0) continue;
      changed = true;
      lines.push(
        `### ${id}`,
        '',
        ...added.map((k) => `- added: ${k}`),
        ...removed.map((k) => `- removed: ${k}`),
        '',
      );
    }
    if (!changed) lines.push('None.', '');
  }

  for (const level of ['warning', 'note'] as const) {
    const selected = issues.filter((i) => i.level === level);
    lines.push(`## ${level === 'warning' ? 'Warnings' : 'Notes'} (${selected.length})`, '');
    for (const found of selected)
      lines.push(`- ${found.page ? `[${found.page}] ` : ''}${found.message}`);
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}
