/**
 * `catch/entry2` (Gold, Silver, Crystal).
 * `{{catch/entry2|dex|name|gold|silver|crystal|method|levels|morning%|day%|night%|type1=|type2=}}`, or
 * `all=N%` instead of the three rate columns. Produces one slot per time of day (a 0% time is dropped);
 * `mergeRows` collapses a species that appears alike at every time back into one slot.
 */
import type { EncounterCondition, GameId, TimeOfDay } from '../../../src/app/core/domain/models';
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
  type NormalizedMethod,
  type RawEncounterRow,
  type RawSlot,
  type WalkContext,
} from './catch-template-adapter';

const GAMES: GameId[] = ['gold', 'silver', 'crystal'];
const TIMES: TimeOfDay[] = ['morning', 'day', 'night'];

/** Method columns that only Gen II tables use (plan §16 Phase 10). */
const GEN2_METHODS: Record<string, NormalizedMethod> = {
  headbutt: { method: 'headbutt', requires: ['headbutt'] },
  'rock smash': { method: 'rock-smash', requires: ['rock-smash'] },
  egg: { method: 'egg' },
};

/** A `Swarm` row, or any row under a "During a … swarm" div (fishing swarms keep their rod column). */
function isSwarm(rawMethod: string, ctx: WalkContext): boolean {
  return /^swarm$/i.test(rawMethod) || /\bswarm\b/i.test(ctx.divLabel ?? '');
}

function normalizeGen2Method(row: RawEncounterRow, ctx: WalkContext): NormalizedMethod {
  const key = row.rawMethod.trim().toLowerCase();
  const gen2 = GEN2_METHODS[key];
  if (gen2) return { ...gen2, ...(gen2.requires ? { requires: [...gen2.requires] } : {}) };
  // Swarms replace the area's walking encounters.
  if (key === 'swarm') return { method: ctx.locationKind === 'cave' ? 'walk-cave' : 'walk-grass' };
  const basic = normalizeBasicMethod(row, ctx);
  // The contest's table is the park's grass under a "Bug-Catching Contest" div.
  if (basic.method === 'walk-grass' && /bug-catching contest/i.test(ctx.divLabel ?? '')) {
    return { method: 'bug-contest' };
  }
  return basic;
}

export const entry2Adapter: CatchTemplateAdapter = {
  id: 'entry2',
  templateNames: ['catch/entry2'],
  games: GAMES,

  parseRow(template, ctx) {
    const p = template.positional;
    const rawLevels = p[6] ?? '';
    const rawMethod = stripMarkup(p[5] ?? '');
    const levels = parseLevels(rawLevels);
    const all = template.named['all'];
    const extra: EncounterCondition[] = isSwarm(rawMethod, ctx) ? [{ kind: 'swarm' }] : [];
    const slots = TIMES.map((time, i): RawSlot => {
      const { rate, note } = parseRate(all ?? p[7 + i] ?? '');
      return {
        levels,
        rawLevels: stripMarkup(rawLevels),
        rate,
        conditions: [{ kind: 'time', value: time }, ...extra],
        ...(note ? { note } : {}),
      };
    }).filter((slot) => !(slot.rate.kind === 'percent' && slot.rate.value === 0));
    const trade = rowTrade(template);
    return {
      dex: parseDex(p[0]),
      name: stripMarkup(p[1] ?? ''),
      rawMethod,
      games: GAMES.filter((_, i) => isYes(p[2 + i])),
      slots,
      types: rowTypes(template),
      ...(trade ? { trade } : {}),
    };
  },

  normalizeMethod: normalizeGen2Method,
};
