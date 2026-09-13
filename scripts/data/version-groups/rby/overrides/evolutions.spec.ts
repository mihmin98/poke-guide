import { RBY_EVOLUTIONS } from './evolutions';

describe('rby evolution override', () => {
  it('has the 72 Generation I evolutions, each pair once', () => {
    expect(RBY_EVOLUTIONS).toHaveLength(72);
    expect(new Set(RBY_EVOLUTIONS.map((e) => `${e.from}>${e.to}`)).size).toBe(72);
  });

  it('stays within #1–#151 and gives each species at most one pre-evolution', () => {
    for (const edge of RBY_EVOLUTIONS) {
      expect(edge.from).toBeGreaterThanOrEqual(1);
      expect(edge.to).toBeLessThanOrEqual(151);
      expect(edge.from).not.toBe(edge.to);
    }
    const targets = RBY_EVOLUTIONS.map((e) => e.to);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('only uses Generation I triggers, with their details', () => {
    for (const edge of RBY_EVOLUTIONS) {
      if (edge.trigger === 'level') expect(edge.level).toBeGreaterThan(0);
      else if (edge.trigger === 'item') expect(edge.item).toMatch(/^(Fire|Water|Thunder|Leaf|Moon) Stone$/);
      else expect(edge.trigger).toBe('trade');
      expect(edge.requiresTrade).toBe(edge.trigger === 'trade');
    }
  });

  it('marks exactly Alakazam, Machamp, Golem and Gengar as trade evolutions', () => {
    expect(RBY_EVOLUTIONS.filter((e) => e.requiresTrade).map((e) => e.to)).toEqual([65, 68, 76, 94]);
  });

  it('has Eevee branch three ways', () => {
    expect(RBY_EVOLUTIONS.filter((e) => e.from === 133).map((e) => [e.to, e.item])).toEqual([
      [134, 'Water Stone'],
      [135, 'Thunder Stone'],
      [136, 'Fire Stone'],
    ]);
  });
});
