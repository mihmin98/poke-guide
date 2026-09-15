import { fixture } from '../testing/fixtures';
import { RBY_CATCH_RATE_NOTES } from '../version-groups/rby/overrides/catch-rate-notes';
import {
  catchRateNoteEffect,
  parseCatchRateList,
  resolveCatchRates,
  type CatchRateContext,
  type CatchRateRow,
} from './catch-rate-history';

const rows = parseCatchRateList(fixture('rby', 'catch-rate-list').wikitext);
const rby: CatchRateContext = { generation: 1, games: ['red', 'blue', 'yellow'] };

describe('parseCatchRateList', () => {
  it('reads default rows with their notes', () => {
    expect(rows[0]).toEqual({
      dex: 1,
      name: 'Bulbasaur',
      form: null,
      catchRate: 45,
      notes: ["120 in Let's Go Pikachu and Eevee"],
    });
    expect(rows.find((r) => r.dex === 20)).toMatchObject({
      catchRate: 127,
      notes: ['90 prior to Generation III'],
    });
    expect(rows.find((r) => r.dex === 2)?.notes).toEqual([]);
  });

  it('reads form rows, with the form line before or after the name', () => {
    expect(rows.filter((r) => r.dex === 25).map((r) => [r.form, r.catchRate])).toEqual([
      [null, 190],
      ['Partner', 255],
    ]);
    expect(rows.filter((r) => r.dex === 774).map((r) => r.form)).toEqual(['Meteor Form', 'Core']);
    expect(rows.find((r) => r.dex === 901 && r.form !== null)).toMatchObject({
      name: 'Ursaluna',
      form: 'Bloodmoon',
    });
  });

  it('splits multi-line notes', () => {
    expect(rows.find((r) => r.dex === 376)?.notes).toEqual([
      '15 in Colosseum',
      '20 in Legends: Z-A',
    ]);
  });

  it('has one default row per species and skips the Legends: Arceus table', () => {
    const defaults = rows.filter((r) => r.form === null).map((r) => r.dex);
    const last = rows.at(-1)!.dex;
    // Minior only has form rows (Meteor Form and Core).
    const expected = Array.from({ length: last }, (_, i) => i + 1).filter((dex) => dex !== 774);
    expect(defaults).toEqual(expected);
  });
});

describe('catchRateNoteEffect', () => {
  it('applies earlier values from generation and game notes', () => {
    expect(catchRateNoteEffect('90 prior to Generation III', rby)).toEqual({
      kind: 'earlier-value',
      value: 90,
      untilGeneration: 3,
      label: 'Generation III',
    });
    expect(
      catchRateNoteEffect('5 prior to ORAS', { generation: 3, games: ['emerald'] }),
    ).toMatchObject({
      kind: 'earlier-value',
      untilGeneration: 6,
    });
  });

  it('ignores notes about games outside the version group', () => {
    for (const note of [
      '90 in XD: Gale of Darkness',
      "120 in Let's Go Pikachu and Eevee",
      '45 in ORAS, USUM, SwSh, BDSP, and Legends: Z-A',
      'Always succeeds in XD: Gale of Darkness',
      '27 in Pokémon Yellow',
    ]) {
      expect(catchRateNoteEffect(note, { generation: 2, games: ['crystal'] })).toEqual({
        kind: 'other-games',
      });
    }
  });

  it('needs a classification for its own games, unknown games, same-generation changes and free text', () => {
    for (const note of [
      '27 in Pokémon Yellow',
      '10 in Stadium',
      'Wild Kadabra in Yellow have their catch rate value set to 96 after capture',
    ]) {
      expect(catchRateNoteEffect(note, rby)).toEqual({ kind: 'needs-classification' });
    }
    expect(catchRateNoteEffect('5 prior to ORAS', { generation: 6, games: [] })).toEqual({
      kind: 'needs-classification',
    });
  });
});

describe('resolveCatchRates', () => {
  const resolveRby = (classifications = RBY_CATCH_RATE_NOTES) =>
    resolveCatchRates(rows, { ...rby, speciesRange: [1, 151], classifications });

  it('resolves every Generation I species with the rby classifications', () => {
    const { rates, errors } = resolveRby();
    expect(errors).toEqual([]);
    expect(rates.size).toBe(151);
    expect(rates.get(1)).toEqual({ catchRate: 45 });
    expect(rates.get(25)).toEqual({ catchRate: 190 });
    expect(rates.get(150)).toEqual({ catchRate: 3 });
    expect(rates.get(20)).toEqual({ catchRate: 90, note: '127 from Generation III' });
    expect(rates.get(64)).toEqual({ catchRate: 100 });
    expect(rates.get(148)).toEqual({ catchRate: 45, catchRateByGame: { yellow: 27 } });
    expect(rates.get(149)).toEqual({ catchRate: 45, catchRateByGame: { yellow: 9 } });
  });

  it('fails on per-game overrides for games outside the version group', () => {
    const synthetic: CatchRateRow[] = [
      { dex: 1, name: 'Test', form: null, catchRate: 45, notes: ['9 in Pokémon Yellow'] },
    ];
    const { rates, errors } = resolveCatchRates(synthetic, {
      generation: 2,
      games: ['crystal'],
      speciesRange: [1, 1],
      classifications: [
        {
          dex: 1,
          note: '9 in Pokémon Yellow',
          kind: 'override',
          value: 9,
          games: ['yellow'],
          reason: 'test',
        },
      ],
    });
    // Yellow isn't in the version group, so the note is ignored and the classification is stale.
    expect(rates.get(1)).toEqual({ catchRate: 45 });
    expect(errors).toEqual([
      '#1: catch-rate note classification matches no note: "9 in Pokémon Yellow"',
    ]);
  });

  it('fails on every unclassified Yellow note', () => {
    expect(resolveRby([]).errors).toEqual([
      '#25 Pikachu: unclassified catch-rate note "The first partner Pikachu in Yellow has its catch rate value set to 163"',
      '#64 Kadabra: unclassified catch-rate note "Wild Kadabra in Yellow have their catch rate value set to 96 after capture"',
      '#148 Dragonair: unclassified catch-rate note "27 in Pokémon Yellow"',
      '#149 Dragonite: unclassified catch-rate note "9 in Pokémon Yellow"',
    ]);
  });

  it('fails on classifications that match no note', () => {
    const stale = { dex: 1, note: '99 in Pokémon Red', kind: 'note-only', reason: 'test' } as const;
    expect(resolveRby([...RBY_CATCH_RATE_NOTES, stale]).errors).toEqual([
      '#1: catch-rate note classification matches no note: "99 in Pokémon Red"',
    ]);
  });

  it('uses later values once the generation passes a change', () => {
    const { rates } = resolveCatchRates(rows, {
      generation: 3,
      games: ['emerald'],
      speciesRange: [20, 20],
      classifications: [],
    });
    expect(rates.get(20)).toEqual({ catchRate: 127 });
  });

  it('chains earlier values, applies overrides and shows display text', () => {
    const synthetic: CatchRateRow[] = [
      {
        dex: 1,
        name: 'Test',
        form: null,
        catchRate: 3,
        notes: ['30 prior to Generation V', '5 prior to Generation III'],
      },
      { dex: 2, name: 'Other', form: null, catchRate: 45, notes: ['60 in Pokémon Crystal'] },
    ];
    const { rates, errors } = resolveCatchRates(synthetic, {
      generation: 2,
      games: ['crystal'],
      speciesRange: [1, 2],
      classifications: [
        {
          dex: 2,
          note: '60 in Pokémon Crystal',
          kind: 'override',
          value: 60,
          display: '45 outside Crystal',
          reason: 'test',
        },
      ],
    });
    expect(errors).toEqual([]);
    expect(rates.get(1)).toEqual({ catchRate: 5, note: '30 from Generation III' });
    expect(rates.get(2)).toEqual({ catchRate: 60, note: '45 outside Crystal' });
  });

  it('reports species without exactly one default row', () => {
    expect(
      resolveCatchRates([], { ...rby, speciesRange: [1, 1], classifications: [] }).errors,
    ).toEqual(['#1: 0 default rows in the catch-rate list']);
  });
});
