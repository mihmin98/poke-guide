/**
 * Item lists (plan §7.13): `{{Itemlist}}` / `{{Itemlist/N}}` rows with game flags, as used in location page `Items`
 * sections and on walkthrough pages. Each spot becomes one item, with its hidden marker, floor, quantity, how it's
 * obtained and the parsed `(requires …)` prerequisites.
 */
import type { GameId, ItemObtainMethod, LocationItem } from '../../../src/app/core/domain/models';
import { GAMES } from '../../../src/app/core/games/registry';
import type { Issue } from './encounter-walker';
import { replaceTemplates, splitTooltips, stripMarkup } from './markup';
import { findNestedSection, headingText, headingsWithin } from './sections';
import { slugify } from './slug';
import {
  findTemplates,
  parseHeadings,
  parseTemplate,
  stripComments,
  type Heading,
  type TemplateCall,
} from './wikitext';

export interface ItemWalkOptions {
  pageTitle: string;
  /** The version group's games, in output order. */
  games: readonly GameId[];
  /** Flag keys (`R=yes`) → games. */
  gameFlags: Readonly<Record<string, readonly GameId[]>>;
  /** Spelling variants → item name. */
  aliases: Readonly<Record<string, string>>;
  /** Plain-text requirement terms → unlock ids; `null` drops a term that belongs to other games (`Chop Down`). */
  requirementPhrases: Readonly<Record<string, string | null>>;
}

export interface ItemWalkResult {
  /** False when the page has no `Items` section (always true for whole-page collection). */
  found: boolean;
  items: LocationItem[];
  /** Fake item balls, e.g. "Fake item balls: Voltorb ×6". */
  notes: string[];
  issues: Issue[];
}

const GAME_NAMES = [...GAMES.map((g) => g.shortName), 'Green'].join('|');
/** Headings that split rows by version (`Pokémon Red and Blue`); the flags already say which games. */
const GAME_HEADING = new RegExp(
  `^Pok[eé]mon (?:${GAME_NAMES})(?:(?:,| and|, and) (?:${GAME_NAMES}))*$`,
  'i',
);
const FAKE_HEADING = /^fake items?$/i;

const REQUIRES = /\(requires\s+((?:[^()]|\([^()]*\))*)\)/i;
const HIDDEN = /(?:'')?\(hidden\b[^)]*\)(?:'')?/i;
const BROKEN = /\s*\(broken\b[^)]*\)/gi;
/** `B2F, …` on location pages, `5F; …` on walkthroughs. */
const FLOOR = /^(B?\d+F|Rooftop)\b[,;]?\s*/;
const SPRITE_SUFFIX = / (?:I|II|III|IV|V|VI|VII|VIII|IX)$/;

/** Templates whose visible text differs from `stripMarkup`'s first-argument default. */
const INLINE: Record<string, (call: TemplateCall) => string> = {
  tm: (c) => `TM${c.positional[0] ?? ''} ${c.positional[1] ?? ''}`,
  hm: (c) => `HM${c.positional[0] ?? ''} ${c.positional[1] ?? ''}`,
  tc: (c) => c.positional[1] ?? c.positional[0] ?? '',
  dl: (c) => c.positional[1] ?? c.positional[0] ?? '',
  badge: (c) => `${c.positional[0] ?? ''} Badge`,
  '2v2': (c) => c.positional.join(' and '),
  daisy: () => 'Daisy',
  player: () => 'the player',
};

/** Drops tooltips and `{{sup/…}}` game notes, keeping the rest as wikitext. */
function clean(wikitext: string): string {
  const { text } = splitTooltips(wikitext);
  return replaceTemplates(text, (call) =>
    call.name.startsWith('sup/') ? '' : text.slice(call.start, call.end),
  );
}

function plain(wikitext: string): string {
  const text = clean(wikitext);
  return stripMarkup(
    replaceTemplates(text, (call) => INLINE[call.name]?.(call) ?? text.slice(call.start, call.end)),
  );
}

function itemName(
  call: TemplateCall,
  index: number,
  count: number,
  aliases: ItemWalkOptions['aliases'],
): { name: string; quantity: number } | null {
  const display = count === 1 ? call.named['display'] : undefined;
  let quantity = 1;
  let name: string;
  if (display) {
    name = plain(display);
    const times = /\s*×\s*(\d+)$/.exec(name);
    if (times) {
      quantity = Number(times[1]);
      name = name.slice(0, times.index);
    }
    const coins = /^(\d+) Coins?$/i.exec(name);
    if (coins) {
      quantity = Number(coins[1]);
      name = 'Coins';
    }
  } else {
    name = plain(call.positional[index] ?? '');
    // `TM Water` is only a sprite key; the machine number is in `display`.
    if (/^(?:TM|HM)\b/.test(name)) return null;
    name = name.replace(SPRITE_SUFFIX, '');
  }
  name = name.trim();
  return { name: aliases[name] ?? name, quantity };
}

function obtainMethod(where: string, hidden: boolean): ItemObtainMethod {
  if (/\bchoice between\b/i.test(where)) return 'choice';
  if (hidden) return 'pickup';
  if (/\bdropped by\b/i.test(where)) return 'drop';
  if (/\breward\b|\b(?:after|for) defeating\b/i.test(where)) return 'reward';
  if (/\b(?:received|obtained|gift) from\b|(?:^|[,;]\s*)from\b/i.test(where)) return 'gift';
  return 'pickup';
}

/** `A or B and C` → `[[A, B], [C]]` as unlock ids; unknown terms are returned as errors. */
function parseRequirements(
  body: string,
  phrases: ItemWalkOptions['requirementPhrases'],
): { requires: string[][]; unknown: string[] } {
  const requires: string[][] = [];
  const unknown: string[] = [];
  for (const group of body.split(/\s+and\s+/)) {
    const alternatives: string[] = [];
    for (const rawTerm of group.split(/\s+or\s+|\s*\/\s*/)) {
      // Walkthroughs write "requires the {{ka|Card Key}}".
      const term = rawTerm.replace(/^\s*(?:the|a|an)\s+/i, '');
      const text = plain(term);
      if (!text) continue;
      if (Object.hasOwn(phrases, text)) {
        const id = phrases[text];
        if (id) alternatives.push(id);
        continue;
      }
      const call = parseTemplate(term);
      const link = /^\[\[([^|\]]+)(?:\|[^\]]*)?\]\]$/.exec(term.trim());
      const target =
        call && ['m', 'ka', 'i'].includes(call.name)
          ? call.positional[0]
          : call
            ? undefined
            : link?.[1];
      if (target) alternatives.push(slugify(target));
      else unknown.push(text);
    }
    if (alternatives.length > 0) requires.push([...new Set(alternatives)]);
  }
  return { requires, unknown };
}

type Event = { offset: number; heading: Heading } | { offset: number; template: TemplateCall };

function walkRows(
  text: string,
  events: readonly Event[],
  options: ItemWalkOptions,
  result: ItemWalkResult,
): void {
  const issue = (level: Issue['level'], message: string) =>
    result.issues.push({ level, page: options.pageTitle, message });
  let heading: string | null = null;
  let fake = false;

  for (const event of events) {
    if ('heading' in event) {
      const title = headingText(event.heading);
      fake = FAKE_HEADING.test(title);
      if (!fake && !GAME_HEADING.test(title)) heading = title;
      continue;
    }
    const call = event.template;
    const variant = /^itemlist(?:\/(\d+))?$/.exec(call.name);
    if (!variant) continue;
    const count = variant[1] ? Number(variant[1]) : 1;
    const games = options.games.filter((game) =>
      Object.entries(call.named).some(
        ([key, value]) => /^yes$/i.test(value) && options.gameFlags[key]?.includes(game),
      ),
    );
    if (games.length === 0) continue;

    const source = text.slice(call.start, call.end);
    const whereRaw = call.positional[count];
    if (whereRaw === undefined) {
      issue('error', `Item row without a location text: ${source}`);
      continue;
    }
    // Temporary items (the Safari Zone's Safari Balls) are out of scope. Walkthroughs say "Loaned".
    if (/\bcannot be kept\b|^loaned\b/i.test(plain(whereRaw))) continue;

    const spots = whereRaw.startsWith('*')
      ? whereRaw
          .split(/(?:^|\n)\s*\*/)
          .map((s) => s.trim())
          .filter((s) => s !== '')
      : [whereRaw];

    for (let index = 0; index < count; index++) {
      const named = itemName(call, index, count, options.aliases);
      if (!named) {
        issue('error', `Machine item without display=: ${source}`);
        continue;
      }
      // Walkthroughs list the Power Plant's disguised Voltorb without a `Fake items` heading.
      const disguised =
        plain(call.positional[0] ?? '') === 'None' && /^\{\{p\|/i.test(call.named['display'] ?? '');
      if (fake || disguised) {
        result.notes.push(`Fake item balls: ${named.name} ×${named.quantity}`);
        continue;
      }
      if (spots.length > 1 && named.quantity !== spots.length) {
        issue(
          'warning',
          `Quantity ×${named.quantity} doesn't match ${spots.length} spots: ${source}`,
        );
      }
      for (const spot of spots) {
        let rest = clean(spot);
        let requires: string[][] = [];
        const requiresMatch = REQUIRES.exec(rest);
        if (requiresMatch) {
          const parsed = parseRequirements(requiresMatch[1]!, options.requirementPhrases);
          requires = parsed.requires;
          for (const term of parsed.unknown)
            issue('error', `Unrecognized requirement "${term}" in ${source}`);
          rest =
            rest.slice(0, requiresMatch.index) +
            rest.slice(requiresMatch.index + requiresMatch[0].length);
        }
        const hidden = HIDDEN.test(rest);
        rest = rest.replace(HIDDEN, ' ');
        let where = plain(rest)
          .replace(BROKEN, '')
          .replace(/\s+([,.;])/g, '$1')
          .trim();
        let subArea = heading;
        const floor = FLOOR.exec(where);
        if (floor && subArea === null) {
          subArea = floor[1]!;
          where = where.slice(floor[0].length);
        }
        where = where.charAt(0).toUpperCase() + where.slice(1);
        result.items.push({
          itemId: slugify(named.name),
          name: named.name,
          quantity: spots.length > 1 ? 1 : named.quantity,
          games: [...games],
          obtain: obtainMethod(where, hidden),
          ...(hidden ? { hidden: true as const } : {}),
          subArea,
          where,
          ...(requires.length > 0 ? { requires } : {}),
        });
      }
    }
  }
}

/** Items in a location page's `Items` section; headings inside it are sub-areas. */
export function walkItemSection(wikitext: string, options: ItemWalkOptions): ItemWalkResult {
  const text = stripComments(wikitext);
  const headings = parseHeadings(text);
  const section = findNestedSection(text, ['Items'], headings);
  const result: ItemWalkResult = { found: section !== null, items: [], notes: [], issues: [] };
  if (!section) return result;
  const events: Event[] = [
    ...headingsWithin(headings, section).map((heading) => ({ offset: heading.start, heading })),
    ...findTemplates(text, section.start, section.end).map((template) => ({
      offset: template.start,
      template,
    })),
  ].sort((a, b) => a.offset - b.offset);
  walkRows(text, events, options, result);
  return result;
}

/** Every item row on a page, without sub-areas (walkthrough pages, where rows sit inside tables). */
export function collectItemRows(wikitext: string, options: ItemWalkOptions): ItemWalkResult {
  const text = stripComments(wikitext);
  const result: ItemWalkResult = { found: true, items: [], notes: [], issues: [] };
  const events = findTemplates(text).map((template) => ({ offset: template.start, template }));
  walkRows(text, events, options, result);
  return result;
}
