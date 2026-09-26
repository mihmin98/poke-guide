/**
 * Game Corner prize shops (plan §7.7): `{{shop|<title>}} {{shoprow|{{shopmon|Name|dex|coins|lv=N}}…}} {{shopfooter}}`
 * blocks inside a location page section. The shop title names the games (`Pokémon Red`, `Pokémon Gold and Silver`) or
 * none (`All versions`, `[[TM]]s`); shops for other versions (`Pocket Monsters Blue`) are skipped. Item prizes (`{{shopitem}}`) become
 * location items bought with coins (`obtain: 'purchase'`).
 */
import type { GameId, LocationItem } from '../../../src/app/core/domain/models';
import { GAMES } from '../../../src/app/core/games/registry';
import { parseDex } from '../adapters/catch-template-adapter';
import type { Issue, WalkedRow } from './encounter-walker';
import { UNNUMBERED } from './item-numbers';
import { parseLevels } from './levels';
import { stripMarkup } from './markup';
import { findNestedSection, type TitleMatcher } from './sections';
import { slugify } from './slug';
import { findTemplates, stripComments, type TemplateCall } from './wikitext';

export interface PrizeShopOptions {
  pageTitle: string;
  /** Heading path to the shops, e.g. `[/^Prize corner/, 'Generation I']`. */
  sectionPath: readonly TitleMatcher[];
  /** The version group's games. */
  games: readonly GameId[];
  /** Unlock ids every prize needs (the Coin Case). */
  requires: readonly string[];
  /** Sub-area for item prizes, e.g. `Prize corner`. */
  itemSubArea?: string | null;
}

export interface PrizeShopResult {
  found: boolean;
  rows: WalkedRow[];
  /** Item prizes ({{shopitem}}), as location items. */
  items: LocationItem[];
  /** Skipped shops and prizes in another currency, for build notes. */
  notes: string[];
  issues: Issue[];
}

/** Release names in a shop title: `Pokémon Gold and Silver`, `Pokémon Red / Pocket Monsters Red`. */
const RELEASES =
  /\b(Pokémon|Pocket Monsters) ([A-Z][A-Za-z]*(?:(?:,\s*|\s+and\s+|\s*&\s*)[A-Z][A-Za-z]*)*)/g;
const RELEASE_SEPARATOR = /,\s*|\s+and\s+|\s*&\s*/;
/** `{{shopitem|TM23|3300|C||TM Dragon|Dragon Rage}}`: the machine number and the move it teaches. */
const MACHINE = /^(?:TM|HM)\d+$/i;

/** The item's name as spelled in the generation: "TM23 Dragon Rage", "Smoke Ball". */
function prizeItemName(call: TemplateCall): string {
  const display = call.named['display'];
  if (display) return stripMarkup(display);
  const name = stripMarkup(call.positional[0] ?? '');
  const move = stripMarkup(call.positional[5] ?? '');
  return MACHINE.test(name) && move ? `${name} ${move}` : name;
}

/**
 * Games named by a shop title. `Pokémon <Game>` names a registry game and `Pocket Monsters <Game>` a Japanese
 * release. A title that names no release (`All versions`, `[[TM]]s`) covers every game of the version group, since
 * the section path already selects the generation. `null` when the title only names other releases.
 */
function shopGames(title: string, games: readonly GameId[]): GameId[] | null {
  const named = new Set<GameId>();
  let releases = 0;
  for (const [, series, list] of stripMarkup(title).matchAll(RELEASES)) {
    releases++;
    if (series !== 'Pokémon') continue;
    for (const part of list!.split(RELEASE_SEPARATOR)) {
      const game = GAMES.find((g) => g.name === `Pokémon ${part}`);
      if (game) named.add(game.id);
    }
  }
  if (releases === 0) return [...games];
  const ours = games.filter((g) => named.has(g));
  return ours.length > 0 ? ours : null;
}

export function parsePrizeShops(wikitext: string, options: PrizeShopOptions): PrizeShopResult {
  const result: PrizeShopResult = { found: false, rows: [], items: [], notes: [], issues: [] };
  const text = stripComments(wikitext);
  const section = findNestedSection(text, options.sectionPath);
  if (!section) return result;
  result.found = true;

  let current: GameId[] | null = null;
  const visit = (call: TemplateCall) => {
    switch (call.name) {
      case 'shop': {
        const title = call.positional[0] ?? '';
        current = shopGames(title, options.games);
        if (!current)
          result.notes.push(`Skipped prize shop for other versions: ${stripMarkup(title)}`);
        return;
      }
      case 'shopfooter':
        current = null;
        return;
      case 'shoprow':
        for (const inner of findTemplates(text, call.start + 2, call.end - 2)) visit(inner);
        return;
      case 'shopitem': {
        if (!current) return;
        const source = text.slice(call.start, call.end);
        // Poké Mart stock and money prices are out of scope (plan §7.13): only coin prizes are kept.
        const currency = stripMarkup(call.positional[2] ?? '');
        if (currency !== 'C') {
          result.notes.push(`Prize not bought with coins, skipped: ${source}`);
          return;
        }
        const coins = Number(stripMarkup(call.positional[1] ?? ''));
        const name = prizeItemName(call);
        if (!name || !Number.isInteger(coins) || coins <= 0) {
          result.issues.push({
            level: 'error',
            page: options.pageTitle,
            message: `Malformed item prize: ${source}`,
          });
          return;
        }
        result.items.push({
          no: UNNUMBERED,
          itemId: slugify(name),
          name,
          quantity: 1,
          games: [...current],
          obtain: 'purchase',
          subArea: options.itemSubArea ?? null,
          where: `Game Corner prize for ${coins} Coins`,
          coins,
          ...(options.requires.length > 0 ? { requires: options.requires.map((id) => [id]) } : {}),
        });
        return;
      }
      case 'shopmon': {
        if (!current) return;
        const source = text.slice(call.start, call.end);
        const coins = Number(stripMarkup(call.positional[2] ?? ''));
        const rawLevels = stripMarkup(call.named['lv'] ?? '');
        const levels = parseLevels(rawLevels);
        let dex: number;
        try {
          dex = parseDex(call.positional[1]);
        } catch (error) {
          result.issues.push({
            level: 'error',
            page: options.pageTitle,
            message: `${(error as Error).message}: ${source}`,
          });
          return;
        }
        if (!Number.isInteger(coins) || coins <= 0 || !levels) {
          result.issues.push({
            level: 'error',
            page: options.pageTitle,
            message: `Malformed prize row: ${source}`,
          });
          return;
        }
        result.rows.push({
          row: {
            dex,
            name: stripMarkup(call.positional[0] ?? ''),
            rawMethod: 'Prize',
            games: [...current],
            slots: [{ levels, rawLevels, rate: { kind: 'coins', value: coins } }],
            types: [],
          },
          method: 'prize',
          requires: [...options.requires],
          subArea: null,
          label: null,
        });
        return;
      }
    }
  };
  for (const call of findTemplates(text, section.start, section.end)) visit(call);
  return result;
}
