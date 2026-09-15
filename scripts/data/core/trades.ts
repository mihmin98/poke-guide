/**
 * In-game trades (plan §7.7). The `In-game trade` page's generation section holds one wikitable per release
 * (`====Pokémon Yellow====`). Each row has the location, the species the player gives and gets (`{{MSP/3|dex|Name}}`,
 * in that order), and the English nickname; `N/A` there means the trade only exists in a Japanese release.
 * Location tables already hold the trade rows, so these are only diffed against them, and add the nicknames.
 */
import type { GameId, GameLocation } from '../../../src/app/core/domain/models';
import type { Issue } from './encounter-walker';
import { stripMarkup } from './markup';
import { findNestedSection, headingText, headingsWithin, sectionAt } from './sections';
import { findTemplates, parseHeadings, splitTopLevel, stripComments } from './wikitext';

export interface TradeTable {
  /** Heading directly under the generation section, e.g. `Pokémon Yellow`. */
  heading: string;
  games: GameId[];
}

export interface TradePageConfig {
  page: string;
  tables: TradeTable[];
}

export interface ParsedTrade {
  games: GameId[];
  /** Page title of the location: `Kanto Route 2`, `Underground Path (Kanto Routes 5–6)`, `Cinnabar Lab`. */
  locationPage: string;
  giveDex: number;
  getDex: number;
  nickname: string;
}

export interface TradeParseResult {
  trades: ParsedTrade[];
  issues: Issue[];
}

const CELL_ATTRIBUTES = /^\s*(?:rowspan|colspan|style|class|align)\s*=/i;

/** Wikitable cells of one row: lines starting with `|`, without their `attr=… |` prefix. */
function rowCells(row: string): string[] {
  const cells: string[] = [];
  for (const line of row.split('\n')) {
    if (!line.startsWith('|') || line.startsWith('|}') || line.startsWith('|-')) continue;
    const parts = splitTopLevel(line.slice(1));
    cells.push(
      (parts.length > 1 && CELL_ATTRIBUTES.test(parts[0]!)
        ? parts.slice(1).join('|')
        : line.slice(1)
      ).trim(),
    );
  }
  return cells;
}

/** The page a location cell links to; `null` when it holds no link. */
function locationPageOf(cell: string): string | null {
  const call = findTemplates(cell)[0];
  if (call?.name === 'rt')
    return `${stripMarkup(call.positional[1] ?? '')} Route ${stripMarkup(call.positional[0] ?? '')}`;
  if (call?.name === 'obp') return `${call.positional[0]} (${call.positional[1]})`;
  const link = /\[\[([^|\]]+)/.exec(cell);
  return link ? link[1]!.trim() : null;
}

export function parseTradeTables(
  wikitext: string,
  options: { pageTitle: string; generationHeading: string; tables: readonly TradeTable[] },
): TradeParseResult {
  const result: TradeParseResult = { trades: [], issues: [] };
  const issue = (message: string) =>
    result.issues.push({ level: 'error', page: options.pageTitle, message });
  const text = stripComments(wikitext);
  const headings = parseHeadings(text);
  const generation = findNestedSection(text, [options.generationHeading], headings);
  if (!generation) {
    issue(`No "${options.generationHeading}" section`);
    return result;
  }
  const children = headingsWithin(headings, generation).filter(
    (h) => h.level === generation.heading.level + 1,
  );

  for (const table of options.tables) {
    const heading = children.find((h) => headingText(h) === table.heading);
    if (!heading) {
      issue(`No "${table.heading}" trade table`);
      continue;
    }
    const section = sectionAt(text, headings, headings.indexOf(heading));
    const body = text.slice(section.start, section.end);
    const start = body.indexOf('{|');
    const end = body.indexOf('\n|}', start);
    if (start < 0 || end < 0) {
      issue(`No wikitable under "${table.heading}"`);
      continue;
    }
    let location: string | null = null;
    for (const row of body
      .slice(start, end)
      .split(/\n\|-[^\n]*/)
      .slice(1)) {
      const cells = rowCells(row);
      if (cells.length === 0) continue;
      const species = findTemplates(row).filter((c) => c.name === 'msp/3');
      if (species.length < 2) continue;
      const first = cells[0]!;
      if (!/\{\{MSP\/3\|/i.test(first)) location = locationPageOf(first);
      if (!location) {
        issue(`Trade row without a location under "${table.heading}": ${cells.join(' | ')}`);
        continue;
      }
      // Cells: [location], give MSP, give name, get MSP, get name, English nickname, ...
      const getIndex = cells.findIndex(
        (c, i) =>
          i > 0 &&
          /\{\{MSP\/3\|/i.test(c) &&
          cells.slice(0, i).some((p) => /\{\{MSP\/3\|/i.test(p)),
      );
      const nickname = stripMarkup(cells[getIndex + 2] ?? '');
      if (/^N\/A$/i.test(nickname)) continue;
      result.trades.push({
        games: [...table.games],
        locationPage: location,
        giveDex: Number(species[0]!.positional[0]),
        getDex: Number(species[1]!.positional[0]),
        nickname,
      });
    }
  }
  return result;
}

/**
 * Compares parsed trades with the location data's `trade` encounters per game, and sets `trade.nickname` on matches
 * (in place). Returns warning messages; unknown location pages are errors.
 */
export function diffTrades(
  locations: GameLocation[],
  trades: readonly ParsedTrade[],
  locationIdByPage: ReadonlyMap<string, string>,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const matched = new Set<string>();
  const byId = new Map(locations.map((l) => [l.id, l]));

  for (const trade of trades) {
    const locationId = locationIdByPage.get(trade.locationPage);
    const location = locationId ? byId.get(locationId) : undefined;
    if (!location) {
      errors.push(`Trade for #${trade.getDex} names unknown location page "${trade.locationPage}"`);
      continue;
    }
    for (const game of trade.games) {
      const encounter = location.subAreas
        .flatMap((s) => s.encounters)
        .find(
          (e) =>
            e.method === 'trade' &&
            e.dex === trade.getDex &&
            e.trade?.giveDex === trade.giveDex &&
            e.games[game],
        );
      if (!encounter) {
        warnings.push(
          `${location.id}: trade page lists #${trade.giveDex} → #${trade.getDex} in ${game}, the location data doesn't`,
        );
        continue;
      }
      matched.add(`${location.id}|${trade.getDex}|${trade.giveDex}|${game}`);
      if (encounter.trade!.nickname && encounter.trade!.nickname !== trade.nickname) {
        warnings.push(
          `${location.id}: #${trade.getDex} is nicknamed ${encounter.trade!.nickname} and ${trade.nickname}`,
        );
        continue;
      }
      encounter.trade!.nickname = trade.nickname;
    }
  }

  for (const location of locations) {
    for (const encounter of location.subAreas.flatMap((s) => s.encounters)) {
      if (encounter.method !== 'trade' || !encounter.trade) continue;
      for (const game of Object.keys(encounter.games) as GameId[]) {
        if (!matched.has(`${location.id}|${encounter.dex}|${encounter.trade.giveDex}|${game}`)) {
          warnings.push(
            `${location.id}: #${encounter.trade.giveDex} → #${encounter.dex} in ${game} is not on the trade page`,
          );
        }
      }
    }
  }
  return { errors, warnings };
}
