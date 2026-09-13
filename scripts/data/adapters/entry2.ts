/**
 * `catch/entry2` (Gold, Silver, Crystal). EXTENSIBILITY SPIKE: tests only until Crystal is added (plan §16 Phase 1).
 * `{{catch/entry2|dex|name|gold|silver|crystal|method|levels|morning%|day%|night%|type1=|type2=}}`
 * Produces one slot per time of day; a 0% rate means the species doesn't appear at that time.
 */
import type { GameId, TimeOfDay } from '../../../src/app/core/domain/models';
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
  type RawSlot,
} from './catch-template-adapter';

const GAMES: GameId[] = ['gold', 'silver', 'crystal'];
const TIMES: TimeOfDay[] = ['morning', 'day', 'night'];

export const entry2Adapter: CatchTemplateAdapter = {
  id: 'entry2',
  templateNames: ['catch/entry2'],
  games: GAMES,

  parseRow(template) {
    const p = template.positional;
    const rawLevels = p[6] ?? '';
    const levels = parseLevels(rawLevels);
    const slots = TIMES.map((time, i): RawSlot => {
      const { rate, note } = parseRate(p[7 + i] ?? '');
      return {
        levels,
        rawLevels: stripMarkup(rawLevels),
        rate,
        conditions: [{ kind: 'time', value: time }],
        ...(note ? { note } : {}),
      };
    }).filter((slot) => !(slot.rate.kind === 'percent' && slot.rate.value === 0));
    const trade = rowTrade(template);
    return {
      dex: parseDex(p[0]),
      name: stripMarkup(p[1] ?? ''),
      rawMethod: stripMarkup(p[5] ?? ''),
      games: GAMES.filter((_, i) => isYes(p[2 + i])),
      slots,
      types: rowTypes(template),
      ...(trade ? { trade } : {}),
    };
  },

  normalizeMethod: normalizeBasicMethod,
};
