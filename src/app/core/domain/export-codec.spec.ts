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
  MAX_ITEM_NUMBER,
  MAX_MILESTONE_NUMBER,
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
    const result = decodeProfile(
      encodeProfile({ name: 'Pokémon ⚡ ラン', game: 'red', caught: [] }),
    );
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
      expect([
        'bad-checksum',
        'too-short',
        'bad-name',
        'unknown-game',
        'unsupported-version',
      ]).toContain(result.ok ? '' : result.error.kind);
    }
  });

  it('reports a newer format version and an unknown game, but only once the CRC agrees', () => {
    const valid = fromBase64Url(
      encodeProfile({ name: 'x', game: 'red', caught: [] }).slice(EXPORT_PREFIX.length),
    )!;

    const newer = Uint8Array.from(valid);
    newer[0] = 4;
    reseal(newer);
    for (const prefix of ['PKG1-', 'PKG4-']) {
      expect(decodeProfile(prefix + toBase64Url(newer))).toMatchObject({
        error: { kind: 'unsupported-version' },
      });
    }

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
    body[6 + Math.floor(250 / 8)] = 1 << (250 % 8); // #251, beyond Gen I
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

describe('PKG2 export codec: items taken (Phase 9)', () => {
  const RED: ExportableProfile = {
    name: 'My Red run',
    game: 'red',
    caught: [1, 4, 25, 151],
    progressPart: 7,
  };

  it('round-trips the items taken, sorted and unique', () => {
    const code = encodeProfile({ ...RED, itemsTaken: [235, 3, 17, 3] });
    expect(code.startsWith('PKG2-')).toBe(true);
    const result = decodeProfile(code);
    expect(result.ok && result.value).toEqual({
      name: 'My Red run',
      game: 'red',
      caught: [1, 4, 25, 151],
      progressPart: 7,
      dexCount: 151,
      ignoredBeyondDex: 0,
      itemsTaken: [3, 17, 235],
      milestonesDone: [],
    });
  });

  it('still writes the exact PKG1 code when no items are taken', () => {
    const withoutField = encodeProfile(RED);
    expect(withoutField.startsWith(EXPORT_PREFIX)).toBe(true);
    expect(encodeProfile({ ...RED, itemsTaken: [] })).toBe(withoutField);
    // Numbers the format can't hold are dropped, so they don't force a PKG2 code either.
    expect(encodeProfile({ ...RED, itemsTaken: [0, -1, 2.5, MAX_ITEM_NUMBER + 1] })).toBe(
      withoutField,
    );
    expect(decodeProfile(withoutField)).toMatchObject({ ok: true, value: { itemsTaken: [] } });
  });

  it('keeps decoding this fixed code forever', () => {
    // Pinned: codes in the wild must keep meaning the same thing. Checked by hand: 02 | 01 00 (red) |
    // 00 | 97 00 (151) | 08, 17 × 00, 40 (#4, #151) | 20 00 (32) | 80 00 01 80 (8, 17, 32) | 04 "Trip" | CRC.
    const code = 'PKG2-AgEAAJcACAAAAAAAAAAAAAAAAAAAAAAAQCAAgAABgARUcmlw6gs';
    expect(
      encodeProfile({ name: 'Trip', game: 'red', caught: [4, 151], itemsTaken: [8, 17, 32] }),
    ).toBe(code);
    expect(decodeProfile(code)).toMatchObject({
      ok: true,
      value: { name: 'Trip', game: 'red', caught: [4, 151], itemsTaken: [8, 17, 32] },
    });
  });

  it('adds about 43 characters with every Red/Blue/Yellow item taken', () => {
    const everything = {
      name: 'Nuzlocke #2',
      game: 'yellow' as const,
      caught: Array.from({ length: 151 }, (_, i) => i + 1),
    };
    const items = Array.from({ length: 235 }, (_, i) => i + 1);
    const pkg1 = encodeProfile(everything);
    const pkg2 = encodeProfile({ ...everything, itemsTaken: items });
    // 39 bytes + 2 itemCount + 30 bitfield = 71 bytes → 95 base64url characters.
    expect(pkg2.length - pkg1.length).toBe(43);
    expect(decodeProfile(pkg2)).toMatchObject({ ok: true, value: { itemsTaken: items } });
  });

  it('round-trips random item sets for every registry game', () => {
    const random = rng(20260923);
    for (const game of GAMES) {
      for (let round = 0; round < 10; round++) {
        const itemsTaken = randomCaught(random, 1 + Math.floor(random() * 600));
        const caught = randomCaught(random, game.nationalDexMax);
        const result = decodeProfile(
          encodeProfile({ name: 'R', game: game.id, caught, itemsTaken }),
        );
        expect(result.ok && result.value.itemsTaken).toEqual(itemsTaken);
        expect(result.ok && result.value.caught).toEqual(caught);
      }
    }
  });

  it('never reads a different profile from a code with one wrong character', () => {
    const code = encodeProfile({ ...RED, itemsTaken: [2, 40, 199] });
    const original = decodeProfile(code);
    for (let at = 'PKG2-'.length; at < code.length; at++) {
      const result = decodeProfile(corrupt(code, at));
      // The last character may only change base64 padding bits, which decode to the same bytes.
      if (result.ok) expect(result, `character ${at} changed the profile`).toEqual(original);
      else expect(result.error.kind).not.toBe('bad-prefix');
    }
  });

  it('rejects a prefix that disagrees with the format byte', () => {
    const pkg2 = encodeProfile({ ...RED, itemsTaken: [5] });
    const pkg1 = encodeProfile(RED);
    expect(decodeProfile('PKG1-' + pkg2.slice(5))).toMatchObject({ error: { kind: 'bad-prefix' } });
    expect(decodeProfile('PKG2-' + pkg1.slice(5))).toMatchObject({ error: { kind: 'bad-prefix' } });
  });

  it('reads an empty item block, and rejects a truncated one', () => {
    const bitfieldLength = Math.ceil(151 / 8);
    const empty = new Uint8Array(6 + bitfieldLength + 2 + 1);
    const view = new DataView(empty.buffer);
    empty[0] = 2;
    view.setUint16(1, 1, true);
    view.setUint16(4, 151, true);
    expect(decodeProfile('PKG2-' + toBase64Url(sealed(empty)))).toMatchObject({
      ok: true,
      value: { itemsTaken: [], name: '' },
    });

    const truncated = Uint8Array.from(empty);
    new DataView(truncated.buffer).setUint16(6 + bitfieldLength, 800, true);
    expect(decodeProfile('PKG2-' + toBase64Url(sealed(truncated)))).toMatchObject({
      error: { kind: 'too-short' },
    });
  });

  it('finds the last code of either format in pasted text', () => {
    const code = encodeProfile({ ...RED, itemsTaken: [1] });
    expect(normalizeCode(`old: PKG1-xyz new: https://x.test/import#${code}`)).toBe(code);
    expect(normalizeCode(code.toLowerCase().replace('pkg2-', 'pkg2-'))).toMatch(/^pkg2-/);
  });
});

describe('PKG3 export codec: story milestones done (Phase 11)', () => {
  const RED: ExportableProfile = {
    name: 'My Red run',
    game: 'red',
    caught: [1, 4, 25, 151],
    progressPart: 7,
  };

  it('round-trips the milestones done, with and without items', () => {
    const code = encodeProfile({ ...RED, itemsTaken: [17, 3], milestonesDone: [60, 6, 1, 6] });
    expect(code.startsWith('PKG3-')).toBe(true);
    expect(decodeProfile(code)).toEqual({
      ok: true,
      value: {
        name: 'My Red run',
        game: 'red',
        caught: [1, 4, 25, 151],
        progressPart: 7,
        dexCount: 151,
        ignoredBeyondDex: 0,
        itemsTaken: [3, 17],
        milestonesDone: [1, 6, 60],
      },
    });
    const milestonesOnly = encodeProfile({ ...RED, milestonesDone: [2] });
    expect(milestonesOnly.startsWith('PKG3-')).toBe(true);
    expect(decodeProfile(milestonesOnly)).toMatchObject({
      ok: true,
      value: { itemsTaken: [], milestonesDone: [2] },
    });
  });

  it('still writes the exact PKG1 or PKG2 code when no milestone is done', () => {
    const pkg1 = encodeProfile(RED);
    const pkg2 = encodeProfile({ ...RED, itemsTaken: [5] });
    expect(encodeProfile({ ...RED, milestonesDone: [] })).toBe(pkg1);
    expect(encodeProfile({ ...RED, itemsTaken: [5], milestonesDone: [] })).toBe(pkg2);
    // Numbers the format can't hold are dropped, so they don't force a PKG3 code either.
    expect(encodeProfile({ ...RED, milestonesDone: [0, -1, 2.5, MAX_MILESTONE_NUMBER + 1] })).toBe(
      pkg1,
    );
    expect(decodeProfile(pkg1)).toMatchObject({ ok: true, value: { milestonesDone: [] } });
    expect(decodeProfile(pkg2)).toMatchObject({ ok: true, value: { milestonesDone: [] } });
  });

  it('keeps decoding this fixed code forever', () => {
    // Pinned, checked byte by byte: 03 | 01 00 (red) | 00 | 97 00 (151) | 08, 17 × 00, 40 (#4, #151) |
    // 08 00 (8) | 80 (item 8) | 06 00 (6) | 21 (milestones 1 and 6) | 04 "Trip" | CRC.
    const profile = {
      name: 'Trip',
      game: 'red' as const,
      caught: [4, 151],
      itemsTaken: [8],
      milestonesDone: [1, 6],
    };
    const code = 'PKG3-AwEAAJcACAAAAAAAAAAAAAAAAAAAAAAAQAgAgAYAIQRUcmlwfbY';
    expect(encodeProfile(profile)).toBe(code);
    const bytes = fromBase64Url(code.slice('PKG3-'.length))!;
    expect(bytes).toHaveLength(38);
    expect([...bytes.subarray(0, 6)]).toEqual([3, 1, 0, 0, 0x97, 0]);
    expect([...bytes.subarray(25, 36)]).toEqual([
      0x08, 0x00, 0x80, 0x06, 0x00, 0x21, 0x04, 0x54, 0x72, 0x69, 0x70,
    ]);
    expect(decodeProfile(code)).toMatchObject({ ok: true, value: profile });
  });

  it('adds about 16 characters with every Red/Blue/Yellow milestone done', () => {
    const everything = {
      name: 'Nuzlocke #2',
      game: 'yellow' as const,
      caught: Array.from({ length: 151 }, (_, i) => i + 1),
    };
    const milestones = Array.from({ length: 60 }, (_, i) => i + 1);
    const pkg1 = encodeProfile(everything);
    const pkg3 = encodeProfile({ ...everything, milestonesDone: milestones });
    // 39 bytes + 2 (empty item block) + 2 milestoneCount + 8 bitfield = 51 bytes → 68 characters.
    expect(pkg3.length - pkg1.length).toBe(16);
    expect(decodeProfile(pkg3)).toMatchObject({ ok: true, value: { milestonesDone: milestones } });
  });

  it('round-trips random item and milestone sets for every registry game', () => {
    const random = rng(20261013);
    for (const game of GAMES) {
      for (let round = 0; round < 10; round++) {
        const itemsTaken =
          round % 3 === 0 ? [] : randomCaught(random, 1 + Math.floor(random() * 600));
        const milestonesDone = randomCaught(random, 1 + Math.floor(random() * 200));
        const caught = randomCaught(random, game.nationalDexMax);
        const result = decodeProfile(
          encodeProfile({ name: 'R', game: game.id, caught, itemsTaken, milestonesDone }),
        );
        expect(result.ok && result.value).toMatchObject({ caught, itemsTaken, milestonesDone });
      }
    }
  });

  it('never reads a different profile from a code with one wrong character', () => {
    const code = encodeProfile({ ...RED, itemsTaken: [2, 40], milestonesDone: [3, 59] });
    const original = decodeProfile(code);
    for (let at = 'PKG3-'.length; at < code.length; at++) {
      const result = decodeProfile(corrupt(code, at));
      if (result.ok) expect(result, `character ${at} changed the profile`).toEqual(original);
      else expect(result.error.kind).not.toBe('bad-prefix');
    }
  });

  it('rejects a prefix that disagrees with the format byte', () => {
    const pkg3 = encodeProfile({ ...RED, milestonesDone: [5] });
    const pkg2 = encodeProfile({ ...RED, itemsTaken: [5] });
    expect(decodeProfile('PKG2-' + pkg3.slice(5))).toMatchObject({ error: { kind: 'bad-prefix' } });
    expect(decodeProfile('PKG3-' + pkg2.slice(5))).toMatchObject({ error: { kind: 'bad-prefix' } });
  });

  it('rejects a truncated milestone block', () => {
    const bitfieldLength = Math.ceil(151 / 8);
    const body = new Uint8Array(6 + bitfieldLength + 2 + 2 + 1);
    const view = new DataView(body.buffer);
    body[0] = 3;
    view.setUint16(1, 1, true);
    view.setUint16(4, 151, true);
    expect(decodeProfile('PKG3-' + toBase64Url(sealed(body)))).toMatchObject({
      ok: true,
      value: { itemsTaken: [], milestonesDone: [], name: '' },
    });
    view.setUint16(6 + bitfieldLength + 2, 500, true);
    expect(decodeProfile('PKG3-' + toBase64Url(sealed(body)))).toMatchObject({
      error: { kind: 'too-short' },
    });
    // A PKG3 body that stops after the item block.
    const short = body.subarray(0, 6 + bitfieldLength + 2);
    expect(decodeProfile('PKG3-' + toBase64Url(sealed(short)))).toMatchObject({
      error: { kind: 'too-short' },
    });
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
