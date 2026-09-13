import type { LocationKind } from '../../../src/app/core/domain/models';
import { entry1Adapter } from '../adapters/entry1';
import { fixture } from '../testing/fixtures';
import { walkEncounterSection } from './encounter-walker';

function walk(name: string, locationKind: LocationKind = 'route', wikitext?: string) {
  const page = fixture('rby', name);
  return walkEncounterSection(wikitext ?? page.wikitext, {
    pageTitle: page.resolvedTitle,
    generationHeading: 'Generation I',
    locationKind,
    adapters: [entry1Adapter],
  });
}

describe('walkEncounterSection on Red/Blue/Yellow fixtures', () => {
  it.each([
    ['route-1', 'route'],
    ['route-4', 'route'],
    ['route-12', 'route'],
    ['mt-moon', 'cave'],
    ['pokemon-tower', 'building'],
    ['pokemon-mansion', 'building'],
    ['silph-co', 'building'],
    ['cinnabar-island', 'town'],
    ['safari-zone', 'special'],
    ['cerulean-city', 'town'],
  ] as const)('walks %s without issues', (name, kind) => {
    const result = walk(name, kind);
    expect(result.found).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('reports pages without a section for the generation', () => {
    const result = walk('route-1', 'route', '==Pokémon==\n===Generation II===\n');
    expect(result).toEqual({ found: false, rows: [], notes: [], issues: [] });
  });

  it('takes sub-areas from headings (Mt. Moon, Safari Zone)', () => {
    expect([...new Set(walk('mt-moon', 'cave').rows.map((r) => r.subArea))]).toEqual(['1F', 'B1F', 'B2F']);
    expect([...new Set(walk('safari-zone', 'special').rows.map((r) => r.subArea))]).toEqual([
      'Center Area',
      'Area 1 - East',
      'Area 2 - North',
      'Area 3 - West',
    ]);
  });

  it('takes sub-areas from floor divs and floor method columns (Pokémon Tower)', () => {
    const rows = walk('pokemon-tower', 'building').rows;
    expect([...new Set(rows.map((r) => r.subArea))]).toEqual(['3F', '4F', '5F', '6F', '7F']);
    expect(new Set(rows.map((r) => r.method))).toEqual(new Set(['walk-building']));
  });

  it('finds the section at a deeper heading level (Silph Co.)', () => {
    const [lapras] = walk('silph-co', 'building').rows;
    expect(lapras).toMatchObject({ method: 'gift', label: null, row: { dex: 131, games: ['red', 'blue', 'yellow'] } });
  });

  it('reads two templates on one line (Cinnabar Island)', () => {
    const goodRod = walk('cinnabar-island', 'town').rows.filter((r) => r.method === 'fish-good');
    expect(goodRod.map((r) => r.row.dex)).toEqual([60, 118]);
  });

  it('keeps specific div labels and drops group labels (Route 1)', () => {
    const rows = walk('route-1').rows;
    expect(rows.find((r) => r.row.dex === 25)).toMatchObject({ method: 'special', label: 'Attacking Oak' });
    expect(rows.find((r) => r.row.dex === 16)?.label).toBeNull();
  });

  it('reads purchases, gifts with notes and trades (Route 4, Cerulean City)', () => {
    expect(walk('route-4').rows.find((r) => r.method === 'purchase')?.row.dex).toBe(129);
    const cerulean = walk('cerulean-city', 'town').rows;
    expect(cerulean.find((r) => r.method === 'gift')?.row.slots[0]?.note).toMatch(/friendship/);
    expect(cerulean.find((r) => r.method === 'trade')?.row.trade).toEqual({ giveDex: 61, giveName: 'Poliwhirl' });
  });

  it('collects prose before the table as notes (Route 12)', () => {
    expect(walk('route-12').notes).toEqual([
      'Prior to Pokémon Yellow, no wild Pokémon appear while the player is surfing here.',
    ]);
  });

  it('warns when a section defers to a subpage', () => {
    const result = walk('route-1', 'route', '==Pokémon==\n===Generation I===\n{{main|Indigo Plateau/Generation I}}\n');
    expect(result.issues).toEqual([
      { level: 'warning', page: 'Kanto Route 1', message: 'Section defers to another page: {{main|Indigo Plateau/Generation I}}' },
    ]);
  });

  it('reports unparseable wild levels, unknown methods and unhandled templates', () => {
    const wikitext = `==Pokémon==
===Generation I===
{{catch/entry1|016|Pidgey|yes|yes|yes|Grass|??|50%}}
{{catch/entry1|016|Pidgey|yes|yes|yes|Teleporter|5|50%}}
{{catch/entry2|016|Pidgey|yes|yes|yes|Grass|5|50%|50%|50%}}`;
    const result = walk('route-1', 'route', wikitext);
    expect(result.issues.map((i) => [i.level, i.message.split(' in ')[0]])).toEqual([
      ['error', 'Unparseable levels "??"'],
      ['error', 'Unknown method "Teleporter"'],
      ['warning', 'Unhandled row template {{catch/entry2}}'],
    ]);
  });
});
