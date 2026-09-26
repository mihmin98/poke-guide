/**
 * Authoritative Generation II evolution graph (plan §7.6, §16 Phase 10). Parsed evolution boxes are only diffed
 * against it. Generated from pret's `data/pokemon/evos_attacks.asm`, which is identical in pokegold (Gold/Silver)
 * and pokecrystal (commits 0f087a5 and e058e4f):
 * - https://github.com/pret/pokecrystal/blob/master/data/pokemon/evos_attacks.asm
 * - https://github.com/pret/pokegold/blob/master/data/pokemon/evos_attacks.asm
 *
 * Friendship evolutions (`EVOLVE_HAPPINESS`) need 220 friendship; Espeon's `TR_MORNDAY` (morning or day) is stored
 * as `day`. Tyrogue's `EVOLVE_STAT` edges are level edges with a stat comparison. Item names follow the evolution
 * boxes (`Thunder Stone`, `Upgrade`), like the Generation I override.
 */
import type { EvolutionEdge, TimeOfDay } from '../../../../../src/app/core/domain/models';

const level = (from: number, to: number, lvl: number): EvolutionEdge => ({
  from,
  to,
  trigger: 'level',
  level: lvl,
  requiresTrade: false,
});

const stat = (
  from: number,
  to: number,
  lvl: number,
  comparison: NonNullable<EvolutionEdge['stat']>,
): EvolutionEdge => ({
  from,
  to,
  trigger: 'level',
  level: lvl,
  stat: comparison,
  requiresTrade: false,
});

const item = (from: number, to: number, name: string): EvolutionEdge => ({
  from,
  to,
  trigger: 'item',
  item: name,
  requiresTrade: false,
});

const friendship = (from: number, to: number, timeOfDay?: TimeOfDay): EvolutionEdge => ({
  from,
  to,
  trigger: 'friendship',
  ...(timeOfDay ? { timeOfDay } : {}),
  requiresTrade: false,
});

const trade = (from: number, to: number, heldItem?: string): EvolutionEdge => ({
  from,
  to,
  trigger: 'trade',
  ...(heldItem ? { heldItem } : {}),
  requiresTrade: true,
});

export const GSC_EVOLUTIONS: readonly EvolutionEdge[] = [
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
  friendship(42, 169), // Golbat → Crobat
  level(43, 44, 21), // Oddish → Gloom
  item(44, 45, 'Leaf Stone'), // Gloom → Vileplume
  item(44, 182, 'Sun Stone'), // Gloom → Bellossom
  level(46, 47, 24), // Paras → Parasect
  level(48, 49, 31), // Venonat → Venomoth
  level(50, 51, 26), // Diglett → Dugtrio
  level(52, 53, 28), // Meowth → Persian
  level(54, 55, 33), // Psyduck → Golduck
  level(56, 57, 28), // Mankey → Primeape
  item(58, 59, 'Fire Stone'), // Growlithe → Arcanine
  level(60, 61, 25), // Poliwag → Poliwhirl
  item(61, 62, 'Water Stone'), // Poliwhirl → Poliwrath
  trade(61, 186, "King's Rock"), // Poliwhirl → Politoed
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
  trade(79, 199, "King's Rock"), // Slowpoke → Slowking
  level(81, 82, 30), // Magnemite → Magneton
  level(84, 85, 31), // Doduo → Dodrio
  level(86, 87, 34), // Seel → Dewgong
  level(88, 89, 38), // Grimer → Muk
  item(90, 91, 'Water Stone'), // Shellder → Cloyster
  level(92, 93, 25), // Gastly → Haunter
  trade(93, 94), // Haunter → Gengar
  trade(95, 208, 'Metal Coat'), // Onix → Steelix
  level(96, 97, 26), // Drowzee → Hypno
  level(98, 99, 28), // Krabby → Kingler
  level(100, 101, 30), // Voltorb → Electrode
  item(102, 103, 'Leaf Stone'), // Exeggcute → Exeggutor
  level(104, 105, 28), // Cubone → Marowak
  level(109, 110, 35), // Koffing → Weezing
  level(111, 112, 42), // Rhyhorn → Rhydon
  friendship(113, 242), // Chansey → Blissey
  level(116, 117, 32), // Horsea → Seadra
  trade(117, 230, 'Dragon Scale'), // Seadra → Kingdra
  level(118, 119, 33), // Goldeen → Seaking
  item(120, 121, 'Water Stone'), // Staryu → Starmie
  trade(123, 212, 'Metal Coat'), // Scyther → Scizor
  level(129, 130, 20), // Magikarp → Gyarados
  item(133, 134, 'Water Stone'), // Eevee → Vaporeon
  item(133, 135, 'Thunder Stone'), // Eevee → Jolteon
  item(133, 136, 'Fire Stone'), // Eevee → Flareon
  friendship(133, 196, 'day'), // Eevee → Espeon
  friendship(133, 197, 'night'), // Eevee → Umbreon
  trade(137, 233, 'Upgrade'), // Porygon → Porygon2
  level(138, 139, 40), // Omanyte → Omastar
  level(140, 141, 40), // Kabuto → Kabutops
  level(147, 148, 30), // Dratini → Dragonair
  level(148, 149, 55), // Dragonair → Dragonite
  level(152, 153, 16), // Chikorita → Bayleef
  level(153, 154, 32), // Bayleef → Meganium
  level(155, 156, 14), // Cyndaquil → Quilava
  level(156, 157, 36), // Quilava → Typhlosion
  level(158, 159, 18), // Totodile → Croconaw
  level(159, 160, 30), // Croconaw → Feraligatr
  level(161, 162, 15), // Sentret → Furret
  level(163, 164, 20), // Hoothoot → Noctowl
  level(165, 166, 18), // Ledyba → Ledian
  level(167, 168, 22), // Spinarak → Ariados
  level(170, 171, 27), // Chinchou → Lanturn
  friendship(172, 25), // Pichu → Pikachu
  friendship(173, 35), // Cleffa → Clefairy
  friendship(174, 39), // Igglybuff → Jigglypuff
  friendship(175, 176), // Togepi → Togetic
  level(177, 178, 25), // Natu → Xatu
  level(179, 180, 15), // Mareep → Flaaffy
  level(180, 181, 30), // Flaaffy → Ampharos
  level(183, 184, 18), // Marill → Azumarill
  level(187, 188, 18), // Hoppip → Skiploom
  level(188, 189, 27), // Skiploom → Jumpluff
  item(191, 192, 'Sun Stone'), // Sunkern → Sunflora
  level(194, 195, 20), // Wooper → Quagsire
  level(204, 205, 31), // Pineco → Forretress
  level(209, 210, 23), // Snubbull → Granbull
  level(216, 217, 30), // Teddiursa → Ursaring
  level(218, 219, 38), // Slugma → Magcargo
  level(220, 221, 33), // Swinub → Piloswine
  level(223, 224, 25), // Remoraid → Octillery
  level(228, 229, 24), // Houndour → Houndoom
  level(231, 232, 25), // Phanpy → Donphan
  stat(236, 106, 20, 'atk>def'), // Tyrogue → Hitmonlee
  stat(236, 107, 20, 'atk<def'), // Tyrogue → Hitmonchan
  stat(236, 237, 20, 'atk=def'), // Tyrogue → Hitmontop
  level(238, 124, 30), // Smoochum → Jynx
  level(239, 125, 30), // Elekid → Electabuzz
  level(240, 126, 30), // Magby → Magmar
  level(246, 247, 30), // Larvitar → Pupitar
  level(247, 248, 55), // Pupitar → Tyranitar
];
