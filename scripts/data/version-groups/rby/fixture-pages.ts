/** Pages captured into `__fixtures__/` for parser tests (plan §14). Refresh with `npm run data:fixtures`. */
export interface FixturePage {
  /** File name without extension. */
  name: string;
  title: string;
}

export const RBY_FIXTURE_PAGES: readonly FixturePage[] = [
  { name: 'route-1', title: 'Kanto Route 1' },
  { name: 'route-4', title: 'Kanto Route 4' },
  { name: 'route-12', title: 'Kanto Route 12' },
  { name: 'mt-moon', title: 'Mt. Moon' },
  { name: 'pokemon-tower', title: 'Pokémon Tower' },
  { name: 'pokemon-mansion', title: 'Pokémon Mansion (Kanto)' },
  { name: 'silph-co', title: 'Silph Co.' },
  { name: 'cinnabar-island', title: 'Cinnabar Island' },
  { name: 'safari-zone', title: 'Kanto Safari Zone' },
  { name: 'cerulean-city', title: 'Cerulean City' },
  { name: 'celadon-game-corner', title: 'Celadon Game Corner' },
  { name: 'in-game-trade', title: 'In-game trade' },
  // Species data
  { name: 'national-dex-list', title: 'List of Pokémon by National Pokédex number' },
  { name: 'catch-rate-list', title: 'List of Pokémon by catch rate' },
  { name: 'bulbasaur', title: 'Bulbasaur (Pokémon)' },
  { name: 'venusaur', title: 'Venusaur (Pokémon)' },
  { name: 'pikachu', title: 'Pikachu (Pokémon)' },
  { name: 'rattata', title: 'Rattata (Pokémon)' },
  { name: 'kadabra', title: 'Kadabra (Pokémon)' },
  { name: 'slowpoke', title: 'Slowpoke (Pokémon)' },
  { name: 'dewgong', title: 'Dewgong (Pokémon)' },
  { name: 'eevee', title: 'Eevee (Pokémon)' },
  { name: 'vaporeon', title: 'Vaporeon (Pokémon)' },
  { name: 'pikachu-learnset', title: 'Pikachu (Pokémon)/Generation I learnset' },
  { name: 'butterfree-learnset', title: 'Butterfree (Pokémon)/Generation I learnset' },
  { name: 'nidorina-learnset', title: 'Nidorina (Pokémon)/Generation I learnset' },
  { name: 'ditto-learnset', title: 'Ditto (Pokémon)/Generation I learnset' },
  { name: 'mew-learnset', title: 'Mew (Pokémon)/Generation I learnset' },
];
