/**
 * Red/Blue/Yellow unlocks (plan §7.7, §7.13): field moves, key items and story gates that encounters and items can
 * require. `part` is the walkthrough part where the unlock is obtained; the three games share it.
 */
import type { Unlock } from '../../../../../src/app/core/domain/models';

export const RBY_UNLOCKS: readonly Unlock[] = [
  { id: 'route-25-jr-trainer', label: 'Defeat the Jr. Trainer♂ on Route 25', kind: 'story', locationId: 'route-25', part: 5 },
  { id: 'ss-ticket', label: 'S.S. Ticket', kind: 'key-item', locationId: 'sea-cottage', part: 5 },
  { id: 'cut', label: 'Cut', kind: 'move', locationId: 'ss-anne', part: 6 },
  { id: 'old-rod', label: 'Old Rod', kind: 'key-item', locationId: 'vermilion-city', part: 6 },
  { id: 'coin-case', label: 'Coin Case', kind: 'key-item', locationId: 'celadon-city', part: 9 },
  { id: 'lift-key', label: 'Lift Key', kind: 'key-item', locationId: 'team-rocket-hideout', part: 9 },
  { id: 'silph-scope', label: 'Silph Scope', kind: 'key-item', locationId: 'team-rocket-hideout', part: 9 },
  { id: 'poke-flute', label: 'Poké Flute', kind: 'key-item', locationId: 'pokemon-tower', part: 9 },
  { id: 'card-key', label: 'Card Key', kind: 'key-item', locationId: 'silph-co', part: 10 },
  { id: 'good-rod', label: 'Good Rod', kind: 'key-item', locationId: 'fuchsia-city', part: 11 },
  { id: 'surf', label: 'Surf', kind: 'move', locationId: 'safari-zone', part: 11 },
  { id: 'strength', label: 'Strength', kind: 'move', locationId: 'fuchsia-city', part: 11 },
  { id: 'super-rod', label: 'Super Rod', kind: 'key-item', locationId: 'route-12', part: 12 },
  { id: 'secret-key', label: 'Secret Key', kind: 'key-item', locationId: 'pokemon-mansion', part: 13 },
  { id: 'post-game', label: 'Become Champion', kind: 'story', locationId: 'cerulean-cave', part: 17 },
];
