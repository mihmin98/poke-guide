// FRAMEWORK-FREE: the 18 Pokémon types. No Angular imports.
// Which types exist in a generation is data (VersionGroupData.types); this list only drives display.

export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

export interface PokemonTypeDefinition {
  id: PokemonType;
  label: string;
  /** Badge background. The text color is derived for WCAG AA by `npm run theme:games`. */
  color: string;
}

export const POKEMON_TYPES: readonly PokemonTypeDefinition[] = [
  { id: 'normal', label: 'Normal', color: '#A8A77A' },
  { id: 'fire', label: 'Fire', color: '#EE8130' },
  { id: 'water', label: 'Water', color: '#6390F0' },
  { id: 'electric', label: 'Electric', color: '#F7D02C' },
  { id: 'grass', label: 'Grass', color: '#7AC74C' },
  { id: 'ice', label: 'Ice', color: '#96D9D6' },
  { id: 'fighting', label: 'Fighting', color: '#C22E28' },
  { id: 'poison', label: 'Poison', color: '#A33EA1' },
  { id: 'ground', label: 'Ground', color: '#E2BF65' },
  { id: 'flying', label: 'Flying', color: '#A98FF3' },
  { id: 'psychic', label: 'Psychic', color: '#F95587' },
  { id: 'bug', label: 'Bug', color: '#A6B91A' },
  { id: 'rock', label: 'Rock', color: '#B6A136' },
  { id: 'ghost', label: 'Ghost', color: '#735797' },
  { id: 'dragon', label: 'Dragon', color: '#6F35FC' },
  { id: 'dark', label: 'Dark', color: '#705746' },
  { id: 'steel', label: 'Steel', color: '#B7B7CE' },
  { id: 'fairy', label: 'Fairy', color: '#D685AD' },
];
