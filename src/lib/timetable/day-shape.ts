/**
 * What a school day is, and what it was when nobody had told the portal.
 *
 * Six periods of forty-five minutes, five days, with a short and a long break,
 * used to be an array typed into the timetable screen. That made it a fact about
 * every school the portal is cloned for: a school that runs seven periods, or a
 * four-day week, could not say so without a rebuild. The school's own shape now
 * lives in `timetable_periods` and is read from there; these are the values shown
 * when the school has filed none, and a screen that uses them says so.
 */

export interface TimetablePeriod {
  /** A real slot a lesson can be filed into is 0 and up. Breaks are negative. */
  index: number;
  label: string;
  is_break?: boolean;
}

export const DEFAULT_TIMETABLE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** The day the portal has always printed, kept as the fallback it is admitted to be. */
export const DEFAULT_TIMETABLE_PERIODS: TimetablePeriod[] = [
  { index: 0, label: "Period 1 (08:00 - 08:45 AM)" },
  { index: 1, label: "Period 2 (08:45 - 09:30 AM)" },
  { index: -1, label: "Short Break (09:30 - 10:00 AM)", is_break: true },
  { index: 2, label: "Period 3 (10:00 - 10:45 AM)" },
  { index: 3, label: "Period 4 (10:45 - 11:30 AM)" },
  { index: -2, label: "Long Break & Lunch (11:30 - 12:15 PM)", is_break: true },
  { index: 4, label: "Period 5 (12:15 - 01:00 PM)" },
  { index: 5, label: "Period 6 (01:00 - 01:45 PM)" },
];

/** The slots a lesson may be filed into. A break is not a lesson, so it is never one. */
export function teachablePeriods(periods: TimetablePeriod[]): TimetablePeriod[] {
  return periods.filter((period) => !period.is_break && period.index >= 0);
}

/** How many lessons one class could hold in a week at this shape. */
export function weeklySlots(periods: TimetablePeriod[], days: string[]): number {
  return teachablePeriods(periods).length * days.length;
}

export function periodLabel(periods: TimetablePeriod[], index: number): string {
  return periods.find((period) => period.index === index)?.label ?? `Period ${index + 1}`;
}
