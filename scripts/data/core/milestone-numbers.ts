/**
 * Stable milestone numbers (plan §7.14, Phase 11). Profiles store done milestones as `Milestone.no`, and `PKG3`
 * codes carry them, so a number must keep pointing at the same milestone across rebuilds and is never reused.
 *
 * Milestones are curated, so unlike items (`item-numbers.ts`) they match the committed registry
 * (`version-groups/<id>/milestone-numbers.json`) exactly, by `id`. New ids get new numbers; a registered id
 * that's gone is an error until `retired` lists its number. Pure functions; `assemble.ts` turns the messages
 * into build issues and `build.ts` writes the registry.
 */
import type { Milestone } from '../../../src/app/core/domain/models';

/** A curated milestone, before it has a number. */
export type MilestoneDefinition = Omit<Milestone, 'no'>;

export interface MilestoneNumberEntry {
  no: number;
  id: string;
}

export interface MilestoneNumberRegistry {
  versionGroupId: string;
  /** The next number to hand out; it never goes down, so retired numbers are never reused. */
  next: number;
  /** Live milestones, sorted by number. */
  milestones: MilestoneNumberEntry[];
}

export interface RetiredMilestone {
  no: number;
  reason: string;
}

export interface MilestoneNumberResult {
  /** The definitions with their numbers, in list order. */
  milestones: Milestone[];
  registry: MilestoneNumberRegistry;
  errors: string[];
  notes: string[];
}

/** `previous` is `null` for a version group that has no registry yet. */
export function assignMilestoneNumbers(
  definitions: readonly MilestoneDefinition[],
  previous: MilestoneNumberRegistry | null,
  retired: readonly RetiredMilestone[],
  versionGroupId: string,
): MilestoneNumberResult {
  const errors: string[] = [];
  const notes: string[] = [];
  let next = previous?.next ?? 1;

  if (previous && previous.versionGroupId !== versionGroupId)
    errors.push(
      `Milestone number registry is for "${previous.versionGroupId}", not "${versionGroupId}"`,
    );
  const byId = new Map<string, MilestoneNumberEntry>();
  const seen = new Set<number>();
  for (const entry of previous?.milestones ?? []) {
    if (!Number.isInteger(entry.no) || entry.no < 1 || entry.no >= next || seen.has(entry.no))
      errors.push(`Milestone number registry has an invalid or duplicate number ${entry.no}`);
    if (byId.has(entry.id)) errors.push(`Milestone number registry lists "${entry.id}" twice`);
    seen.add(entry.no);
    byId.set(entry.id, entry);
  }

  const ids = new Set<string>();
  for (const { id } of definitions) {
    if (ids.has(id)) errors.push(`Milestone id "${id}" is used twice`);
    ids.add(id);
  }

  const retiredByNo = new Map(retired.map((r) => [r.no, r]));
  let added = 0;
  const milestones = definitions.map((definition): Milestone => {
    const known = byId.get(definition.id);
    if (known && retiredByNo.has(known.no))
      errors.push(`Milestone #${known.no} "${definition.id}" is retired but still in the list`);
    const no = known?.no ?? next++;
    if (!known) added++;
    return { no, ...definition };
  });

  for (const entry of previous?.milestones ?? []) {
    if (ids.has(entry.id)) continue;
    if (retiredByNo.has(entry.no)) notes.push(`Retired milestone #${entry.no} "${entry.id}"`);
    else
      errors.push(
        `Milestone #${entry.no} "${entry.id}" is no longer in the list. If it's really gone (or was ` +
          'renamed), add its number to the retired milestones with a reason; it is never reused.',
      );
  }
  for (const r of retired) {
    if (!Number.isInteger(r.no) || r.no < 1 || r.no >= next)
      errors.push(`Retired milestone number ${r.no} was never handed out`);
  }
  if (previous && added > 0) notes.push(`${added} new milestone number(s), up to #${next - 1}`);

  const entries = milestones
    .map(({ no, id }) => ({ no, id }))
    .filter((e, i, all) => all.findIndex((o) => o.id === e.id) === i)
    .sort((a, b) => a.no - b.no);
  return {
    milestones,
    registry: { versionGroupId, next, milestones: entries },
    errors,
    notes,
  };
}

/** One entry per line, so a rebuild's changes read well in a diff. */
export function formatMilestoneNumbers(registry: MilestoneNumberRegistry): string {
  const lines = registry.milestones.map((entry) => `    ${JSON.stringify(entry)}`);
  return (
    `{\n  "versionGroupId": ${JSON.stringify(registry.versionGroupId)},\n` +
    `  "next": ${registry.next},\n  "milestones": [\n${lines.join(',\n')}\n  ]\n}\n`
  );
}

/** Reads a registry file's JSON; throws when its shape is wrong, since numbers must never be guessed. */
export function parseMilestoneNumbers(text: string): MilestoneNumberRegistry {
  const raw = JSON.parse(text) as Partial<MilestoneNumberRegistry>;
  if (
    typeof raw.versionGroupId !== 'string' ||
    !Number.isInteger(raw.next) ||
    !Array.isArray(raw.milestones) ||
    raw.milestones.some((e) => !Number.isInteger(e.no) || typeof e.id !== 'string')
  ) {
    throw new Error('The milestone number registry is malformed');
  }
  return raw as MilestoneNumberRegistry;
}
