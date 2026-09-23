import { gridMove } from './roving-grid';

describe('gridMove', () => {
  // 10 tiles, 4 per row:  0 1 2 3 / 4 5 6 7 / 8 9
  const move = (key: string, index: number) => gridMove(key, index, 10, 4);

  it('moves along and across rows, stopping at the edges', () => {
    expect(move('ArrowRight', 3)).toBe(4);
    expect(move('ArrowRight', 9)).toBe(9);
    expect(move('ArrowLeft', 0)).toBe(0);
    expect(move('ArrowDown', 1)).toBe(5);
    expect(move('ArrowDown', 6)).toBe(6);
    expect(move('ArrowUp', 9)).toBe(5);
    expect(move('ArrowUp', 2)).toBe(2);
  });

  it('jumps to the ends and ignores other keys', () => {
    expect(move('Home', 7)).toBe(0);
    expect(move('End', 2)).toBe(9);
    expect(move('Enter', 2)).toBeNull();
    expect(move(' ', 2)).toBeNull();
  });
});
