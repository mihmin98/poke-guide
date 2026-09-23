import { rbyConfig } from '../version-groups/rby/config';
import { fixture } from '../testing/fixtures';
import {
  collectMoves,
  learnsetPageTitle,
  parseLearnsetPage,
  type LearnsetParseOptions,
} from './learnsets';

const options: LearnsetParseOptions = {
  generation: 1,
  games: rbyConfig.games,
  levelColumns: rbyConfig.learnsetLevelColumns,
};
const parse = (name: string) =>
  parseLearnsetPage(fixture('rby', `${name}-learnset`).wikitext, options);

describe('learnsetPageTitle', () => {
  it('uses the generation numeral', () => {
    expect(learnsetPageTitle('Mr. Mime', 1)).toBe('Mr. Mime (Pokémon)/Generation I learnset');
  });
});

describe('parseLearnsetPage', () => {
  it('reads separate Red/Blue and Yellow levels (Pikachu)', () => {
    const pikachu = parse('pikachu');
    expect(pikachu.issues).toEqual([]);
    expect(pikachu.levelUp).toContainEqual({
      move: 'ThunderShock',
      levels: { red: 1, blue: 1, yellow: 1 },
    });
    expect(pikachu.levelUp).toContainEqual({
      move: 'Thunder Wave',
      levels: { red: 9, blue: 9, yellow: 8 },
    });
    expect(pikachu.levelUp).toContainEqual({ move: 'Tail Whip', levels: { yellow: 6 } });
    expect(pikachu.levelUp).toContainEqual({ move: 'Swift', levels: { red: 26, blue: 26 } });
    expect(pikachu.levelUp).toHaveLength(12);
  });

  it('reads TMs and HMs, and ignores tutor, transfer and event moves', () => {
    const pikachu = parse('pikachu');
    expect(pikachu.machines).toContainEqual({ machine: 'TM24', move: 'Thunderbolt' });
    expect(pikachu.machines).toContainEqual({ machine: 'HM05', move: 'Flash' });
    expect(pikachu.machines).toHaveLength(22);
    expect(pikachu.moves.map((m) => m.name)).not.toContain('Surf');
    expect(pikachu.moves.map((m) => m.name)).not.toContain('Fly');
    expect(pikachu.prevo).toEqual([]);
  });

  it('keeps Generation I move data', () => {
    const moves = new Map(parse('pikachu').moves.map((m) => [m.name, m]));
    expect(moves.get('Thunderbolt')).toEqual({
      name: 'Thunderbolt',
      type: 'electric',
      power: 95,
      accuracy: 100,
      pp: 15,
    });
    expect(moves.get('Growl')).toEqual({
      name: 'Growl',
      type: 'normal',
      power: null,
      accuracy: 100,
      pp: 40,
    });
    expect(moves.get('Double Team')).toMatchObject({ power: null, accuracy: null });
    expect(new Map(parse('nidorina').moves.map((m) => [m.name, m])).get('Bite')?.type).toBe(
      'normal',
    );
  });

  it('ignores the Move Reminder list and keeps repeated level rows (Nidorina)', () => {
    const nidorina = parse('nidorina');
    expect(nidorina.issues).toEqual([]);
    expect(nidorina.levelUp).toHaveLength(9);
    expect(nidorina.levelUp.filter((row) => row.move === 'Scratch')).toEqual([
      { move: 'Scratch', levels: { red: 1, blue: 1, yellow: 1 } },
      { move: 'Scratch', levels: { red: 8, blue: 8, yellow: 8 } },
    ]);
  });

  it('reads moves from previous evolutions (Butterfree)', () => {
    const butterfree = parse('butterfree');
    expect(butterfree.issues).toEqual([]);
    expect(butterfree.prevo).toEqual(
      expect.arrayContaining([
        { move: 'Tackle', fromDex: [10] },
        { move: 'String Shot', fromDex: [10] },
        { move: 'Harden', fromDex: [11] },
      ]),
    );
  });

  it('reads two previous stages and per-game flags on prior-evolution rows', () => {
    const text = [
      '====By a prior [[Evolution]]====',
      '{{Learnlist/prevoh|Nidoqueen|Poison|Ground|1|1}}',
      '{{Learnlist/prevo1|029|Nidoran♀||030|Nidorina||Bite|Normal|60|100|25}}',
      '{{Learnlist/prevo1|029|Nidoran♀||030|Nidorina||Double Kick|Fighting|30|100|30||RB}}',
      "{{Learnlist/prevo1|029|Nidoran♀||030|Nidorina||Poison Sting|Poison|15|100|35|'''|Y}}",
      '{{Learnlist/prevo1|054|Psyduck|e||||Amnesia|Psychic|—|—|20}}',
      '{{Learnlist/prevof|Nidoqueen|Poison|Ground|1|1}}',
    ].join('\n');
    const result = parseLearnsetPage(text, options);
    expect(result.issues).toEqual([]);
    expect(result.prevo).toEqual([
      { move: 'Bite', fromDex: [29, 30] },
      { move: 'Double Kick', fromDex: [29, 30], games: ['red', 'blue'] },
      { move: 'Poison Sting', fromDex: [29, 30], games: ['yellow'] },
      { move: 'Amnesia', fromDex: [54] },
    ]);
  });

  it('handles empty TM lists (Ditto) and full ones (Mew)', () => {
    const ditto = parse('ditto');
    expect(ditto).toMatchObject({
      issues: [],
      machines: [],
      levelUp: [{ move: 'Transform', levels: { red: 1, blue: 1, yellow: 1 } }],
    });
    const mew = parse('mew');
    expect(mew.issues).toEqual([]);
    expect(mew.machines).toHaveLength(55);
  });

  it('strips footnote markers and reports bad rows', () => {
    const text = [
      '====By leveling up====',
      '{{learnlist/levelh/1|Vaporeon|Water|Water|RGB|Y}}',
      '{{learnlist/levelI|48|42*|Mist|Ice|—|—|30}}',
      '{{learnlist/levelI|x|1|Haze|Ice|—|—|30}}',
      '{{learnlist/level1|1|Tackle|Normal|35|95|35}}',
      '{{learnlist/levelI|1|1|Shadow Ball|Ghost|oops|100|15}}',
      '{{learnlist/levelI|1|1|Bite|Dark|60|100|25}}',
    ].join('\n');
    const result = parseLearnsetPage(text, options);
    // A type that doesn't exist yet is reported (and fails the build) but the row is kept.
    expect(result.levelUp).toEqual([
      { move: 'Mist', levels: { red: 48, blue: 48, yellow: 42 } },
      { move: 'Haze', levels: { yellow: 1 } },
      { move: 'Bite', levels: { red: 1, blue: 1, yellow: 1 } },
    ]);
    expect(result.issues).toEqual([
      'learnlist/levelI "Haze": unparseable level "x"'.replace('levelI', 'leveli'),
      'learnlist/level1: 1 level column(s) under a header with 2',
      'learnlist/leveli "Shadow Ball": malformed move data "Shadow Ball|Ghost|oops|100|15"',
      'learnlist/leveli "Bite": type dark doesn\'t exist in Generation I',
    ]);
  });

  it('reads Gen II egg moves and Crystal tutor moves (Charmander)', () => {
    const text = [
      '====By {{pkmn|breeding}}====',
      '{{learnlist/breedh|Charmander|fire|fire|2|1}}',
      '{{learnlist/breed2|{{MSP/3|158|Totodile}}|AncientPower|Rock|60|100|5|*|grid=6}}',
      '{{learnlist/breed2|{{MSP/3|143|Snorlax}}|Belly Drum|Normal|—|—|10|grid=6}}',
      '{{learnlist/breed2|{{MSP/3|111|Rhyhorn}}|AncientPower|Rock|60|100|5|‡|grid=6}}',
      '{{learnlist/breedf|Charmander|fire|fire|2|1}}',
      '====By [[Move Tutor|tutoring]]====',
      '{{learnlist/tutorh|Charmander|fire|fire|2|1}}',
      "{{learnlist/tutor2|Flamethrower|Fire|95|100|15||'''|yes}}",
      '{{learnlist/tutor2|Thunderbolt|Electric|95|100|15|||no}}',
      '{{learnlist/tutorf|Charmander|fire|fire|2|1}}',
    ].join('\n');
    const gen2: LearnsetParseOptions = {
      generation: 2,
      games: ['gold', 'silver', 'crystal'],
      levelColumns: {},
      eggMoves: true,
      tutorColumns: [['crystal']],
    };
    const result = parseLearnsetPage(text, gen2);
    expect(result.issues).toEqual([]);
    expect(result.egg).toEqual(['AncientPower', 'Belly Drum']);
    expect(result.tutor).toEqual([{ move: 'Flamethrower', games: ['crystal'] }]);
    // Without the options (Gen I), both sections are ignored.
    const gen1 = parseLearnsetPage(text, { ...gen2, eggMoves: false, tutorColumns: undefined });
    expect([gen1.egg, gen1.tutor, gen1.issues]).toEqual([[], [], []]);
  });
});

describe('collectMoves', () => {
  it('merges moves and machines across species', () => {
    const { moves, issues } = collectMoves([parse('pikachu'), parse('mew'), parse('nidorina')]);
    expect(issues).toEqual([]);
    const byId = new Map(moves.map((m) => [m.id, m]));
    expect(byId.get('thundershock')).toEqual({
      id: 'thundershock',
      name: 'ThunderShock',
      type: 'electric',
      power: 40,
      accuracy: 100,
      pp: 30,
    });
    expect(byId.get('thunderbolt')?.machine).toBe('TM24');
    expect(moves.filter((m) => m.machine).length).toBe(55);
  });

  it('reports conflicting data', () => {
    const base = { levelUp: [], machines: [], prevo: [], egg: [], tutor: [], issues: [] };
    const { issues } = collectMoves([
      { ...base, moves: [{ name: 'Bite', type: 'normal', power: 60, accuracy: 100, pp: 25 }] },
      { ...base, moves: [{ name: 'Bite', type: 'dark', power: 60, accuracy: 100, pp: 25 }] },
    ]);
    expect(issues).toEqual(['Move "Bite" has conflicting data across learnsets']);
  });
});
