/**
 * Story milestones against the walkthrough part pages (plan §7.14, Phase 11). The milestone list is curated;
 * these checks only catch drift, so every finding is a warning for the report:
 * - a badge a part awards ("awards you the {{badge|Boulder}}", or Crystal's "award the {{badge|Rising}}") needs a `gym` milestone with that badge in that
 *   part, and a gym milestone's badge must be awarded on its part's page;
 * - a part's `{{Party}}` blocks (the important battles) shouldn't outnumber its `gym` and `battle` milestones.
 *   Consecutive blocks for the same battle (one per starter, or per rival Eevee evolution in Yellow) count once.
 * Pure; the cross-references against locations, unlocks and encounters are in `validate.ts`.
 */
import type { GameId, Milestone } from '../../../src/app/core/domain/models';
import { findTemplates } from './wikitext';

export interface WalkthroughPartPage {
  game: GameId;
  part: number;
  page: string;
  wikitext: string;
}

const PARTY_OPENING = /\{\{\s*Party\s*(?=[|}\n])/gi;
const AWARDED_BADGE = /awards? (?:you )?the \{\{badge\|([^}|]+)/gi;

/** Badges awarded on a walkthrough page, in page order. */
export function awardedBadges(wikitext: string): string[] {
  return [...wikitext.matchAll(AWARDED_BADGE)].map((m) => m[1]!.trim());
}

/**
 * The number of distinct battles on a walkthrough page: `{{Party}}` blocks, with runs of variants of one
 * battle (same location, prize and sprite) counted once.
 */
export function countPartyBattles(wikitext: string): number {
  let count = 0;
  let previous: string | undefined;
  // Party blocks sit inside other templates (a Gym's box), so they're found by their opening, not top-level.
  for (const match of wikitext.matchAll(PARTY_OPENING)) {
    const block = findTemplates(wikitext, match.index)[0];
    if (!block || block.start !== match.index) continue;
    const key = ['location', 'prize', 'sprite']
      .map((p) => (block.named[p] ?? '').toLowerCase())
      .join('|');
    if (key !== previous) count++;
    previous = key;
  }
  return count;
}

export function checkMilestonesAgainstWalkthrough(
  milestones: readonly Milestone[],
  pages: readonly WalkthroughPartPage[],
): { page: string; message: string }[] {
  const warnings: { page: string; message: string }[] = [];
  for (const { game, part, page, wikitext } of pages) {
    const here = milestones.filter((m) => m.part[game] === part);
    const gymBadges = here.filter((m) => m.kind === 'gym').map((m) => m.badge);
    const awarded = awardedBadges(wikitext);
    for (const badge of awarded) {
      if (!gymBadges.includes(badge))
        warnings.push({
          page,
          message: `${game} Part ${part} awards the ${badge} Badge, but no gym milestone there has it`,
        });
    }
    for (const gym of here.filter((m) => m.kind === 'gym')) {
      if (!gym.badge || !awarded.includes(gym.badge))
        warnings.push({
          page,
          message: `Gym milestone "${gym.id}" (${gym.badge ?? 'no badge'}) isn't awarded on ${game} Part ${part}`,
        });
    }
    const battles = countPartyBattles(wikitext);
    const listed = here.filter((m) => m.kind === 'gym' || m.kind === 'battle').length;
    if (battles > listed)
      warnings.push({
        page,
        message: `${game} Part ${part} has ${battles} battle(s) with a {{Party}} block, but only ${listed} gym or battle milestone(s)`,
      });
  }
  return warnings;
}
