// FRAMEWORK-FREE: story milestone labels and counts (plan §13.12, Phase 11). No Angular imports.
import type { Milestone, MilestoneKind } from './models';

const KIND_LABELS: Record<MilestoneKind, string> = {
  gym: 'Gym',
  battle: 'Battle',
  event: 'Event',
  'key-item': 'Key item',
  encounter: 'Encounter',
  gift: 'Gift',
};

export function milestoneKindLabel(kind: MilestoneKind): string {
  return KIND_LABELS[kind];
}

export interface MilestoneProgress {
  done: number;
  total: number;
}

/** Milestones done out of `milestones`. Never part of any "caught" figure. */
export function milestoneProgress(
  milestones: readonly Milestone[],
  done: ReadonlySet<number>,
): MilestoneProgress {
  return { done: milestones.filter((m) => done.has(m.no)).length, total: milestones.length };
}
