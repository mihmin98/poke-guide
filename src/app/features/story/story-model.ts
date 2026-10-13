import type { GameView } from '../../core/domain/game-view';
import { milestoneProgress, type MilestoneProgress } from '../../core/domain/milestone-progress';
import type { GameId, Milestone, RegionId } from '../../core/domain/models';

export interface StoryRow {
  milestone: Milestone;
  done: boolean;
  location: { id: string; name: string } | undefined;
  species: { name: string; slug: string } | undefined;
}

export interface StoryPart {
  part: number;
  title: string;
  region: RegionId | undefined;
  rows: StoryRow[];
  /** Over every milestone of the part, whatever the filter shows. */
  progress: MilestoneProgress;
}

export interface StoryInput {
  view: GameView;
  game: GameId;
  done: ReadonlySet<number>;
  hideDone: boolean;
}

/** The game's milestones grouped by walkthrough part (plan §13.12). Parts the filter empties are left out. */
export function buildStory({ view, game, done, hideDone }: StoryInput): StoryPart[] {
  const byPart = new Map<number, Milestone[]>();
  for (const milestone of view.milestones) {
    const part = milestone.part[game]!;
    byPart.set(part, [...(byPart.get(part) ?? []), milestone]);
  }
  const parts: StoryPart[] = [];
  for (const [part, milestones] of byPart) {
    const walkthrough = view.walkthrough.find((w) => w.part === part);
    const rows = milestones
      .filter((m) => !hideDone || !done.has(m.no))
      .map((milestone): StoryRow => {
        const location = view.locationById.get(milestone.locationId);
        const species =
          milestone.dex === undefined ? undefined : view.speciesByDex.get(milestone.dex);
        return {
          milestone,
          done: done.has(milestone.no),
          location: location && { id: location.id, name: location.name },
          species: species && { name: species.name, slug: species.slug },
        };
      });
    if (rows.length === 0) continue;
    parts.push({
      part,
      title: walkthrough?.title ?? '',
      region: walkthrough?.region,
      rows,
      progress: milestoneProgress(milestones, done),
    });
  }
  return parts;
}
