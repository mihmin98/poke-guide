/**
 * Walks one generation's encounter section of a location page, in document order (plan §7.4 step 3):
 * sub-area headings, `catch/div` floors and group labels, and adapter rows.
 */
import type { EncounterMethodId, LocationKind } from '../../../src/app/core/domain/models';
import { findMethod } from '../../../src/app/core/games/methods';
import {
  AdapterError,
  FLOOR_LABEL,
  type CatchTemplateAdapter,
  type RawEncounterRow,
  type WalkContext,
} from '../adapters/catch-template-adapter';
import { stripMarkup } from './markup';
import { findNestedSection, headingText, headingsWithin } from './sections';
import {
  findTemplates,
  parseHeadings,
  stripComments,
  type Heading,
  type TemplateCall,
} from './wikitext';

export interface Issue {
  level: 'error' | 'warning';
  page: string;
  message: string;
}

export interface WalkedRow {
  row: RawEncounterRow;
  method: EncounterMethodId;
  requires: string[];
  subArea: string | null;
  /** A specific `catch/div` label such as "Attacking Oak"; generic group labels are dropped. */
  label: string | null;
}

export interface WalkResult {
  /** False when the page has no `Pokémon` → generation section. */
  found: boolean;
  rows: WalkedRow[];
  /** Prose before the first table, e.g. "Prior to Pokémon Yellow, no wild Pokémon appear while surfing here." */
  notes: string[];
  issues: Issue[];
}

export interface WalkOptions {
  pageTitle: string;
  generationHeading: string;
  locationKind: LocationKind;
  adapters: readonly CatchTemplateAdapter[];
}

/** `catch/div` labels that only name a method group; the method column already carries that information. */
const GROUP_LABELS = new Set([
  'fishing',
  'surfing',
  'walking',
  'grass',
  'cave',
  'gift pokémon',
  'gift pokemon',
  'special',
  'special pokémon',
  'special pokemon',
  'trade',
  'in-game trade',
]);

const LEVELED_CATEGORIES = new Set(['wild', 'water', 'fishing']);

type WalkEvent = { offset: number; heading: Heading } | { offset: number; template: TemplateCall };

export function walkEncounterSection(wikitext: string, options: WalkOptions): WalkResult {
  const text = stripComments(wikitext);
  const headings = parseHeadings(text);
  const section = findNestedSection(text, [/^Pok[eé]mon$/i, options.generationHeading], headings);
  const result: WalkResult = { found: section !== null, rows: [], notes: [], issues: [] };
  if (!section) return result;

  const issue = (level: Issue['level'], message: string) =>
    result.issues.push({ level, page: options.pageTitle, message });
  const adapterByName = new Map(
    options.adapters.flatMap((a) =>
      a.templateNames.map((name) => [name.toLowerCase(), a] as const),
    ),
  );

  const events: WalkEvent[] = [
    ...headingsWithin(headings, section).map((heading) => ({ offset: heading.start, heading })),
    ...findTemplates(text, section.start, section.end).map((template) => ({
      offset: template.start,
      template,
    })),
  ].sort((a, b) => a.offset - b.offset);

  // Notes end at the first table or sub-area; inline templates such as {{game|Yellow}} belong to the prose.
  const firstOffset =
    events.find((e) => 'heading' in e || e.template.name.startsWith('catch/'))?.offset ??
    section.end;
  result.notes = text
    .slice(section.start, firstOffset)
    .split(/\n\s*\n/)
    .map(stripMarkup)
    .filter((note) => note !== '');

  let subArea: string | null = null;
  let divLabel: string | null = null;

  for (const event of events) {
    if ('heading' in event) {
      subArea = headingText(event.heading);
      divLabel = null;
      continue;
    }
    const template = event.template;
    if (template.name === 'catch/header' || template.name === 'catch/footer') {
      divLabel = null;
      continue;
    }
    if (template.name === 'catch/div') {
      const label = stripMarkup(template.positional[1] ?? '');
      if (FLOOR_LABEL.test(label)) {
        subArea = label.toUpperCase();
        divLabel = null;
      } else {
        divLabel = label || null;
      }
      continue;
    }

    if (template.name === 'main') {
      issue('warning', `Section defers to another page: {{main|${template.positional[0] ?? ''}}}`);
      continue;
    }

    const adapter = adapterByName.get(template.name);
    if (!adapter) {
      if (template.name.startsWith('catch/entry')) {
        issue('warning', `Unhandled row template {{${template.name}}}`);
      }
      continue;
    }

    const source = text.slice(template.start, template.end);
    const ctx: WalkContext = {
      pageTitle: options.pageTitle,
      locationKind: options.locationKind,
      subArea,
      divLabel,
    };
    try {
      const row = adapter.parseRow(template, ctx);
      const normalized = adapter.normalizeMethod(row, ctx);
      const method = findMethod(normalized.method);
      if (!method)
        throw new AdapterError(`Adapter returned unknown method id "${normalized.method}"`);
      if (LEVELED_CATEGORIES.has(method.category) && row.slots.some((s) => s.levels === null)) {
        issue('error', `Unparseable levels "${row.slots[0]?.rawLevels ?? ''}" in ${source}`);
      }
      if (row.games.length === 0) issue('warning', `Row applies to no game: ${source}`);
      if (row.slots.length === 0) issue('warning', `Row has no encounter slots: ${source}`);
      result.rows.push({
        row,
        method: normalized.method,
        requires: normalized.requires ?? [],
        subArea: normalized.subArea ?? subArea,
        label: divLabel && !GROUP_LABELS.has(divLabel.toLowerCase()) ? divLabel : null,
      });
    } catch (error) {
      if (!(error instanceof AdapterError)) throw error;
      issue('error', `${error.message} in ${source}`);
    }
  }
  return result;
}
