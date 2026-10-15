import type { WalkthroughPartPage } from './milestones';
import type { NumberedMilestone } from './milestone-numbers';
import { attachTeams, battlesOf, parseParties, type TeamContext } from './parties';

// Cut from the cached walkthrough part pages (Red and Blue Part 3 and 1, Yellow Part 9, Gold and Silver Part 12
// and 28), trimmed to the parameters the parser reads.
const brockBox = `{{WalkthroughGym
| name = Pewter Gym
| trainers =
{{Trainerheader|Rock}}
{{Trainerentry|Spr RG Jr Trainer M.png|game=1|Jr. Trainer♂||220|2|050|Diglett||11|None}}
{{Trainerfooter|Rock||Inside}}
| party =
{{Party
| sprite = Spr RG Brock.png
| prize = {{PDollar}}1,386
| name = {{color2|000|Brock}}
| game = RB
| location = Pewter Gym
| pokemon = 2
}}
{{Pokémon
| walkthrough = yes
| gen = 1
| ndex = 0074
| pokemon = Geodude
| level = 12
| type1 = Rock | type2 = Ground
| move1 = Tackle | move1type = Normal
| move2 = Defense Curl | move2type = Normal
}}
{{Pokémon
| gen = 1
| ndex = 0095
| pokemon = Onix
| level = 14
| type1 = Rock
| type2 = Ground
| move1 = Tackle | move1type = Normal
| move2 = Screech | move2type = Normal
| move3 = Bide | move3type = Normal
}}
{{Party/end}}
}}
After the battle, [[Brock]] awards you the {{badge|Boulder}}.
`;

const RIVAL_TYPES: Record<string, string> = {
  Bulbasaur: 'type1=Grass|type2=Poison',
  Charmander: 'type1=Fire',
  Squirtle: 'type1=Water',
};
const rivalParty = (choice: string, ndex: string, pokemon: string) => `{{Party
| caption = {{PlayerChoice|${choice}}}
| sprite = Spr RG Blue 1.png
| prize = {{PDollar}}175
| name = {{color2|000|Blue (game)|Blue}}
| location = Professor Oak's Laboratory
| pokemon = 1
}}
{{Pokémon|gen=1|ndex=${ndex}|pokemon=${pokemon}|level=5|${RIVAL_TYPES[pokemon]}|move1=Tackle|move1type=Normal}}
{{Party/end}}
`;
const rivalRun =
  rivalParty('0001|Bulbasaur', '0004', 'Charmander') +
  rivalParty('0004|Charmander', '0007', 'Squirtle') +
  rivalParty('0007|Squirtle', '0001', 'Bulbasaur');

const yellowTower = (evolution: string) => `{{Party
|caption={{BlueEevee|${evolution}|evolved=no}}
|sprite=Spr Y Blue 2.png
|prize={{Pdollar}}1625
|name={{color2|000|Blue (game)|Blue}}
|game=Y
|location=Pokémon Tower
|pokemon=1
}}
{{Pokémon|gen=1|ndex=0133|pokemon=Eevee|level=25|type1=Normal|move1=Quick Attack|move1type=Normal}}
{{Party/end}}
`;

const executive = (
  link: string,
  cls: string,
  prize: string,
  ndex: string,
  pokemon: string,
) => `{{Party
|sprite=Spr GS Rocket Executive.png
|prize={{PDollar}}${prize}
|class=${cls}
|name={{color2|000|${link}|Executive}}
|game=GS
|location=Goldenrod Radio Tower
|pokemon=1
}}
{{Pokémon|gen=2|ndex=${ndex}|pokemon=${pokemon}|level=30|gender=male|type1=Poison|move1=Tackle|move1type=Normal}}
{{Party/end}}
`;

const redParty = `{{Party
|prize={{PDollar}}7700
|class={{PK}}{{MN}} Trainer
|name={{color2|000|Red (game)|Red}}
|location=Mt. Silver Cave
|pokemon=3
}}
{{Pokémon|gen=2|ndex=0025|pokemon=Pikachu|level=81|gender=male|type1=Electric|move1=Thunderbolt|move1type=Electric}}
{{Pokémon|gen=2|ndex=0196|pokemon=Espeon|level=73|gender=female|type1=Psychic|move1=Psychic|move1type=Psychic}}
{{Pokémon|gen=2|ndex=0143|pokemon=Snorlax|level=75|gender=both|type1=Normal|move1=Rest|move1type=Psychic}}
{{Party/end}}
`;

const context: TeamContext = {
  species: [
    { dex: 1, name: 'Bulbasaur', types: ['grass', 'poison'] },
    { dex: 4, name: 'Charmander', types: ['fire'] },
    { dex: 7, name: 'Squirtle', types: ['water'] },
    { dex: 23, name: 'Ekans', types: ['poison'] },
    { dex: 74, name: 'Geodude', types: ['rock', 'ground'] },
    { dex: 95, name: 'Onix', types: ['rock', 'ground'] },
    { dex: 109, name: 'Koffing', types: ['poison'] },
    { dex: 133, name: 'Eevee', types: ['normal'] },
    { dex: 134, name: 'Vaporeon', types: ['water'] },
    { dex: 135, name: 'Jolteon', types: ['electric'] },
  ],
  moves: [
    { name: 'Tackle', type: 'normal' },
    { name: 'Defense Curl', type: 'normal' },
    { name: 'Screech', type: 'normal' },
    { name: 'Bide', type: 'normal' },
    { name: 'Quick Attack', type: 'normal' },
  ],
};

const milestone = (
  id: string,
  trainer: NumberedMilestone['trainer'],
  part: NumberedMilestone['part'],
  kind: NumberedMilestone['kind'] = 'battle',
): NumberedMilestone => ({ no: 1, id, label: id, kind, part, locationId: 'somewhere', trainer });

const page = (game: WalkthroughPartPage['game'], part: number, wikitext: string) => ({
  game,
  part,
  page: `${game} Part ${part}`,
  wikitext,
});

describe('parseParties', () => {
  it('reads a Party nested in a Gym box, with its members and prize', () => {
    expect(parseParties(brockBox)).toEqual({
      parties: [
        {
          name: 'Brock',
          prize: 1386,
          location: 'Pewter Gym',
          members: [
            {
              dex: 74,
              species: 'Geodude',
              level: 12,
              types: ['Rock', 'Ground'],
              moves: ['Tackle', 'Defense Curl'],
            },
            {
              dex: 95,
              species: 'Onix',
              level: 14,
              types: ['Rock', 'Ground'],
              moves: ['Tackle', 'Screech', 'Bide'],
            },
          ],
        },
      ],
      problems: [],
    });
  });

  it('reads starter and rival Eevee variants', () => {
    expect(parseParties(rivalRun).parties.map((p) => p.variant)).toEqual([
      { kind: 'starter', dex: 1 },
      { kind: 'starter', dex: 4 },
      { kind: 'starter', dex: 7 },
    ]);
    expect(parseParties(yellowTower('Vaporeon')).parties[0]!.variant).toEqual({
      kind: 'rival-eevee',
      species: 'Vaporeon',
      evolved: false,
    });
  });

  it('reads Gen II genders ("both" says nothing) and the PKMN Trainer class', () => {
    const [red] = parseParties(redParty).parties;
    expect(red!.trainerClass).toBe('PKMN Trainer');
    expect(red!.members.map((m) => m.gender)).toEqual(['male', 'female', undefined]);
  });

  it('drops a class that repeats the name', () => {
    const parties = parseParties(
      executive('Proton', 'Executive', '2592', '0042', 'Golbat') +
        executive('Ariana', 'Rocket', '2304', '0024', 'Arbok'),
    ).parties;
    expect(parties.map((p) => p.trainerClass)).toEqual([undefined, 'Rocket']);
  });

  it('reports unknown captions, a missing end and a wrong member count', () => {
    const broken =
      '{{Party|name=A|caption=Something|pokemon=2}}\n{{Pokémon|ndex=1|pokemon=X|level=5}}\n{{Party/end}}\n' +
      '{{Party|name=B|pokemon=1}}\n{{Pokémon|ndex=1|pokemon=X|level=5}}';
    expect(parseParties(broken).problems).toEqual([
      'Party "A" says pokemon=2 but lists 1',
      'Party "A": unknown party caption "Something"',
      'Party "B" has no {{Party/end}}',
    ]);
  });
});

describe('battlesOf', () => {
  it('groups a run of variants into one battle, but not same-named parties without variants', () => {
    const rival = parseParties(rivalRun).parties;
    const executives = parseParties(
      executive('Proton', 'Executive', '2592', '0042', 'Golbat') +
        executive('Ariana', 'Rocket', '2304', '0024', 'Arbok') +
        executive('Archer', 'Rocket', '2520', '0229', 'Houndoom'),
    ).parties;
    expect(battlesOf([...rival, ...executives]).map((b) => b.length)).toEqual([3, 1, 1, 1]);
  });
});

describe('attachTeams', () => {
  it('turns a matched party into the team and drops `trainer`', () => {
    const result = attachTeams(
      [milestone('gym-brock', 'Brock', { red: 3 }, 'gym')],
      [page('red', 3, brockBox)],
      context,
    );
    expect(result.issues).toEqual([]);
    expect(result.milestones[0]).not.toHaveProperty('trainer');
    expect(result.milestones[0]!.teams).toEqual({
      red: [
        {
          trainer: 'Brock',
          prize: 1386,
          pokemon: [
            {
              dex: 74,
              level: 12,
              moves: [
                { name: 'Tackle', type: 'normal' },
                { name: 'Defense Curl', type: 'normal' },
              ],
            },
            {
              dex: 95,
              level: 14,
              moves: [
                { name: 'Tackle', type: 'normal' },
                { name: 'Screech', type: 'normal' },
                { name: 'Bide', type: 'normal' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('gives a three-way rival run one team per starter, in each game of a shared page', () => {
    const { milestones, issues } = attachTeams(
      [milestone('rival-1', 'Blue', { red: 1, blue: 1 })],
      [page('red', 1, rivalRun), { ...page('blue', 1, rivalRun), page: 'red Part 1' }],
      context,
    );
    expect(issues).toEqual([]);
    for (const game of ['red', 'blue'] as const)
      expect(milestones[0]!.teams![game]!.map((t) => [t.variant, t.pokemon[0]!.dex])).toEqual([
        [{ kind: 'starter', dex: 1 }, 4],
        [{ kind: 'starter', dex: 4 }, 7],
        [{ kind: 'starter', dex: 7 }, 1],
      ]);
  });

  it("resolves Yellow's rival Eevee evolutions by name", () => {
    const { milestones } = attachTeams(
      [milestone('rival-5', 'Blue', { yellow: 9 })],
      [page('yellow', 9, yellowTower('Vaporeon') + yellowTower('Jolteon'))],
      context,
    );
    expect(milestones[0]!.teams!.yellow!.map((t) => t.variant)).toEqual([
      { kind: 'rival-eevee', dex: 134, evolved: false },
      { kind: 'rival-eevee', dex: 135, evolved: false },
    ]);
  });

  it('matches same-named trainers in page order, with alternative names', () => {
    const wikitext =
      executive('Petrel', 'Rocket', '2160', '0109', 'Koffing') +
      executive('Proton', 'Executive', '2592', '0023', 'Ekans');
    const { milestones } = attachTeams(
      [
        milestone('fake-director', 'Executive', { gold: 12 }),
        milestone('4f', ['???', 'Executive'], { gold: 12 }),
      ],
      [page('gold', 12, wikitext)],
      { ...context, moves: [...context.moves] },
    );
    expect(milestones.map((m) => m.teams!.gold![0]!.prize)).toEqual([2160, 2592]);
  });

  it('warns about a party no milestone claims', () => {
    const result = attachTeams([], [page('red', 3, brockBox)], context);
    expect(result.issues).toEqual([
      {
        level: 'warning',
        page: 'red Part 3',
        message: 'red Part 3: no milestone claims the {{Party}} "Brock" at Pewter Gym',
      },
    ]);
    expect(result.unclaimed).toEqual([
      { game: 'red', part: 3, page: 'red Part 3', name: 'Brock', location: 'Pewter Gym' },
    ]);
  });

  it('fails on an unknown move, a missing match, a missing page and a trainer on a non-battle', () => {
    const { issues, milestones } = attachTeams(
      [
        milestone('gym-brock', 'Brock', { red: 3 }, 'gym'),
        milestone('gym-misty', 'Misty', { red: 3 }, 'gym'),
        milestone('rival-9', 'Blue', { red: 9 }),
        milestone('help-bill', 'Bill', { red: 3 }, 'event'),
      ],
      [page('red', 3, brockBox)],
      { ...context, moves: context.moves.filter((m) => m.name !== 'Bide') },
    );
    expect(issues.map((i) => `${i.level}: ${i.message}`)).toEqual([
      'error: Party "Brock" on red Part 3: Onix knows "Bide", which is not in the move list',
      'error: Milestone "gym-misty": red Part 3 has no unclaimed {{Party}} named "Misty"',
      'error: Milestone "rival-9": no walkthrough page for red Part 9 to find its team on',
      'error: Milestone "help-bill" has a trainer, but only gym and battle milestones have teams',
    ]);
    expect(milestones[3]).not.toHaveProperty('teams');
  });

  it('warns when the page types differ from ours', () => {
    const { issues } = attachTeams(
      [milestone('gym-brock', 'Brock', { red: 3 }, 'gym')],
      [page('red', 3, brockBox)],
      {
        ...context,
        species: context.species.map((s) => (s.dex === 95 ? { ...s, types: ['rock'] } : s)),
      },
    );
    expect(issues.map((i) => i.message)).toEqual([
      'Party "Brock" on red Part 3: Onix has types rock/ground, but ours are rock',
    ]);
  });
});
