/**
 * Game Corner prize shops (plan §7.7): `{{shop|<title>}} {{shoprow|{{shopmon|Name|dex|coins|lv=N}}…}} {{shopfooter}}`
 * blocks inside a location page section. The shop title names the games through `{{color2}}` link texts
 * (`Pokémon Red`); shops for other versions (`Pocket Monsters Blue`) are skipped. Item prizes (`{{shopitem}}`) are
 * counted but not kept yet.
 */
import type { GameId } from '../../../src/app/core/domain/models';
import { GAMES } from '../../../src/app/core/games/registry';
import { parseDex } from '../adapters/catch-template-adapter';
import type { Issue, WalkedRow } from './encounter-walker';
import { parseLevels } from './levels';
import { stripMarkup } from './markup';
import { findNestedSection, type TitleMatcher } from './sections';
import { findTemplates, stripComments, type TemplateCall } from './wikitext';

export interface PrizeShopOptions {
  pageTitle: string;
  /** Heading path to the shops, e.g. `[/^Prize corner/, 'Generation I']`. */
  sectionPath: readonly TitleMatcher[];
  /** The version group's games. */
  games: readonly GameId[];
  /** Unlock ids every prize needs (the Coin Case). */
  requires: readonly string[];
}

export interface PrizeShopResult {
  found: boolean;
  rows: WalkedRow[];
  /** Skipped shops and item prizes, for build notes. */
  notes: string[];
  issues: Issue[];
}

const ALL_VERSIONS = /^all versions$/i;

/** Games named by a shop title; `null` when the title names none of the version group's games. */
function shopGames(title: string, games: readonly GameId[]): GameId[] | null {
  if (ALL_VERSIONS.test(stripMarkup(title))) return [...games];
  const texts = findTemplates(title)
    .filter((c) => c.name === 'color2')
    .map((c) => stripMarkup(c.positional[2] ?? c.positional[1] ?? ''));
  const named = GAMES.filter((g) => games.includes(g.id) && texts.includes(g.name)).map((g) => g.id);
  return named.length > 0 ? named : null;
}

export function parsePrizeShops(wikitext: string, options: PrizeShopOptions): PrizeShopResult {
  const result: PrizeShopResult = { found: false, rows: [], notes: [], issues: [] };
  const text = stripComments(wikitext);
  const section = findNestedSection(text, options.sectionPath);
  if (!section) return result;
  result.found = true;

  let current: GameId[] | null = null;
  let itemPrizes = 0;
  const visit = (call: TemplateCall) => {
    switch (call.name) {
      case 'shop': {
        const title = call.positional[0] ?? '';
        current = shopGames(title, options.games);
        if (!current) result.notes.push(`Skipped prize shop for other versions: ${stripMarkup(title)}`);
        return;
      }
      case 'shopfooter':
        current = null;
        return;
      case 'shoprow':
        for (const inner of findTemplates(text, call.start + 2, call.end - 2)) visit(inner);
        return;
      case 'shopitem':
        if (current) itemPrizes++;
        return;
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
          result.issues.push({ level: 'error', page: options.pageTitle, message: `${(error as Error).message}: ${source}` });
          return;
        }
        if (!Number.isInteger(coins) || coins <= 0 || !levels) {
          result.issues.push({ level: 'error', page: options.pageTitle, message: `Malformed prize row: ${source}` });
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
  if (itemPrizes > 0) result.notes.push(`Item prizes not listed yet: ${itemPrizes}`);
  return result;
}
