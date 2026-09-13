import type { EvolutionEdge } from '../../../src/app/core/domain/models';
import { fixture } from '../testing/fixtures';
import { RBY_EVOLUTIONS } from '../version-groups/rby/overrides/evolutions';
import {
  diffEvolutionBoxes,
  parseCondition,
  parseEvolutionBoxes,
  type EvolutionBoxPage,
} from './evolution-boxes';

const page = (name: string) => fixture('rby', name).wikitext;
const pageFor = (dex: number, name: string): EvolutionBoxPage => ({
  dex,
  name,
  wikitext: page(name.toLowerCase()),
});
const pick = (e: {
  from: number;
  to: number;
  trigger: string;
  level?: number;
  item?: string;
  heldItem?: string;
}) => ({
  from: e.from,
  to: e.to,
  trigger: e.trigger,
  ...(e.level !== undefined && { level: e.level }),
  ...(e.item && { item: e.item }),
  ...(e.heldItem && { heldItem: e.heldItem }),
});

describe('parseCondition', () => {
  it('reads levels, trades, friendship and stones', () => {
    expect(parseCondition('Level 16')).toEqual({ trigger: 'level', level: 16 });
    expect(parseCondition('Level 28 outside of Alola')).toEqual({ trigger: 'level', level: 28 });
    expect(parseCondition('Trade → Linking Cord LA only')).toEqual({ trigger: 'trade' });
    expect(parseCondition("Trade holding King's Rock")).toEqual({
      trigger: 'trade',
      heldItem: "King's Rock",
    });
    expect(parseCondition('Level up with high friendship')).toEqual({ trigger: 'friendship' });
    expect(parseCondition('Thunder Stone outside of Alola')).toEqual({
      trigger: 'item',
      item: 'Thunder Stone',
    });
    expect(parseCondition('Galarica Cuff')).toEqual({ trigger: 'other' });
  });
});

describe('parseEvolutionBoxes', () => {
  it('reads a three-stage box without the item icon text (Venusaur)', () => {
    const { edges, skipped } = parseEvolutionBoxes(page('venusaur'));
    expect(skipped).toEqual([]);
    expect(edges.map(pick)).toEqual([
      { from: 1, to: 2, trigger: 'level', level: 16 },
      { from: 2, to: 3, trigger: 'level', level: 32 },
    ]);
    expect(edges[0]).toMatchObject({
      fromName: 'Bulbasaur',
      toName: 'Ivysaur',
      condition: 'Level 16',
    });
  });

  it('reads a trade whose box also mentions a later-game item (Kadabra)', () => {
    expect(parseEvolutionBoxes(page('kadabra')).edges.map(pick)).toEqual([
      { from: 63, to: 64, trigger: 'level', level: 16 },
      { from: 64, to: 65, trigger: 'trade' },
    ]);
  });

  it('follows branches and skips regional-form stages (Pikachu)', () => {
    const { edges, skipped } = parseEvolutionBoxes(page('pikachu'));
    expect(skipped).toEqual([]);
    expect(edges.map(pick)).toEqual([
      { from: 172, to: 25, trigger: 'friendship' },
      { from: 25, to: 26, trigger: 'item', item: 'Thunder Stone' },
    ]);
  });

  it('skips regional-form boxes in their own subsection (Slowpoke, Rattata)', () => {
    expect(parseEvolutionBoxes(page('slowpoke')).edges.map(pick)).toEqual([
      { from: 79, to: 80, trigger: 'level', level: 37 },
      { from: 79, to: 199, trigger: 'trade', heldItem: "King's Rock" },
    ]);
    expect(parseEvolutionBoxes(page('rattata')).edges.map(pick)).toEqual([
      { from: 19, to: 20, trigger: 'level', level: 20 },
    ]);
  });

  it('finds a section titled "Evolution" and ignores the one under Biology (Dewgong)', () => {
    expect(parseEvolutionBoxes(page('dewgong')).edges.map(pick)).toEqual([
      { from: 86, to: 87, trigger: 'level', level: 34 },
    ]);
  });

  it('reports the Evobox/Setup table as skipped (Eevee)', () => {
    expect(parseEvolutionBoxes(page('eevee'))).toEqual({
      edges: [],
      skipped: ['unsupported box {{evobox/setup}}'],
    });
  });
});

describe('diffEvolutionBoxes', () => {
  const gen1 = (...dex: number[]) =>
    RBY_EVOLUTIONS.filter((e) => dex.includes(e.from) || dex.includes(e.to));

  it('is silent when the boxes match the override, ignoring out-of-range species', () => {
    const pages = [pageFor(25, 'Pikachu'), pageFor(64, 'Kadabra'), pageFor(79, 'Slowpoke')];
    expect(diffEvolutionBoxes(pages, gen1(25, 64, 79), [1, 151])).toEqual({
      warnings: [],
      notes: [],
    });
  });

  it('checks Eevee edges through the Eeveelution pages, and only notes what no readable page covers', () => {
    const eevee = pageFor(133, 'Eevee');
    const vaporeonEdge = RBY_EVOLUTIONS.filter((e) => e.to === 134);
    expect(diffEvolutionBoxes([eevee, pageFor(134, 'Vaporeon')], vaporeonEdge, [1, 151])).toEqual({
      warnings: [],
      notes: ['Eevee: unsupported box {{evobox/setup}}'],
    });
    expect(diffEvolutionBoxes([eevee], vaporeonEdge, [1, 151]).notes).toContain(
      '#133 Eevee → #134 ?: not checked, no readable evolution box covers it',
    );
  });

  it('warns about differing conditions and edges missing on either side', () => {
    const wrong: EvolutionEdge[] = [
      { from: 63, to: 64, trigger: 'level', level: 18, requiresTrade: false },
      { from: 64, to: 99, trigger: 'trade', requiresTrade: true },
    ];
    expect(diffEvolutionBoxes([pageFor(64, 'Kadabra')], wrong, [1, 151]).warnings).toEqual([
      '#63 Abra → #64 Kadabra: override has level, level 18, evolution boxes have level, level 16',
      '#64 Kadabra → #65 Alakazam: in evolution boxes (Trade → Linking Cord LA only) but not in the override',
      '#64 Kadabra → #99 ?: in the override but in no evolution box',
    ]);
  });
});
