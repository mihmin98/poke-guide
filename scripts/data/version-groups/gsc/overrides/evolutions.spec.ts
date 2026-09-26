import { GSC_EVOLUTIONS } from './evolutions';

describe('gsc evolution override', () => {
  it('has the 122 Generation II evolutions, each pair once, within #1–#251', () => {
    expect(GSC_EVOLUTIONS).toHaveLength(122);
    expect(new Set(GSC_EVOLUTIONS.map((e) => `${e.from}>${e.to}`)).size).toBe(122);
    for (const edge of GSC_EVOLUTIONS) {
      expect(edge.from).toBeGreaterThanOrEqual(1);
      expect(edge.to).toBeLessThanOrEqual(251);
    }
  });

  it('marks the ten trade evolutions, four of them without a held item', () => {
    const trades = GSC_EVOLUTIONS.filter((e) => e.requiresTrade);
    expect(trades.map((e) => e.to).sort((a, b) => a - b)).toEqual([
      65, 68, 76, 94, 186, 199, 208, 212, 230, 233,
    ]);
    expect(trades.filter((e) => !e.heldItem).map((e) => e.to)).toEqual([65, 68, 76, 94]);
    expect(GSC_EVOLUTIONS.every((e) => e.requiresTrade === (e.trigger === 'trade'))).toBe(true);
  });

  it('has the friendship evolutions, with Espeon by day and Umbreon by night', () => {
    const friendship = GSC_EVOLUTIONS.filter((e) => e.trigger === 'friendship');
    expect(friendship.map((e) => [e.from, e.to, e.timeOfDay])).toEqual([
      [42, 169, undefined],
      [113, 242, undefined],
      [133, 196, 'day'],
      [133, 197, 'night'],
      [172, 25, undefined],
      [173, 35, undefined],
      [174, 39, undefined],
      [175, 176, undefined],
    ]);
  });

  it('branches Tyrogue by Attack against Defense at level 20', () => {
    expect(
      GSC_EVOLUTIONS.filter((e) => e.from === 236).map((e) => [e.to, e.level, e.stat]),
    ).toEqual([
      [106, 20, 'atk>def'],
      [107, 20, 'atk<def'],
      [237, 20, 'atk=def'],
    ]);
  });
});
