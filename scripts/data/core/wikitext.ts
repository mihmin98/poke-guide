/**
 * Wikitext tokenizer: comment/ref stripping, headings, and a brace-matching template scanner.
 * Templates are found by matching `{{`/`}}`, never by line, because several can share one line.
 */

export interface TemplateCall {
  /** Normalized name: lowercased, `_` → space, no `Template:` prefix. `Catch/entry1` → `catch/entry1`. */
  name: string;
  /** Positional parameters, trimmed. `positional[0]` is parameter 1. */
  positional: string[];
  /** Named parameters, keys and values trimmed. */
  named: Record<string, string>;
  /** Offset of `{{` in the scanned text. */
  start: number;
  /** Offset just past the closing `}}`. */
  end: number;
}

export interface Heading {
  level: number;
  /** Raw title text between the `=` markers, trimmed. */
  title: string;
  /** Offset of the start of the heading line. */
  start: number;
  /** Offset of the end of the heading line (the `\n`, or the end of the text). */
  end: number;
}

const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const REF_SELF_CLOSING = /<ref\b[^>]*\/>/gi;
const REF = /<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi;

/** Removes `<!-- … -->` comments and `<ref>` footnotes. Do this before any other parsing. */
export function stripComments(text: string): string {
  return text.replace(COMMENT, '').replace(REF_SELF_CLOSING, '').replace(REF, '');
}

const HEADING = /^(={2,6})\s*(.+?)\s*\1\s*$/;

export function parseHeadings(text: string): Heading[] {
  const headings: Heading[] = [];
  let offset = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const match = HEADING.exec(line);
    if (match) {
      headings.push({
        level: match[1]!.length,
        title: match[2]!,
        start: offset,
        end: offset + rawLine.length,
      });
    }
    offset += rawLine.length + 1;
  }
  return headings;
}

/** Returns the offset just past the `}}` matching the `{{` at `open`, or -1 if unbalanced. */
function matchBraces(text: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    if (text.startsWith('{{', i)) {
      depth++;
      i += 2;
    } else if (text.startsWith('}}', i)) {
      depth--;
      i += 2;
      if (depth === 0) return i;
    } else {
      i++;
    }
  }
  return -1;
}

/**
 * Finds the index of `char` outside nested `{{…}}` and `[[…]]`, starting at `from`.
 * Returns -1 when there is none.
 */
function indexOfTopLevel(text: string, char: string, from = 0): number {
  let templates = 0;
  let links = 0;
  for (let i = from; i < text.length; i++) {
    if (text.startsWith('{{', i)) {
      templates++;
      i++;
    } else if (text.startsWith('}}', i) && templates > 0) {
      templates--;
      i++;
    } else if (text.startsWith('[[', i)) {
      links++;
      i++;
    } else if (text.startsWith(']]', i) && links > 0) {
      links--;
      i++;
    } else if (text[i] === char && templates === 0 && links === 0) {
      return i;
    }
  }
  return -1;
}

/** Splits on `separator` only outside nested templates and links. */
export function splitTopLevel(text: string, separator = '|'): string[] {
  const parts: string[] = [];
  let last = 0;
  for (
    let i = indexOfTopLevel(text, separator);
    i !== -1;
    i = indexOfTopLevel(text, separator, last)
  ) {
    parts.push(text.slice(last, i));
    last = i + 1;
  }
  parts.push(text.slice(last));
  return parts;
}

export function normalizeTemplateName(raw: string): string {
  return raw
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^template:/i, '')
    .toLowerCase();
}

const NAMED_KEY = /^[^{}[\]<>|]+$/;

function parseTemplateCall(text: string, start: number, end: number): TemplateCall {
  const [rawName = '', ...params] = splitTopLevel(text.slice(start + 2, end - 2));
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const param of params) {
    const eq = indexOfTopLevel(param, '=');
    const key = eq > 0 ? param.slice(0, eq).trim() : '';
    if (key && NAMED_KEY.test(key)) {
      named[key] = param.slice(eq + 1).trim();
    } else {
      positional.push(param.trim());
    }
  }
  return { name: normalizeTemplateName(rawName), positional, named, start, end };
}

/** Top-level template calls in `text[from, to)`, in document order. Nested calls stay inside their parent's parameters. */
export function findTemplates(text: string, from = 0, to = text.length): TemplateCall[] {
  const calls: TemplateCall[] = [];
  let i = from;
  while (i < to) {
    const open = text.indexOf('{{', i);
    if (open === -1 || open >= to) break;
    const close = matchBraces(text, open);
    if (close === -1 || close > to) {
      // Unbalanced: skip this opener so one broken template doesn't hide the rest.
      i = open + 2;
      continue;
    }
    calls.push(parseTemplateCall(text, open, close));
    i = close;
  }
  return calls;
}

/** Parses a single template string such as `{{p|Pikachu}}`. */
export function parseTemplate(raw: string): TemplateCall | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{{')) return null;
  return matchBraces(trimmed, 0) === trimmed.length
    ? parseTemplateCall(trimmed, 0, trimmed.length)
    : null;
}
