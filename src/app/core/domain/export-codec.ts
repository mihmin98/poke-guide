// FRAMEWORK-FREE: the `PKG1` export code (plan §12.2). No Angular imports.
//
// This is a **compatibility contract**: every code ever produced must keep decoding. The layout,
// the CRC and the `codecId` values are therefore fixed forever. A change means a new prefix
// (`PKG2`), never an edit here.
//
// | Offset | Size   | Field                                                      |
// |--------|--------|------------------------------------------------------------|
// | 0      | 1      | format version = 1                                          |
// | 1      | 2      | game `codecId` (uint16 LE)                                  |
// | 3      | 1      | `progressPart` (0 = unset)                                  |
// | 4      | 2      | `dexCount` N (uint16 LE)                                    |
// | 6      | ⌈N/8⌉  | caught bitfield, bit i = National Dex #(i + 1), LSB first    |
// | …      | 1      | name length n (0–32 bytes)                                  |
// | …      | n      | name, UTF-8                                                 |
// | last   | 2      | CRC-16/CCITT-FALSE over every previous byte (uint16 LE)     |
import { findGameByCodecId, getGame } from '../games/registry';
import type { GameId } from '../games/types';
import type { Profile } from './models';

export const EXPORT_PREFIX = 'PKG1-';
export const EXPORT_FORMAT_VERSION = 1;
/** The name field is a single byte, and profile names are capped at 32 characters anyway. */
export const MAX_NAME_BYTES = 32;

export type CodecErrorKind =
  | 'bad-prefix'
  | 'bad-base64'
  | 'too-short'
  | 'bad-checksum'
  | 'unsupported-version'
  | 'unknown-game'
  | 'bad-name';

export interface CodecError {
  kind: CodecErrorKind;
  /** Ready to show to the user. */
  message: string;
}

export interface DecodedProfile {
  name: string;
  game: GameId;
  /** Sorted, unique, and already narrowed to the game's `nationalDexMax`. */
  caught: number[];
  progressPart?: number;
  /** The `dexCount` the code was written with, which may differ from this build's registry. */
  dexCount: number;
  /** Caught species the code carried beyond this game's `nationalDexMax`, and that were dropped. */
  ignoredBeyondDex: number;
}

export type CodecResult =
  | { ok: true; value: DecodedProfile }
  | { ok: false; error: CodecError };

const ERROR_MESSAGES: Record<CodecErrorKind, string> = {
  'bad-prefix': 'That doesn’t look like a Poké Guide code. Codes start with “PKG1-”.',
  'bad-base64': 'This code contains characters that don’t belong in it. Copy it again.',
  'too-short': 'This code is incomplete. Copy the whole thing and try again.',
  'bad-checksum': 'This code is damaged — a character is wrong or missing. Copy it again.',
  'unsupported-version': 'This code was made by a newer version of Poké Guide.',
  'unknown-game': 'This code is for a game this version of Poké Guide doesn’t support yet.',
  'bad-name': 'This code carries a profile name that could not be read.',
};

function fail(kind: CodecErrorKind): { ok: false; error: CodecError } {
  return { ok: false, error: { kind, message: ERROR_MESSAGES[kind] } };
}

/** CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no reflection, no final XOR. */
export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const REVERSE = new Map([...ALPHABET].map((character, index) => [character, index]));

/** base64url without padding. Written out so the codec doesn't depend on `btoa`'s latin1 quirks. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 0x03) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += ALPHABET[((b & 0x0f) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += ALPHABET[c & 0x3f];
  }
  return out;
}

/** `undefined` when the text holds a character outside the base64url alphabet. */
export function fromBase64Url(text: string): Uint8Array | undefined {
  const values: number[] = [];
  for (const character of text) {
    const value = REVERSE.get(character);
    if (value === undefined) return undefined;
    values.push(value);
  }
  // Every 4 characters carry 3 bytes; a trailing single character can't complete one.
  if (values.length % 4 === 1) return undefined;
  const bytes = new Uint8Array(Math.floor((values.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let at = 0;
  for (const value of values) {
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[at++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/** Cuts a UTF-8 name to at most `MAX_NAME_BYTES`, never splitting a code point. */
export function encodeName(name: string): Uint8Array {
  const encoder = new TextEncoder();
  let text = name;
  let bytes = encoder.encode(text);
  while (bytes.length > MAX_NAME_BYTES) {
    // Slicing by code point (not by UTF-16 unit) keeps surrogate pairs whole.
    text = [...text].slice(0, -1).join('');
    bytes = encoder.encode(text);
  }
  return bytes;
}

export type ExportableProfile = Pick<Profile, 'name' | 'game' | 'caught'> &
  Partial<Pick<Profile, 'progressPart'>>;

/** The `PKG1-…` code for one profile. Caught numbers outside the game's dex range are dropped. */
export function encodeProfile(profile: ExportableProfile): string {
  const game = getGame(profile.game);
  const dexCount = game.nationalDexMax;
  const bitfieldLength = Math.ceil(dexCount / 8);
  const name = encodeName(profile.name);

  const body = new Uint8Array(6 + bitfieldLength + 1 + name.length);
  const bodyView = new DataView(body.buffer);
  body[0] = EXPORT_FORMAT_VERSION;
  bodyView.setUint16(1, game.codecId, true);
  // A part above 255 can't be stored; the registry's walkthroughs are far shorter than that.
  body[3] = Math.min(Math.max(profile.progressPart ?? 0, 0), 255);
  bodyView.setUint16(4, dexCount, true);
  for (const dex of profile.caught) {
    if (!Number.isInteger(dex) || dex < 1 || dex > dexCount) continue;
    const index = dex - 1;
    body[6 + (index >> 3)]! |= 1 << (index & 7);
  }
  body[6 + bitfieldLength] = name.length;
  body.set(name, 6 + bitfieldLength + 1);

  const out = new Uint8Array(body.length + 2);
  out.set(body);
  new DataView(out.buffer).setUint16(body.length, crc16(body), true);
  return EXPORT_PREFIX + toBase64Url(out);
}

/**
 * Strips whatever the user pasted down to the code itself: a full share link, stray whitespace,
 * line breaks from an email, and the zero-width characters chat apps like to insert.
 */
export function normalizeCode(input: string): string {
  const cleaned = input.replace(/[\s\u200B-\u200F\u2060\uFEFF]/g, '');
  const at = cleaned.toUpperCase().lastIndexOf(EXPORT_PREFIX);
  return at === -1 ? cleaned : cleaned.slice(at);
}

/** Decodes a `PKG1-` code, a share link holding one, or fails with a message for the user. */
export function decodeProfile(input: string): CodecResult {
  const code = normalizeCode(input);
  if (!code.toUpperCase().startsWith(EXPORT_PREFIX)) return fail('bad-prefix');

  const bytes = fromBase64Url(code.slice(EXPORT_PREFIX.length));
  if (!bytes) return fail('bad-base64');
  // Header (6) + at least one bitfield byte + name length + CRC (2).
  if (bytes.length < 10) return fail('too-short');

  const body = bytes.subarray(0, bytes.length - 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(bytes.length - 2, true) !== crc16(body)) return fail('bad-checksum');

  // The version is checked after the CRC, so random text can't claim to be from a newer app.
  if (body[0] !== EXPORT_FORMAT_VERSION) return fail('unsupported-version');

  const game = findGameByCodecId(view.getUint16(1, true));
  if (!game) return fail('unknown-game');

  const dexCount = view.getUint16(4, true);
  const bitfieldLength = Math.ceil(dexCount / 8);
  const nameAt = 6 + bitfieldLength;
  if (body.length < nameAt + 1) return fail('too-short');
  const nameLength = body[nameAt]!;
  if (nameLength > MAX_NAME_BYTES) return fail('bad-name');
  if (body.length !== nameAt + 1 + nameLength) return fail('too-short');

  let name: string;
  try {
    name = new TextDecoder('utf-8', { fatal: true }).decode(body.subarray(nameAt + 1));
  } catch {
    return fail('bad-name');
  }

  // A code from another build may carry a longer dex than this game has here; extra bits are
  // reported so the import preview can warn, and species this game lacks are dropped.
  const caught: number[] = [];
  let ignoredBeyondDex = 0;
  for (let index = 0; index < dexCount; index++) {
    if (!(body[6 + (index >> 3)]! & (1 << (index & 7)))) continue;
    if (index + 1 <= game.nationalDexMax) caught.push(index + 1);
    else ignoredBeyondDex++;
  }

  const progressPart = body[3]!;
  return {
    ok: true,
    value: {
      name,
      game: game.id,
      caught,
      ...(progressPart > 0 ? { progressPart } : {}),
      dexCount,
      ignoredBeyondDex,
    },
  };
}
