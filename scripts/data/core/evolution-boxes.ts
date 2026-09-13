/**
 * Evolution boxes on species pages (plan §7.6). The version group's evolution override is authoritative;
 * these boxes describe the latest games and are only diffed against it, producing warnings to triage.
 */
import type { EvolutionEdge } from '../../../src/app/core/domain/models';
import { replaceTemplates, stripMarkup } from './markup';
import { findNestedSection } from './sections';
import { findTemplates, stripComments } from './wikitext';

export interface ParsedEvolution {
  from: number;
  to: number;
  fromName: string;
  toName: string;
  trigger: EvolutionEdge['trigger'];
  level?: number;
  item?: string;
  heldItem?: string;
  /** The condition as plain text (`Level 16`, `Trade holding King's Rock`). */
  condition: string;
}

export interface EvolutionBoxParse {
  edges: ParsedEvolution[];
  /** Boxes, stages and edges that could not be read, e.g. Eevee's `{{Evobox/Setup}}` table. */
  skipped: string[];
}

interface Stage {
  dex: number;
  name: string;
}

/**
 * `{{Evobox-1/2/3}}`, `{{Evobox/1branch2}}` and `{{Evobox/2branch2}}` share one parameter scheme: stage keys
 * `1`, `2`, `2a`, `3b`… (`noK`, `nameK`, `formK`) and conditions `evoK` leading from stage `K` to the next.
 * Other `evobox` templates (`Evobox/Setup` tables, `Evobox/Meowth-Alola`) are skipped.
 */
const STANDARD_BOX = /^evobox(?:-\d|\/\dbranch\d)$/;
const EVO_KEY = /^evo(\d)([ab]?)$/;

/** The section is `Evolution data` on most pages, `[[Evolution]] data` or `Evolution` on some (Dewgong). */
const SECTION_PATH = ['Game data', /^Evolution(?: data)?$/] as const;

/** Item icons (`{{Bag/s|Rare Candy|SV}}`) would otherwise render as their item name. */
const ICON_TEMPLATES = new Set(['bag/s']);

function conditionText(raw: string): string {
  const withoutIcons = replaceTemplates(raw, (call) =>
    ICON_TEMPLATES.has(call.name) ? '' : raw.slice(call.start, call.end),
  );
  // Icons are joined with ` + ` (`{{Bag/s|Rare Candy|SV}} + {{Bag/s|Soothe Bell|SV}}`), which leaves leading pluses.
  return stripMarkup(withoutIcons).replace(/^(?:\+\s*)+/, '');
}

export function parseCondition(
  condition: string,
): Pick<ParsedEvolution, 'trigger' | 'level' | 'item' | 'heldItem'> {
  const level = /^Level (\d+)\b/.exec(condition);
  if (level) return { trigger: 'level', level: Number(level[1]) };
  if (/^Trade\b/.test(condition)) {
    const held = /^Trade holding (.+?)$/.exec(condition);
    return held ? { trigger: 'trade', heldItem: held[1]! } : { trigger: 'trade' };
  }
  if (/^Level up with high friendship\b/.test(condition)) return { trigger: 'friendship' };
  const stone = /^([A-Z][A-Za-z']* Stone)\b/.exec(condition);
  if (stone) return { trigger: 'item', item: stone[1]! };
  return { trigger: 'other' };
}

export function parseEvolutionBoxes(wikitext: string): EvolutionBoxParse {
  const text = stripComments(wikitext);
  const section = findNestedSection(text, SECTION_PATH);
  if (!section) return { edges: [], skipped: ['no "Game data → Evolution data" section'] };
  const edges: ParsedEvolution[] = [];
  const skipped: string[] = [];
  let boxes = 0;
  for (const call of findTemplates(text, section.start, section.end)) {
    if (!call.name.startsWith('evobox')) continue;
    boxes++;
    if (!STANDARD_BOX.test(call.name)) {
      // A layout table calls `{{Evobox/Setup}}` once per stage; report it once.
      const reason = `unsupported box {{${call.name}}}`;
      if (!skipped.includes(reason)) skipped.push(reason);
      continue;
    }
    const stage = (key: string): Stage | 'form' | null => {
      const name = stripMarkup(call.named[`name${key}`] ?? '');
      if (!name) return null;
      // Regional forms (`form2b=Alolan Form`) evolve differently and did not exist in early generations.
      if (stripMarkup(call.named[`form${key}`] ?? '')) return 'form';
      const dex = /^\d+/.exec(call.named[`no${key}`] ?? '');
      if (!dex) {
        skipped.push(`stage "${name}" has no number`);
        return null;
      }
      return { dex: Number(dex[0]), name };
    };
    for (const [key, raw] of Object.entries(call.named)) {
      const evo = EVO_KEY.exec(key);
      if (!evo || raw === '') continue;
      const step = Number(evo[1]);
      const branch = evo[2]!;
      // `evo2a` leads from stage `2a` in a branch-then-evolve box, otherwise from the shared stage `2`.
      const fromKey = branch && call.named[`name${step}${branch}`] ? `${step}${branch}` : `${step}`;
      const toKey =
        branch && call.named[`name${step + 1}${branch}`] ? `${step + 1}${branch}` : `${step + 1}`;
      const from = stage(fromKey);
      const to = stage(toKey);
      if (from === 'form' || to === 'form') continue;
      if (!from || !to) {
        skipped.push(`{{${call.name}}} ${key}: missing stage ${from ? toKey : fromKey}`);
        continue;
      }
      const condition = conditionText(raw);
      edges.push({
        from: from.dex,
        to: to.dex,
        fromName: from.name,
        toName: to.name,
        ...parseCondition(condition),
        condition,
      });
    }
  }
  if (boxes === 0) skipped.push('no evolution box in "Evolution data"');
  return { edges, skipped };
}

// ---- diff against the authoritative graph ----

export interface EvolutionBoxPage {
  dex: number;
  name: string;
  wikitext: string;
}

export interface EvolutionBoxDiff {
  /** Differences to triage: edges missing on either side, differing conditions, pages that disagree. */
  warnings: string[];
  /** Skipped layouts and override edges that no readable page covers. */
  notes: string[];
}

type Comparable = Pick<EvolutionEdge, 'trigger' | 'level' | 'item' | 'heldItem'>;

const describe = (e: Comparable) =>
  [
    e.trigger,
    e.level !== undefined && `level ${e.level}`,
    e.item,
    e.heldItem && `holding ${e.heldItem}`,
  ]
    .filter(Boolean)
    .join(', ');

/**
 * Compares the evolution boxes of `pages` with `authoritative`, keeping only edges whose species are both in
 * `speciesRange`. An override edge missing from the boxes is a warning when the page of either species was read
 * without skipping anything, and a note otherwise. Never throws for page content; parse failures become warnings.
 */
export function diffEvolutionBoxes(
  pages: readonly EvolutionBoxPage[],
  authoritative: readonly EvolutionEdge[],
  speciesRange: [number, number],
): EvolutionBoxDiff {
  const [min, max] = speciesRange;
  const inRange = (dex: number) => dex >= min && dex <= max;
  const warnings: string[] = [];
  const notes: string[] = [];
  const names = new Map(pages.map((p) => [p.dex, p.name]));
  const label = (dex: number) => `#${dex} ${names.get(dex) ?? '?'}`;
  const edgeLabel = (e: { from: number; to: number }) => `${label(e.from)} → ${label(e.to)}`;
  const fullyRead = new Set<number>();
  const parsed = new Map<string, { edge: ParsedEvolution; page: string }[]>();

  for (const page of pages) {
    let result: EvolutionBoxParse;
    try {
      result = parseEvolutionBoxes(page.wikitext);
    } catch (error) {
      warnings.push(`${page.name}: evolution boxes could not be parsed: ${String(error)}`);
      continue;
    }
    for (const reason of result.skipped) notes.push(`${page.name}: ${reason}`);
    if (result.skipped.length === 0) fullyRead.add(page.dex);
    for (const edge of result.edges) {
      if (!inRange(edge.from) || !inRange(edge.to)) continue;
      names.set(edge.from, names.get(edge.from) ?? edge.fromName);
      names.set(edge.to, names.get(edge.to) ?? edge.toName);
      const key = `${edge.from}>${edge.to}`;
      parsed.set(key, [...(parsed.get(key) ?? []), { edge, page: page.name }]);
    }
  }

  const overrides = new Map(authoritative.map((e) => [`${e.from}>${e.to}`, e]));
  for (const [key, found] of parsed) {
    const first = found[0]!.edge;
    const variants = new Set(found.map((f) => describe(f.edge)));
    if (variants.size > 1) {
      const detail = found.map((f) => `${f.page}: ${describe(f.edge)}`).join('; ');
      warnings.push(`${edgeLabel(first)}: evolution boxes disagree (${detail})`);
    }
    const override = overrides.get(key);
    if (!override) {
      warnings.push(
        `${edgeLabel(first)}: in evolution boxes (${first.condition}) but not in the override`,
      );
    } else if (!variants.has(describe(override))) {
      warnings.push(
        `${edgeLabel(first)}: override has ${describe(override)}, evolution boxes have ${[...variants].join(' / ')}`,
      );
    }
  }
  for (const [key, override] of overrides) {
    if (parsed.has(key) || !inRange(override.from) || !inRange(override.to)) continue;
    if (fullyRead.has(override.from) || fullyRead.has(override.to)) {
      warnings.push(`${edgeLabel(override)}: in the override but in no evolution box`);
    } else if (pages.some((p) => p.dex === override.from || p.dex === override.to)) {
      notes.push(`${edgeLabel(override)}: not checked, no readable evolution box covers it`);
    }
  }
  return { warnings, notes };
}
