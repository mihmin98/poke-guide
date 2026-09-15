/**
 * Authoritative Generation I evolution graph (plan §7.6). Parsed evolution boxes are only diffed against it.
 * Checked on 2026-09-13 against the evolution boxes of all 151 species pages (cached revisions), ignoring
 * regional-form branches added in later generations (Alolan Sandslash/Ninetales, Galarian Slowbro, Hisuian
 * Electrode). Gen I has no friendship, held-item or time-based evolutions.
 */
import type { EvolutionEdge } from '../../../../../src/app/core/domain/models';

const level = (from: number, to: number, lvl: number): EvolutionEdge => ({
  from,
  to,
  trigger: 'level',
  level: lvl,
  requiresTrade: false,
});

const item = (from: number, to: number, name: string): EvolutionEdge => ({
  from,
  to,
  trigger: 'item',
  item: name,
  requiresTrade: false,
});

const trade = (from: number, to: number): EvolutionEdge => ({
  from,
  to,
  trigger: 'trade',
  requiresTrade: true,
});

export const RBY_EVOLUTIONS: readonly EvolutionEdge[] = [
  level(1, 2, 16), // Bulbasaur → Ivysaur
  level(2, 3, 32), // Ivysaur → Venusaur
  level(4, 5, 16), // Charmander → Charmeleon
  level(5, 6, 36), // Charmeleon → Charizard
  level(7, 8, 16), // Squirtle → Wartortle
  level(8, 9, 36), // Wartortle → Blastoise
  level(10, 11, 7), // Caterpie → Metapod
  level(11, 12, 10), // Metapod → Butterfree
  level(13, 14, 7), // Weedle → Kakuna
  level(14, 15, 10), // Kakuna → Beedrill
  level(16, 17, 18), // Pidgey → Pidgeotto
  level(17, 18, 36), // Pidgeotto → Pidgeot
  level(19, 20, 20), // Rattata → Raticate
  level(21, 22, 20), // Spearow → Fearow
  level(23, 24, 22), // Ekans → Arbok
  item(25, 26, 'Thunder Stone'), // Pikachu → Raichu
  level(27, 28, 22), // Sandshrew → Sandslash
  level(29, 30, 16), // Nidoran♀ → Nidorina
  item(30, 31, 'Moon Stone'), // Nidorina → Nidoqueen
  level(32, 33, 16), // Nidoran♂ → Nidorino
  item(33, 34, 'Moon Stone'), // Nidorino → Nidoking
  item(35, 36, 'Moon Stone'), // Clefairy → Clefable
  item(37, 38, 'Fire Stone'), // Vulpix → Ninetales
  item(39, 40, 'Moon Stone'), // Jigglypuff → Wigglytuff
  level(41, 42, 22), // Zubat → Golbat
  level(43, 44, 21), // Oddish → Gloom
  item(44, 45, 'Leaf Stone'), // Gloom → Vileplume
  level(46, 47, 24), // Paras → Parasect
  level(48, 49, 31), // Venonat → Venomoth
  level(50, 51, 26), // Diglett → Dugtrio
  level(52, 53, 28), // Meowth → Persian
  level(54, 55, 33), // Psyduck → Golduck
  level(56, 57, 28), // Mankey → Primeape
  item(58, 59, 'Fire Stone'), // Growlithe → Arcanine
  level(60, 61, 25), // Poliwag → Poliwhirl
  item(61, 62, 'Water Stone'), // Poliwhirl → Poliwrath
  level(63, 64, 16), // Abra → Kadabra
  trade(64, 65), // Kadabra → Alakazam
  level(66, 67, 28), // Machop → Machoke
  trade(67, 68), // Machoke → Machamp
  level(69, 70, 21), // Bellsprout → Weepinbell
  item(70, 71, 'Leaf Stone'), // Weepinbell → Victreebel
  level(72, 73, 30), // Tentacool → Tentacruel
  level(74, 75, 25), // Geodude → Graveler
  trade(75, 76), // Graveler → Golem
  level(77, 78, 40), // Ponyta → Rapidash
  level(79, 80, 37), // Slowpoke → Slowbro
  level(81, 82, 30), // Magnemite → Magneton
  level(84, 85, 31), // Doduo → Dodrio
  level(86, 87, 34), // Seel → Dewgong
  level(88, 89, 38), // Grimer → Muk
  item(90, 91, 'Water Stone'), // Shellder → Cloyster
  level(92, 93, 25), // Gastly → Haunter
  trade(93, 94), // Haunter → Gengar
  level(96, 97, 26), // Drowzee → Hypno
  level(98, 99, 28), // Krabby → Kingler
  level(100, 101, 30), // Voltorb → Electrode
  item(102, 103, 'Leaf Stone'), // Exeggcute → Exeggutor
  level(104, 105, 28), // Cubone → Marowak
  level(109, 110, 35), // Koffing → Weezing
  level(111, 112, 42), // Rhyhorn → Rhydon
  level(116, 117, 32), // Horsea → Seadra
  level(118, 119, 33), // Goldeen → Seaking
  item(120, 121, 'Water Stone'), // Staryu → Starmie
  level(129, 130, 20), // Magikarp → Gyarados
  item(133, 134, 'Water Stone'), // Eevee → Vaporeon
  item(133, 135, 'Thunder Stone'), // Eevee → Jolteon
  item(133, 136, 'Fire Stone'), // Eevee → Flareon
  level(138, 139, 40), // Omanyte → Omastar
  level(140, 141, 40), // Kabuto → Kabutops
  level(147, 148, 30), // Dratini → Dragonair
  level(148, 149, 55), // Dragonair → Dragonite
];
