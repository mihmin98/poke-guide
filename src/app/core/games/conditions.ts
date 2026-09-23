// FRAMEWORK-FREE: encounter condition vocabulary. No Angular imports.

export type TimeOfDay = 'morning' | 'day' | 'night';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type EncounterCondition =
  | { kind: 'time'; value: TimeOfDay }
  | { kind: 'day-of-week'; value: DayOfWeek }
  | { kind: 'swarm' }
  | { kind: 'season'; value: Season }
  | { kind: 'story'; text: string };

export type EncounterConditionKind = EncounterCondition['kind'];

type ConditionOf<K extends EncounterConditionKind> = Extract<EncounterCondition, { kind: K }>;

export interface ConditionKindDefinition<K extends EncounterConditionKind> {
  kind: K;
  label: string;
  /**
   * `column`: a small, closed set of values rendered as columns in encounter tables (e.g. time of day).
   * `chip`: rendered as a chip next to the encounter.
   */
  display: 'column' | 'chip';
  format(condition: ConditionOf<K>): string;
}

export const TIMES_OF_DAY: readonly TimeOfDay[] = ['morning', 'day', 'night'];
const TIME_LABELS: Record<TimeOfDay, string> = { morning: 'Morning', day: 'Day', night: 'Night' };
/** In-game clock hours of each period (Gen II), for column tooltips. */
const TIME_HOURS: Record<TimeOfDay, string> = {
  morning: '4:00–9:59',
  day: '10:00–17:59',
  night: '18:00–3:59',
};

export function timeOfDayLabel(time: TimeOfDay): string {
  return TIME_LABELS[time];
}

export function timeOfDayHours(time: TimeOfDay): string {
  return TIME_HOURS[time];
}
const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export const CONDITION_KINDS: { [K in EncounterConditionKind]: ConditionKindDefinition<K> } = {
  time: {
    kind: 'time',
    label: 'Time of day',
    display: 'column',
    format: (c) => TIME_LABELS[c.value],
  },
  'day-of-week': {
    kind: 'day-of-week',
    label: 'Day of week',
    display: 'chip',
    format: (c) => DAY_LABELS[c.value],
  },
  swarm: { kind: 'swarm', label: 'Swarm', display: 'chip', format: () => 'Swarm' },
  season: {
    kind: 'season',
    label: 'Season',
    display: 'chip',
    format: (c) => SEASON_LABELS[c.value],
  },
  story: { kind: 'story', label: 'Story', display: 'chip', format: (c) => c.text },
};

export function formatCondition(condition: EncounterCondition): string {
  const definition = CONDITION_KINDS[condition.kind] as ConditionKindDefinition<
    typeof condition.kind
  >;
  return definition.format(condition as never);
}
