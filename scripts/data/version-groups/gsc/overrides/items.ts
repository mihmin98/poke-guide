/**
 * Gold/Silver/Crystal item overrides (plan §7.13). Stage C of Phase 10 only covers the requirement phrases; the
 * walkthrough cross-check is triaged in Stage E.
 */
import type { ItemOverrides } from '../../../core/location-items';

export const GSC_ITEM_OVERRIDES: ItemOverrides = {
  requirementPhrases: {
    // Walkthroughs sometimes name the move without {{m|…}}.
    Surf: 'surf',
    Waterfall: 'waterfall',
    // Phone-call gifts that need a species in the party: a condition, not an unlock.
    'Marill in the party': null,
    'Pikachu in the party': null,
  },
  add: [],
  requires: [],
  choiceGroups: [],
};
