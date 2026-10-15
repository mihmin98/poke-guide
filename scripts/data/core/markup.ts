/** Turns wikitext fragments (cell values, labels, headings) into plain text. */
import { findTemplates, type TemplateCall } from './wikitext';

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&eacute;': 'é',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&[a-z]+;|&#39;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/** Link templates written `{{x|target|display text}}`. */
const LINK_TEMPLATES = new Set([
  'p',
  'm',
  'i',
  'a',
  't',
  'type',
  'ability',
  'item',
  'pkmn',
  'loc',
  'wp',
]);

/** Plain-text rendering of the templates that appear inside encounter tables, labels and notes. */
function renderTemplate(call: TemplateCall): string {
  const arg = (n: number) => stripMarkup(call.positional[n] ?? '');
  if (LINK_TEMPLATES.has(call.name)) return call.positional.length >= 2 ? arg(1) : arg(0);
  switch (call.name) {
    case 'pdollar':
      return '₽';
    case 'color2':
      // {{color2|<hex>|<link>|<text>}}: the text defaults to the link.
      return call.positional.length >= 3 ? arg(2) : arg(1);
    case 'color':
      // {{color|<hex>|<text>}}
      return arg(1);
    case 'rt':
      return `Route ${arg(0)}`;
    case 'game':
      return `Pokémon ${arg(0)}`;
    case 'scpkmn':
      return 'Pokémon';
    case 'scball':
      return 'Poké Ball';
    case 'pk':
      return 'PK';
    case 'mn':
      // {{PK}}{{MN}} Trainer: "PKMN Trainer".
      return 'MN';
    case 'obp':
      // {{OBP|<title>|<disambiguation>|<text>}}: the text defaults to the title.
      return call.positional.length >= 3 ? arg(2) : arg(0);
    default:
      // {{tt|text|tooltip}} and similar: the first argument is the visible text.
      return call.positional.length > 0 ? arg(0) : '';
  }
}

/** Replaces every top-level template in `text` using `render`. */
export function replaceTemplates(text: string, render: (call: TemplateCall) => string): string {
  let out = '';
  let last = 0;
  for (const call of findTemplates(text)) {
    out += text.slice(last, call.start) + render(call);
    last = call.end;
  }
  return out + text.slice(last);
}

export function stripMarkup(input: string): string {
  let text = input.replace(/<br\s*\/?>/gi, ' ');
  text = replaceTemplates(text, renderTemplate);
  text = text
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** Splits `{{tt|visible|tooltip}}` into its visible text (still wikitext) and the plain-text tooltip notes. */
export function splitTooltips(input: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const text = replaceTemplates(input, (call) => {
    if (call.name !== 'tt') return input.slice(call.start, call.end);
    const note = stripMarkup(call.positional[1] ?? '');
    if (note) notes.push(note);
    return call.positional[0] ?? '';
  });
  return { text, notes };
}
