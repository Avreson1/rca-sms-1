/**
 * What a duty roster is measured in: one named date, one named window of that
 * day, one person.
 *
 * The date rules live here rather than inside the route so the portal's answer
 * to "today" is one decision, testable without a database. This school is in Jos,
 * Plateau State, and the free host that runs the portal sits in Oregon — so the
 * server's clock is hours behind the school's. A roster that asked the machine
 * for "today" would show yesterday's duty to a teacher who walked onto the gate
 * at 07:30 West African time.
 */

/** Every duty row is filed against a date, in one of these parts of the day. */
export const DUTY_TIME_WINDOWS = [
  "Before School",
  "Morning Assembly",
  "Break Time",
  "Lunch Break",
  "After School",
  "All Day",
] as const;

export type DutyTimeWindow = (typeof DUTY_TIME_WINDOWS)[number];

export function isDutyTimeWindow(value: unknown): value is DutyTimeWindow {
  return typeof value === "string" && (DUTY_TIME_WINDOWS as readonly string[]).includes(value);
}

/**
 * Names the school uses for its standing duties, offered as suggestions in the
 * roster editor. A duty may be typed as anything, so this list is a convenience
 * and never a limit — and nothing here is ever filed on anyone's behalf.
 */
export const DUTY_SUGGESTIONS = [
  "Morning Assembly Duty",
  "Gate Duty",
  "Corridor & Veranda Duty",
  "Compound Cleaning Supervision",
  "Uniform & Inspection Duty",
  "Break Time Supervision",
  "Canteen Duty",
  "Library Duty",
  "Infirmary / First Aid Duty",
  "Lost & Found Duty",
] as const;

export const SCHOOL_TIME_ZONE = "Africa/Lagos";

export const SCHOOL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

/** The school's date, not the host machine's: 2026-11-05. */
export function schoolToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * A plain YYYY-MM-DD for a date a roster can actually be filed against.
 *
 * The bounds are the migration's own CHECK, restated here so the screen refuses
 * a mistyped year with a sentence instead of a database error code: a duty filed
 * for 2126-11-05 is a typo, and it would sit unread on the register for a
 * century.
 */
export function isValidDutyDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(stamp)) return false;
  // Round-trip: a date that Postgres would clamp (2026-02-31) is refused here.
  if (new Date(stamp).toISOString().slice(0, 10) !== value) return false;
  return stamp >= Date.parse("2020-01-01T00:00:00Z") && stamp <= Date.parse("2100-12-31T00:00:00Z");
}

export function weekdayName(date: string): string {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(stamp)) return "";
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date(stamp).getUTCDay()];
}

export function formatDutyDate(date: string): string {
  if (!isValidDutyDate(date)) return date;
  const [year, month, day] = date.split("-");
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${weekdayName(date)} ${Number(day)} ${names[Number(month) - 1]} ${year}`;
}

/**
 * The Monday-to-Friday week that contains this date, oldest first.
 *
 * A weekend date belongs to the working week that follows it, so the roster an
 * office lays out on a Saturday morning is the week the school is about to have —
 * and Saturday and Sunday, which are next to each other, do not open two different
 * weeks. The week before is one press of the left arrow away.
 */
export function schoolWeekContaining(date: string): string[] {
  const anchor = isValidDutyDate(date) ? date : schoolToday();
  const stamp = Date.parse(`${anchor}T00:00:00Z`);
  const weekday = new Date(stamp).getUTCDay();
  const offsetToMonday = weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday;
  return SCHOOL_DAYS.map((_, index) =>
    new Date(stamp + (offsetToMonday + index) * 86_400_000).toISOString().slice(0, 10)
  );
}

/**
 * True when the school's timetable has no teaching day on this date. The roster
 * still allows a weekend duty — a school that runs inter-house games on Saturday
 * needs it — but the screen says which days it is printing, so nobody mistakes a
 * Saturday assignment for a normal school week.
 */
export function isSchoolWeekday(date: string): boolean {
  return (SCHOOL_DAYS as readonly string[]).includes(weekdayName(date));
}
