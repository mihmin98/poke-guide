/**
 * `catch/entry1` (Red, Blue, Yellow), plan §3.3:
 * `{{catch/entry1|dex|name|red|blue|yellow|method|levels|rate|type1=|type2=}}`, plus `tradenum=`/`tradename=` on trade rows.
 */
import type { GameId } from '../../../src/app/core/domain/models';
import { parseLevels } from '../core/levels';
import { stripMarkup } from '../core/markup';
import { parseRate } from '../core/rate';
import {
  isYes,
  normalizeBasicMethod,
  parseDex,
  rowTrade,
  rowTypes,
  type CatchTemplateAdapter,
} from './catch-template-adapter';

const GAMES: GameId[] = ['red', 'blue', 'yellow'];

export const entry1Adapter: CatchTemplateAdapter = {
  id: 'entry1',
  templateNames: ['catch/entry1'],
  games: GAMES,

  parseRow(template) {
    const p = template.positional;
    const rawLevels = p[6] ?? '';
    // A few pages write the rate as `all=100%` (HeartGold/SoulSilver shorthand), e.g. Route 19 Magikarp.
    const { rate, note } = parseRate(p[7] ?? template.named['all'] ?? '');
    const trade = rowTrade(template);
    return {
      dex: parseDex(p[0]),
      name: stripMarkup(p[1] ?? ''),
      rawMethod: stripMarkup(p[5] ?? ''),
      games: GAMES.filter((_, i) => isYes(p[2 + i])),
      slots: [
        { levels: parseLevels(rawLevels), rawLevels: stripMarkup(rawLevels), rate, ...(note ? { note } : {}) },
      ],
      types: rowTypes(template),
      ...(trade ? { trade } : {}),
    };
  },

  normalizeMethod: normalizeBasicMethod,
};
