import type { EvolutionEdge } from '../core/domain/models';
import { timeOfDayLabel } from '../core/games/conditions';

const STAT_TEXT: Record<NonNullable<EvolutionEdge['stat']>, string> = {
  'atk>def': 'Attack > Defense',
  'atk<def': 'Attack < Defense',
  'atk=def': 'Attack = Defense',
};

/** `Lv 16` · `Moon Stone` · `Friendship, day` · `Lv 20, Attack > Defense` · `Trade holding Metal Coat`. */
export function evolutionDetailText(edge: EvolutionEdge): string {
  const extras = [
    edge.timeOfDay && timeOfDayLabel(edge.timeOfDay).toLowerCase(),
    edge.stat && STAT_TEXT[edge.stat],
  ].filter((extra): extra is string => !!extra);
  const withExtras = (text: string) => [text, ...extras].join(', ');
  switch (edge.trigger) {
    case 'level':
      return withExtras(edge.level === undefined ? 'Level up' : `Lv ${edge.level}`);
    case 'item':
      return withExtras(edge.item ?? 'Use an item');
    case 'friendship':
      return withExtras('Friendship');
    case 'trade': {
      const held = edge.heldItem ?? edge.item;
      return withExtras(held ? `Trade holding ${held}` : 'Trade');
    }
    default:
      return withExtras(edge.condition ?? 'Special');
  }
}
