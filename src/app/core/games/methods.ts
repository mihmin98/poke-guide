// FRAMEWORK-FREE: encounter method vocabulary. No Angular imports.
// New games add entries here (headbutt, rock-smash, swarm, dive, ...); never switch on method ids in app code.

export type EncounterMethodCategory =
  'wild' | 'fishing' | 'water' | 'gift' | 'trade' | 'static' | 'prize' | 'fossil' | 'egg';

export interface EncounterMethodDefinition {
  id: string;
  label: string;
  /** Material Symbols ligature name. */
  icon: string;
  category: EncounterMethodCategory;
  /** Sections on a location page are ordered by this value. */
  sectionOrder: number;
}

export const ENCOUNTER_METHODS: readonly EncounterMethodDefinition[] = [
  { id: 'starter', label: 'Starter', icon: 'star', category: 'gift', sectionOrder: 10 },
  { id: 'walk-grass', label: 'Grass', icon: 'grass', category: 'wild', sectionOrder: 20 },
  { id: 'walk-cave', label: 'Cave', icon: 'landscape', category: 'wild', sectionOrder: 21 },
  { id: 'walk-building', label: 'Walking', icon: 'apartment', category: 'wild', sectionOrder: 22 },
  { id: 'surf', label: 'Surfing', icon: 'waves', category: 'water', sectionOrder: 30 },
  { id: 'fish-old', label: 'Old Rod', icon: 'phishing', category: 'fishing', sectionOrder: 40 },
  { id: 'fish-good', label: 'Good Rod', icon: 'phishing', category: 'fishing', sectionOrder: 41 },
  { id: 'fish-super', label: 'Super Rod', icon: 'phishing', category: 'fishing', sectionOrder: 42 },
  { id: 'static', label: 'Static encounter', icon: 'pets', category: 'static', sectionOrder: 50 },
  { id: 'special', label: 'Special', icon: 'auto_awesome', category: 'static', sectionOrder: 51 },
  { id: 'gift', label: 'Gift', icon: 'redeem', category: 'gift', sectionOrder: 60 },
  { id: 'fossil', label: 'Fossil', icon: 'skeleton', category: 'fossil', sectionOrder: 61 },
  { id: 'purchase', label: 'Purchase', icon: 'shopping_cart', category: 'prize', sectionOrder: 70 },
  { id: 'prize', label: 'Game Corner prize', icon: 'casino', category: 'prize', sectionOrder: 71 },
  { id: 'trade', label: 'In-game trade', icon: 'swap_horiz', category: 'trade', sectionOrder: 80 },
];

const METHODS_BY_ID: ReadonlyMap<string, EncounterMethodDefinition> = new Map(
  ENCOUNTER_METHODS.map((m) => [m.id, m]),
);

export function isKnownMethod(id: string): boolean {
  return METHODS_BY_ID.has(id);
}

export function findMethod(id: string): EncounterMethodDefinition | undefined {
  return METHODS_BY_ID.get(id);
}

export function getMethod(id: string): EncounterMethodDefinition {
  const method = METHODS_BY_ID.get(id);
  if (!method) throw new Error(`Unknown encounter method: ${id}`);
  return method;
}
