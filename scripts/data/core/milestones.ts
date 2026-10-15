/**
 * Story milestones against the walkthrough part pages (plan §7.14, Phase 11). The milestone list is curated;
 * these checks only catch drift, so every finding is a warning for the report: a badge a part awards ("awards you
 * the {{badge|Boulder}}", or Crystal's "award the {{badge|Rising}}") needs a `gym` milestone with that badge in that
 * part, and a gym milestone's badge must be awarded on its part's page.
 * Battles are matched to their `{{Party}}` blocks in `parties.ts` (Phase 19), which warns about a party no milestone
 * claims. Pure; the cross-references against locations, unlocks and encounters are in `validate.ts`.
 */
import type { GameId, Milestone } from '../../../src/app/core/domain/models';

export interface WalkthroughPartPage {
  game: GameId;
  part: number;
  page: string;
  wikitext: string;
}

const AWARDED_BADGE = /awards? (?:you )?the \{\{badge\|([^}|]+)/gi;

/** Badges awarded on a walkthrough page, in page order. */
export function awardedBadges(wikitext: string): string[] {
  return [...wikitext.matchAll(AWARDED_BADGE)].map((m) => m[1]!.trim());
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
  }
  return warnings;
}
