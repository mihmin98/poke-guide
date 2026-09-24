/**
 * Walkthrough parts (plan §10, §16 Phase 10): `Walkthrough:Pokémon Gold and Silver` and `Walkthrough:Pokémon Crystal`
 * both have 29 parts covering the same places; only the titles of Parts 1, 12 and 29 differ. Parts 1–15 are Johto,
 * 16–28 the post-game Kanto visit, and Part 29 returns to Johto.
 */
import type { RegionId, WalkthroughPart } from '../../../../src/app/core/domain/models';

const SHARED: Record<number, string> = {
  2: "Cherrygrove City, Route 30, Mr. Pokémon's House, Professor Elm's Lab",
  3: 'Route 31, Violet City, Sprout Tower, Violet Gym',
  4: 'Route 32, Ruins of Alph, Union Cave, Route 33',
  5: 'Azalea Town, Slowpoke Well, Azalea Gym, Ilex Forest, Route 34',
  6: 'Goldenrod City, Goldenrod Gym',
  7: 'Route 35, National Park, Route 36, Route 37',
  8: 'Ecruteak City, Burned Tower, Ecruteak Gym, Route 38, Route 39',
  9: 'Olivine City, Route 40, Route 41',
  10: 'Cianwood City, Cianwood Gym, Olivine Gym, Route 42, Mt. Mortar',
  11: 'Mahogany Town, Route 43, Lake of Rage, Rocket Hideout, Mahogany Gym',
  13: "Blackthorn City, Blackthorn Gym, Dragon's Den, Route 45, Dark Cave, Route 46",
  14: 'Route 27, Route 26, Victory Road',
  15: 'Indigo Plateau',
  16: 'S.S. Aqua, Vermilion City, Vermilion Gym',
  17: 'Route 6, Saffron City, Saffron Gym',
  18: 'Route 8, Lavender Town, Route 10, Rock Tunnel, Route 9, Power Plant',
  19: 'Cerulean City, Route 24, Route 25, Cerulean Gym, Route 5',
  20: 'Route 7, Celadon City, Celadon Gym',
  21: 'Route 16, Route 17, Route 18, Fuchsia City, Fuchsia Gym',
  22: 'Route 15, Route 14, Route 13, Route 12',
  23: "Route 11, Diglett's Cave, Route 2, Pewter City, Pewter Gym",
  24: 'Route 3, Mt. Moon, Route 4',
  25: 'Viridian City, Route 1, Pallet Town',
  26: 'Route 21, Cinnabar Island, Route 20, Cinnabar Gym, Route 19',
  27: "Viridian Gym, Professor Oak's Lab, Route 22, Route 28",
  28: 'Mt. Silver',
};

function region(part: number): RegionId {
  return part >= 16 && part <= 28 ? 'kanto' : 'johto';
}

function parts(own: Record<number, string>): WalkthroughPart[] {
  const titles = { ...SHARED, ...own };
  return Array.from({ length: 29 }, (_, i) => i + 1).map((part) => ({
    part,
    title: titles[part]!,
    region: region(part),
  }));
}

export const GS_WALKTHROUGH: WalkthroughPart[] = parts({
  1: 'Introduction, New Bark Town, Route 29, Route 46',
  12: 'Goldenrod Radio Tower, Goldenrod Underground, Route 44, Ice Path',
  29: 'Tying Loose Ends: Tin Tower, Whirl Islands, Mt. Mortar (Revisited)',
});

export const CRYSTAL_WALKTHROUGH: WalkthroughPart[] = parts({
  1: 'Introduction, New Bark Town, Route 29',
  12: 'Goldenrod Radio Tower, Goldenrod Underground, Tin Tower (1F), Route 44, Ice Path',
  29: 'Tying Loose Ends: Tin Tower (Revisited), Whirl Islands, Mt. Mortar (Revisited)',
});
