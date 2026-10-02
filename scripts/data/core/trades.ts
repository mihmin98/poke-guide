/**
 * In-game trades (plan §7.7). The `In-game trade` page's generation section holds one wikitable per release
 * (`====Pokémon Yellow====`). Each row has the location, the species the player gives and gets (`{{MSP/3|dex|Name}}`,
 * in that order), and the English nickname; `N/A` there means the trade only exists in a Japanese release.
 * Location tables already hold the trade rows, so these are only diffed against them, and add the nicknames.
 *
 * Generation II has one table for three games: a trade that differs per game spans two rows (`rowspan=2` on the
 * shared cells), and the cells of each variant carry the game's background color (`{{crystal color light}}`). Its
 * last column holds the traded Pokémon's fixed DVs (`8/9/6/6/6`), which become the slots' `ivs`.
 */
import type { GameId, GameLocation, StatId } from '../../../src/app/core/domain/models';
import { hpDv } from '../../../src/app/core/mechanics/dv';
import type { Issue } from './encounter-walker';
import { stripMarkup } from './markup';
import { findNestedSection, headingText, headingsWithin, sectionAt } from './sections';
import { findTemplates, parseHeadings, splitTopLevel, stripComments } from './wikitext';

export interface TradeTable {
  /** Heading directly under the generation section, e.g. `Pokémon Yellow`. */
  heading: string;
  games: GameId[];
  /**
   * Cell background colors that mark a row's games (`crystal` for `{{crystal color light}}`). A row whose own cells
   * carry any of them belongs to those games only; other rows belong to every game of the table.
   */
  cellColorGames?: Record<string, GameId[]>;
  /**
   * The order of the slash-separated fixed DVs in the row's last cell (Gen II: HP/Attack/Defense/Speed/Special).
   * Every row must have them, and an HP DV must match the one built from the other four.
   */
  dvOrder?: StatId[];
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
  /** Fixed DVs, when the table has them (`dvOrder`). */
  ivs?: Partial<Record<StatId, number>>;
}

export interface TradeParseResult {
  trades: ParsedTrade[];
  issues: Issue[];
}

const CELL_ATTRIBUTES = /^\s*(?:rowspan|colspan|style|class|align)\s*=/i;

interface Cell {
  text: string;
  /** The `attr=… ` prefix, empty when there is none. */
  attributes: string;
  rowspan: number;
}

/** Wikitable cells of one row: lines starting with `|`, split from their `attr=… |` prefix. */
function rowCells(row: string): Cell[] {
  const cells: Cell[] = [];
  for (const line of row.split('\n')) {
    if (!line.startsWith('|') || line.startsWith('|}') || line.startsWith('|-')) continue;
    const parts = splitTopLevel(line.slice(1));
    const hasAttributes = parts.length > 1 && CELL_ATTRIBUTES.test(parts[0]!);
    const attributes = hasAttributes ? parts[0]! : '';
    const rowspan = /\browspan\s*=\s*"?(\d+)/i.exec(attributes);
    cells.push({
      text: (hasAttributes ? parts.slice(1).join('|') : line.slice(1)).trim(),
      attributes,
      rowspan: rowspan ? Number(rowspan[1]) : 1,
    });
  }
  return cells;
}

/** Fills in the cells spanning down from earlier rows (`rowspan`), so each row has every column. */
function expandRows(rows: readonly Cell[][]): Cell[][] {
  const pending: { cell: Cell; left: number }[] = [];
  return rows.map((own) => {
    const expanded: Cell[] = [];
    const take = () => {
      while (pending[expanded.length] && pending[expanded.length]!.left > 0) {
        const span = pending[expanded.length]!;
        span.left--;
        expanded.push(span.cell);
      }
    };
    for (const cell of own) {
      take();
      if (cell.rowspan > 1) pending[expanded.length] = { cell, left: cell.rowspan - 1 };
      else delete pending[expanded.length];
      expanded.push(cell);
    }
    take();
    return expanded;
  });
}

/** The games of a row from its own cells' background colors; `null` when they name none. */
function rowGames(own: readonly Cell[], table: TradeTable): GameId[] | null {
  if (!table.cellColorGames) return null;
  const games = new Set<GameId>();
  for (const cell of own) {
    for (const [, color] of cell.attributes.matchAll(/\{\{\s*([a-z]+) color light\s*\}\}/gi)) {
      for (const game of table.cellColorGames[color!.toLowerCase()] ?? []) games.add(game);
    }
  }
  return games.size > 0 ? table.games.filter((g) => games.has(g)) : null;
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
    const ownRows = body
      .slice(start, end)
      .split(/\n\|-[^\n]*/)
      .slice(1)
      .map(rowCells);
    const expandedRows = expandRows(ownRows);
    const isSpecies = (cell: Cell) => /\{\{MSP\/3\|/i.test(cell.text);
    let location: string | null = null;
    ownRows.forEach((own, index) => {
      const cells = expandedRows[index]!;
      if (cells.length === 0) return;
      const species = cells
        .filter(isSpecies)
        .map((c) => findTemplates(c.text).find((call) => call.name === 'msp/3')!);
      if (species.length < 2) return;
      const first = cells[0]!;
      if (!isSpecies(first)) location = locationPageOf(first.text);
      if (!location) {
        issue(
          `Trade row without a location under "${table.heading}": ${cells.map((c) => c.text).join(' | ')}`,
        );
        return;
      }
      // Cells: [location], give MSP, give name, get MSP, get name, English nickname, ...
      const getIndex = cells.findIndex(
        (c, i) => i > 0 && isSpecies(c) && cells.slice(0, i).some(isSpecies),
      );
      const nickname = stripMarkup(cells[getIndex + 2]?.text ?? '');
      if (/^N\/A$/i.test(nickname)) return;
      const trade: ParsedTrade = {
        games: rowGames(own, table) ?? [...table.games],
        locationPage: location,
        giveDex: Number(species[0]!.positional[0]),
        getDex: Number(species[1]!.positional[0]),
        nickname,
      };
      if (table.dvOrder) {
        const ivs = parseDvs(stripMarkup(cells[cells.length - 1]?.text ?? ''), table.dvOrder);
        if (typeof ivs === 'string') {
          issue(`Trade #${trade.giveDex} → #${trade.getDex} under "${table.heading}": ${ivs}`);
          return;
        }
        trade.ivs = ivs;
      }
      result.trades.push(trade);
    });
  }
  return result;
}

/** `8/9/6/6/6` in `order`; a string explains a cell that doesn't fit. */
function parseDvs(
  cell: string,
  order: readonly StatId[],
): Partial<Record<StatId, number>> | string {
  const parts = cell.split('/').map((part) => part.trim());
  if (parts.length !== order.length || parts.some((part) => !/^\d{1,2}$/.test(part))) {
    return `"${cell}" is not ${order.length} DVs`;
  }
  const dvs: Partial<Record<StatId, number>> = {};
  order.forEach((stat, i) => (dvs[stat] = Number(parts[i])));
  if (Object.values(dvs).some((dv) => dv > 15)) return `"${cell}" has a DV above 15`;
  const { hp, atk, def, spe, spc } = dvs;
  if (
    hp !== undefined &&
    atk !== undefined &&
    def !== undefined &&
    spe !== undefined &&
    spc !== undefined &&
    hp !== hpDv(atk, def, spe, spc)
  ) {
    return `"${cell}" has an HP DV that doesn't match the other four`;
  }
  return dvs;
}

/**
 * Compares parsed trades with the location data's `trade` encounters per game, and sets `trade.nickname` and fixed
 * DVs on matches (in place). Returns warning messages; unknown location pages are errors.
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
      if (trade.ivs) {
        encounter.games[game] = encounter.games[game]!.map((slot) => ({
          ...slot,
          ivs: { kind: 'fixed', values: { ...trade.ivs } },
        }));
      }
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
