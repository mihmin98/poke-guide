// FRAMEWORK-FREE: the `PKG1`, `PKG2` and `PKG3` export codes (plan §12.2). No Angular imports.
//
// This is a **compatibility contract**: every code ever produced must keep decoding. The layouts,
// the CRC and the `codecId` values are therefore fixed forever. A change means a new prefix
// (`PKG3`), never an edit to an existing format.
//
// `PKG1`, format version 1:
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
//
// `PKG2`, format version 2 (Phase 9): the same, plus the items the profile has picked up, between
// the caught bitfield and the name. Item numbers are `LocationItem.no` of the game's version group.
//
// | …      | 2      | `itemCount` M (uint16 LE): the highest item number carried  |
// | …      | ⌈M/8⌉  | items-taken bitfield, bit i = item number i + 1, LSB first   |
//
// `PKG3`, format version 3 (Phase 11): the `PKG2` layout (its item block always present, `itemCount` 0 when no
// items are taken), plus the story milestones done, between the item block and the name. Milestone numbers are
// `Milestone.no` of the game's version group.
//
// | …      | 2      | `milestoneCount` K (uint16 LE): the highest milestone number |
// | …      | ⌈K/8⌉  | milestones-done bitfield, bit i = milestone number i + 1     |
//
// The encoder writes the lowest format that holds the profile (`PKG1` with nothing ticked, `PKG2` with items
// only), so those codes stay readable by earlier versions; `PKG1` means "no items taken" and `PKG1`/`PKG2`
// mean "no milestones done".
import { findGameByCodecId, getGame } from '../games/registry';
import type { GameId } from '../games/types';
import type { Profile } from './models';

/** The prefix of format 1; format N is `PKG<N>-`. */
export const EXPORT_PREFIX = 'PKG1-';
export const EXPORT_FORMAT_VERSION = 1;
/** Adds the items-taken bitfield (Phase 9). */
export const EXPORT_FORMAT_ITEMS = 2;
/** Adds the milestones-done bitfield (Phase 11). */
export const EXPORT_FORMAT_MILESTONES = 3;
/** `itemCount` is a uint16. */
export const MAX_ITEM_NUMBER = 0xffff;
/** `milestoneCount` is a uint16. */
export const MAX_MILESTONE_NUMBER = 0xffff;

export const exportPrefix = (format: number) => `PKG${format}-`;
const PREFIX = /PKG(\d)-/gi;
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
  /** Sorted `LocationItem.no` values; empty for a `PKG1` code. Not checked against the game data. */
  itemsTaken: number[];
  /** Sorted `Milestone.no` values; empty for a `PKG1`/`PKG2` code. Not checked against the game data. */
  milestonesDone: number[];
}

export type CodecResult = { ok: true; value: DecodedProfile } | { ok: false; error: CodecError };

const ERROR_MESSAGES: Record<CodecErrorKind, string> = {
  'bad-prefix':
    'That doesn’t look like a Poké Guide code. Codes start with “PKG”, a number and a dash, like “PKG1-”.',
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
  Partial<Pick<Profile, 'progressPart' | 'itemsTaken' | 'milestonesDone'>>;

/** Numbers that fit a uint16-counted bitfield. */
const inRange = (numbers: readonly number[] | undefined, max: number) =>
  (numbers ?? []).filter((no) => Number.isInteger(no) && no >= 1 && no <= max);

/** Writes a count (uint16 LE) and its bitfield at `at`; returns the offset after it. */
function writeCountedBitfield(body: Uint8Array, at: number, numbers: readonly number[]): number {
  const count = numbers.length ? Math.max(...numbers) : 0;
  new DataView(body.buffer).setUint16(at, count, true);
  for (const no of numbers) {
    const index = no - 1;
    body[at + 2 + (index >> 3)]! |= 1 << (index & 7);
  }
  return at + 2 + Math.ceil(count / 8);
}

const countedLength = (numbers: readonly number[]) =>
  2 + Math.ceil((numbers.length ? Math.max(...numbers) : 0) / 8);

/**
 * The code for one profile, in the lowest format that holds it: `PKG1-…` with nothing ticked, `PKG2-…` with
 * items taken, `PKG3-…` once a milestone is done. Caught numbers outside the game's dex range, and item and
 * milestone numbers outside 1–65535, are dropped.
 */
export function encodeProfile(profile: ExportableProfile): string {
  const game = getGame(profile.game);
  const dexCount = game.nationalDexMax;
  const bitfieldLength = Math.ceil(dexCount / 8);
  const name = encodeName(profile.name);
  const items = inRange(profile.itemsTaken, MAX_ITEM_NUMBER);
  const milestones = inRange(profile.milestonesDone, MAX_MILESTONE_NUMBER);
  const format =
    milestones.length > 0
      ? EXPORT_FORMAT_MILESTONES
      : items.length > 0
        ? EXPORT_FORMAT_ITEMS
        : EXPORT_FORMAT_VERSION;
  const itemBlockLength = format >= EXPORT_FORMAT_ITEMS ? countedLength(items) : 0;
  const milestoneBlockLength = format >= EXPORT_FORMAT_MILESTONES ? countedLength(milestones) : 0;

  const nameAt = 6 + bitfieldLength + itemBlockLength + milestoneBlockLength;
  const body = new Uint8Array(nameAt + 1 + name.length);
  const bodyView = new DataView(body.buffer);
  body[0] = format;
  bodyView.setUint16(1, game.codecId, true);
  // A part above 255 can't be stored; the registry's walkthroughs are far shorter than that.
  body[3] = Math.min(Math.max(profile.progressPart ?? 0, 0), 255);
  bodyView.setUint16(4, dexCount, true);
  for (const dex of profile.caught) {
    if (!Number.isInteger(dex) || dex < 1 || dex > dexCount) continue;
    const index = dex - 1;
    body[6 + (index >> 3)]! |= 1 << (index & 7);
  }
  if (format >= EXPORT_FORMAT_ITEMS) {
    const milestonesAt = writeCountedBitfield(body, 6 + bitfieldLength, items);
    if (format >= EXPORT_FORMAT_MILESTONES) writeCountedBitfield(body, milestonesAt, milestones);
  }
  body[nameAt] = name.length;
  body.set(name, nameAt + 1);

  const out = new Uint8Array(body.length + 2);
  out.set(body);
  new DataView(out.buffer).setUint16(body.length, crc16(body), true);
  return exportPrefix(format) + toBase64Url(out);
}

/**
 * Strips whatever the user pasted down to the code itself: a full share link, stray whitespace,
 * line breaks from an email, and the zero-width characters chat apps like to insert.
 */
export function normalizeCode(input: string): string {
  const cleaned = input.replace(/[\s\u200B-\u200F\u2060\uFEFF]/g, '');
  const at = [...cleaned.matchAll(PREFIX)].at(-1)?.index;
  return at === undefined ? cleaned : cleaned.slice(at);
}

/** Reads bits `0..count - 1` of a bitfield starting at `at` as the numbers `index + 1`. */
function readBitfield(body: Uint8Array, at: number, count: number): number[] {
  const numbers: number[] = [];
  for (let index = 0; index < count; index++) {
    if (body[at + (index >> 3)]! & (1 << (index & 7))) numbers.push(index + 1);
  }
  return numbers;
}

/** Decodes a `PKG1-`/`PKG2-`/`PKG3-` code, a share link holding one, or fails with a message for the user. */
export function decodeProfile(input: string): CodecResult {
  const code = normalizeCode(input);
  const prefix = /^PKG(\d)-/i.exec(code);
  if (!prefix) return fail('bad-prefix');

  const bytes = fromBase64Url(code.slice(prefix[0].length));
  if (!bytes) return fail('bad-base64');
  // Header (6) + at least one bitfield byte + name length + CRC (2).
  if (bytes.length < 10) return fail('too-short');

  const body = bytes.subarray(0, bytes.length - 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(bytes.length - 2, true) !== crc16(body)) return fail('bad-checksum');

  // The version is checked after the CRC, so random text can't claim to be from a newer app.
  // The CRC doesn't cover the prefix, so a prefix that disagrees with the format byte was edited.
  const format = body[0]!;
  if (format < EXPORT_FORMAT_VERSION || format > EXPORT_FORMAT_MILESTONES)
    return fail('unsupported-version');
  if (Number(prefix[1]) !== format) return fail('bad-prefix');

  const game = findGameByCodecId(view.getUint16(1, true));
  if (!game) return fail('unknown-game');

  const dexCount = view.getUint16(4, true);
  const bitfieldLength = Math.ceil(dexCount / 8);
  let nameAt = 6 + bitfieldLength;
  /** Reads a counted bitfield at `nameAt` and moves `nameAt` past it; `undefined` when it's cut short. */
  const readCounted = (): number[] | undefined => {
    if (body.length < nameAt + 2) return undefined;
    const count = view.getUint16(nameAt, true);
    const at = nameAt + 2;
    nameAt = at + Math.ceil(count / 8);
    return body.length < nameAt ? undefined : readBitfield(body, at, count);
  };
  let itemsTaken: number[] = [];
  let milestonesDone: number[] = [];
  if (format >= EXPORT_FORMAT_ITEMS) {
    const read = readCounted();
    if (!read) return fail('too-short');
    itemsTaken = read;
  }
  if (format >= EXPORT_FORMAT_MILESTONES) {
    const read = readCounted();
    if (!read) return fail('too-short');
    milestonesDone = read;
  }
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
  const carried = readBitfield(body, 6, dexCount);
  const caught = carried.filter((dex) => dex <= game.nationalDexMax);

  const progressPart = body[3]!;
  return {
    ok: true,
    value: {
      name,
      game: game.id,
      caught,
      ...(progressPart > 0 ? { progressPart } : {}),
      dexCount,
      ignoredBeyondDex: carried.length - caught.length,
      itemsTaken,
      milestonesDone,
    },
  };
}
