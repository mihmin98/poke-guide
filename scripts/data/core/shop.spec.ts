import { fixture } from '../testing/fixtures';
import { parsePrizeShops } from './shop';

const options = {
  pageTitle: 'Celadon Game Corner',
  sectionPath: [/^Prize corner/i, 'Generation I'],
  games: ['red', 'blue', 'yellow'] as const,
  requires: ['coin-case'],
};

describe('parsePrizeShops', () => {
  const result = parsePrizeShops(fixture('rby', 'celadon-game-corner').wikitext, { ...options, games: [...options.games] });
  const prizes = (game: 'red' | 'blue' | 'yellow') =>
    result.rows
      .filter((r) => r.row.games.includes(game))
      .map((r) => {
        const slot = r.row.slots[0]!;
        return [r.row.name, slot.rate.kind === 'coins' ? slot.rate.value : null, slot.levels?.min];
      });

  it('reads the Generation I prizes per game and skips other versions', () => {
    expect(result.found).toBe(true);
    expect(result.issues).toEqual([]);
    expect(prizes('red')).toEqual([
      ['Abra', 180, 9],
      ['Clefairy', 500, 8],
      ['Nidorina', 1200, 17],
      ['Dratini', 2800, 18],
      ['Scyther', 5500, 25],
      ['Porygon', 9999, 26],
    ]);
    expect(prizes('blue')).toEqual([
      ['Abra', 120, 6],
      ['Clefairy', 750, 12],
      ['Nidorino', 1200, 17],
      ['Pinsir', 2500, 20],
      ['Dratini', 4600, 24],
      ['Porygon', 6500, 18],
    ]);
    expect(prizes('yellow')).toEqual([
      ['Abra', 230, 15],
      ['Vulpix', 1000, 18],
      ['Wigglytuff', 2680, 22],
      ['Scyther', 6500, 30],
      ['Pinsir', 6500, 30],
      ['Porygon', 9999, 26],
    ]);
    expect(result.rows.every((r) => r.method === 'prize' && r.requires.join() === 'coin-case')).toBe(true);
    expect(result.notes).toEqual([
      'Skipped prize shop for other versions: Pocket Monsters Blue',
      'Skipped prize shop for other versions: Pocket Monsters Blue',
      'Item prizes not listed yet: 3',
    ]);
  });

  it('reports a missing section and malformed rows', () => {
    expect(parsePrizeShops('==Other==\n', { ...options, games: ['red'] }).found).toBe(false);
    const bad = parsePrizeShops(
      '==Prize corner==\n===Generation I===\n{{shop|All versions}}\n{{shoprow|{{shopmon|Abra|063|x|lv=9}}}}\n{{shopfooter}}',
      { ...options, games: ['red'] },
    );
    expect(bad.issues.map((i) => i.message)).toEqual(['Malformed prize row: {{shopmon|Abra|063|x|lv=9}}']);
  });
});
