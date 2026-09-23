import { qrSvg, type QrMatrix } from './qr-svg';

/** A matrix from rows of `#` (dark) and `.` (light). */
const matrix = (...rows: string[]): QrMatrix => ({
  getModuleCount: () => rows.length,
  isDark: (row, column) => rows[row]![column] === '#',
});

describe('qrSvg', () => {
  it('draws dark modules as merged horizontal runs inside the quiet zone', () => {
    const svg = qrSvg(matrix('##.', '...', '#.#'), 1);
    expect(svg.size).toBe(5);
    expect(svg.path).toBe('M1 1h2v1h-2zM1 3h1v1h-1zM3 3h1v1h-1z');
  });

  it('defaults to the 4-module quiet zone', () => {
    expect(qrSvg(matrix('#')).size).toBe(9);
    expect(qrSvg(matrix('#')).path).toBe('M4 4h1v1h-1z');
  });
});
