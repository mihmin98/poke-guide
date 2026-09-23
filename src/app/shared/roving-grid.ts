/**
 * Roving focus for a wrapping grid of tiles (plan §13.9): one tab stop for the whole grid, arrow keys
 * move between tiles, Home and End jump to the ends.
 */

/** The tile index a key moves focus to, or `null` for keys the grid leaves alone. */
export function gridMove(
  key: string,
  index: number,
  count: number,
  columns: number,
): number | null {
  const last = count - 1;
  switch (key) {
    case 'ArrowRight':
      return Math.min(index + 1, last);
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'ArrowDown':
      return index + columns <= last ? index + columns : index;
    case 'ArrowUp':
      return index - columns >= 0 ? index - columns : index;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/** Tiles on the first row of a CSS grid that wraps to the viewport (`auto-fill`). */
export function columnCount(tiles: readonly HTMLElement[]): number {
  const top = tiles[0]?.offsetTop;
  const count = tiles.filter((tile) => tile.offsetTop === top).length;
  return Math.max(1, count);
}
