import { GAMES } from '../games/registry';
import {
  crc16,
  decodeProfile,
  encodeName,
  encodeProfile,
  fromBase64Url,
  normalizeCode,
  toBase64Url,
  EXPORT_PREFIX,
  type ExportableProfile,
} from './export-codec';

/** A deterministic pseudo-random generator, so a failing property test is reproducible. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomCaught(random: () => number, max: number): number[] {
  const caught: number[] = [];
  for (let dex = 1; dex <= max; dex++) if (random() < 0.5) caught.push(dex);
  return caught;
}

/** Flips one character of a code to a different one from the alphabet. */
function corrupt(code: string, at: number): string {
  const character = code[at]!;
  const replacement = character === 'A' ? 'B' : 'A';
  return code.slice(0, at) + replacement + code.slice(at + 1);
}

describe('PKG1 export codec (plan §12.2)', () => {
  it('round-trips a profile', () => {
    const profile: ExportableProfile = {
      name: 'My Red run',
      game: 'red',
      caught: [1, 4, 25, 151],
      progressPart: 7,
    };
    const code = encodeProfile(profile);
    expect(code.startsWith(EXPORT_PREFIX)).toBe(true);

    const result = decodeProfile(code);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      name: 'My Red run',
      game: 'red',
      caught: [1, 4, 25, 151],
      progressPart: 7,
      dexCount: 151,
      ignoredBeyondDex: 0,
    });
  });

  it('stays within the length the plan promises for Red/Blue/Yellow', () => {
    const code = encodeProfile({
      name: 'Nuzlocke #2',
      game: 'yellow',
      caught: Array.from({ length: 151 }, (_, i) => i + 1),
    });
    // 6 header + 19 bitfield + 1 + 11 name + 2 CRC = 39 bytes → 52 base64url characters.
    expect(code.length).toBe(EXPORT_PREFIX.length + 52);
  });

  it('round-trips every registry game, empty and full, over many random states', () => {
    const random = rng(20260915);
    for (const game of GAMES) {
      for (const caught of [
        [],
        Array.from({ length: game.nationalDexMax }, (_, i) => i + 1),
        randomCaught(random, game.nationalDexMax),
        randomCaught(random, game.nationalDexMax),
      ]) {
        const profile: ExportableProfile = { name: game.name, game: game.id, caught };
        const result = decodeProfile(encodeProfile(profile));
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(result.value.game).toBe(game.id);
        expect(result.value.caught).toEqual(caught);
        expect(result.value.name).toBe(game.name);
        expect(result.value.progressPart).toBeUndefined();
      }
    }
  });

  it('drops caught numbers the game does not have', () => {
    const result = decodeProfile(encodeProfile({ name: 'x', game: 'red', caught: [151, 152, 0] }));
    expect(result.ok && result.value.caught).toEqual([151]);
  });

  it('keeps a name of exactly 32 bytes and truncates a longer one at a code point', () => {
    expect(encodeName('a'.repeat(32))).toHaveLength(32);
    expect(encodeName('a'.repeat(40))).toHaveLength(32);
    // Each emoji is 4 UTF-8 bytes, so 8 fit and the 9th is dropped whole.
    const emoji = encodeName('🔴'.repeat(9));
    expect(emoji).toHaveLength(32);
    expect(new TextDecoder().decode(emoji)).toBe('🔴'.repeat(8));
  });

  it('round-trips names outside ASCII', () => {
    const result = decodeProfile(encodeProfile({ name: 'Pokémon ⚡ ラン', game: 'red', caught: [] }));
    expect(result.ok && result.value.name).toBe('Pokémon ⚡ ラン');
  });

  it('accepts a share link, stray whitespace and zero-width characters', () => {
    const code = encodeProfile({ name: 'Trip', game: 'blue', caught: [7] });
    const messy = `https://example.com/poke-guide/import#${code}`
      .replace(/(.{20})/g, '$1\n ​')
      .concat('﻿');
    const result = decodeProfile(messy);
    expect(result.ok && result.value.name).toBe('Trip');
    expect(normalizeCode(`look: ${code}`)).toBe(code);
  });

  it('rejects anything that is not a code', () => {
    expect(decodeProfile('hello').ok).toBe(false);
    expect(decodeProfile('hello')).toMatchObject({ error: { kind: 'bad-prefix' } });
    expect(decodeProfile('PKG1-abc$%^')).toMatchObject({ error: { kind: 'bad-base64' } });
    expect(decodeProfile('PKG1-AAAA')).toMatchObject({ error: { kind: 'too-short' } });
  });

  it('detects a single wrong character anywhere in the code', () => {
    const code = encodeProfile({ name: 'Damaged', game: 'red', caught: [3, 9, 27] });
    for (let at = EXPORT_PREFIX.length; at < code.length; at++) {
      const result = decodeProfile(corrupt(code, at));
      expect(result.ok, `character ${at} slipped through`).toBe(false);
      // A flipped character can also shorten the payload or name; every outcome is still an error.
      expect(['bad-checksum', 'too-short', 'bad-name', 'unknown-game', 'unsupported-version'])
        .toContain(result.ok ? '' : result.error.kind);
    }
  });

  it('reports a newer format version and an unknown game, but only once the CRC agrees', () => {
    const valid = fromBase64Url(
      encodeProfile({ name: 'x', game: 'red', caught: [] }).slice(EXPORT_PREFIX.length),
    )!;

    const newer = Uint8Array.from(valid);
    newer[0] = 2;
    reseal(newer);
    expect(decodeProfile(EXPORT_PREFIX + toBase64Url(newer))).toMatchObject({
      error: { kind: 'unsupported-version' },
    });

    const unknown = Uint8Array.from(valid);
    new DataView(unknown.buffer).setUint16(1, 9999, true);
    reseal(unknown);
    expect(decodeProfile(EXPORT_PREFIX + toBase64Url(unknown))).toMatchObject({
      error: { kind: 'unknown-game' },
    });
  });

  it('ignores caught bits beyond the dex this build knows, and says how many', () => {
    // A code written by a later build of the same game, with a longer dex.
    const bitfieldLength = Math.ceil(400 / 8);
    const body = new Uint8Array(6 + bitfieldLength + 1);
    const view = new DataView(body.buffer);
    body[0] = 1;
    view.setUint16(1, 1, true); // red
    view.setUint16(4, 400, true);
    body[6] = 0b0000_0101; // #1 and #3
    body[6 + Math.floor(250 / 8)] = 1 << 250 % 8; // #251, beyond Gen I
    const code = EXPORT_PREFIX + toBase64Url(sealed(body));

    const result = decodeProfile(code);
    expect(result.ok && result.value).toMatchObject({
      game: 'red',
      caught: [1, 3],
      dexCount: 400,
      ignoredBeyondDex: 1,
    });
  });

  it('encodes base64url without padding, and round-trips arbitrary bytes', () => {
    expect(toBase64Url(new Uint8Array([251, 255, 190]))).toBe('-_--');
    for (let length = 0; length < 12; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 0xff);
      expect(toBase64Url(bytes)).not.toContain('=');
      expect([...fromBase64Url(toBase64Url(bytes))!]).toEqual([...bytes]);
    }
    expect(fromBase64Url('A')).toBeUndefined();
  });

  it('uses CRC-16/CCITT-FALSE', () => {
    // The standard check value for "123456789".
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0x29b1);
  });
});

/** Rewrites the trailing CRC of a code body that a test has edited. */
function reseal(bytes: Uint8Array): void {
  const body = bytes.subarray(0, bytes.length - 2);
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(
    bytes.length - 2,
    crc16(body),
    true,
  );
}

/** Appends a CRC to a hand-built body. */
function sealed(body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 2);
  out.set(body);
  new DataView(out.buffer).setUint16(body.length, crc16(body), true);
  return out;
}
