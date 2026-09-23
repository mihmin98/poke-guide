/** The part of a QR code generator the renderer needs (qrcode-generator's `QRCode`). */
export interface QrMatrix {
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
}

export interface QrSvg {
  /** Modules per side, including the quiet zone. */
  size: number;
  /** One path for every dark module, with horizontal runs merged. */
  path: string;
}

/**
 * A QR code as an SVG path, so it scales crisply and needs no `innerHTML`. The 4-module quiet zone is
 * the minimum the QR spec asks scanners to rely on.
 */
export function qrSvg(qr: QrMatrix, quietZone = 4): QrSvg {
  const count = qr.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < count; row++) {
    let column = 0;
    while (column < count) {
      if (!qr.isDark(row, column)) {
        column++;
        continue;
      }
      const start = column;
      while (column < count && qr.isDark(row, column)) column++;
      parts.push(
        `M${start + quietZone} ${row + quietZone}h${column - start}v1h-${column - start}z`,
      );
    }
  }
  return { size: count + 2 * quietZone, path: parts.join('') };
}

/** The share link as a QR code; the generator is loaded only when a code is first shown. */
export async function linkQrCode(link: string): Promise<QrSvg> {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(link, 'Byte');
  qr.make();
  return qrSvg(qr);
}
