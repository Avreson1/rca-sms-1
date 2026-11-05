/**
 * Builds a timetable draft from what the school asked for, and says what it could
 * not place.
 *
 * The plan comes in from a person: which class needs which subject, how many
 * periods of it, and who teaches it. Nothing here chooses a subject for a class or
 * invents a teacher for a lesson — the school's records do not say which staff
 * member teaches which subject well enough to stake a printed schedule on it, and a
 * guess in a draft becomes a fact the moment somebody files it.
 *
 * What it does decide is *when*: a teacher is never in two class arms at the same
 * time (judged by the same rule that refuses a hand-filed lesson, in
 * `src/lib/timetable/clashes.ts`), a lesson never lands in a slot the school has
 * already filled while the draft is asked to keep those lessons, and a class's
 * subjects are spread over the week instead of stacked onto Monday, because a
 * timetable that puts six periods of the same subject on one day is corrected by
 * hand and the correction is then invisible to whoever reads the draft.
 *
 * The output is a draft. It is not saved anywhere; a human reads it and files it.
 */
import { findTeacherClash, isUnassigned, type TimetableLesson } from "./clashes";
import { periodLabel, teachablePeriods, type TimetablePeriod } from "./day-shape";

export interface GenerationDemand {
  class_name: string;
  subject: string;
  /** Empty means the school has not named who teaches it; the slot stays a gap. */
  teacher_name: string;
  teacher_ref?: string | null;
  periods_wanted: number;
}

export interface GenerationOptions {
  /**
   * A cap the school states. There is deliberately no default: the portal has no
   * record of how many periods one teacher may hold, and inventing a number would
   * silently refuse lessons the office never refused.
   */
  maxPeriodsPerTeacher?: number | null;
}

export interface DraftLesson extends TimetableLesson {
  period_label: string;
  /** False for the rows this run placed, true for what the school already holds. */
  onSchoolRecord: boolean;
}

export interface UnplacedDemand {
  class_name: string;
  subject: string;
  teacher_name: string;
  wanted: number;
  placed: number;
  reason: string;
}

export interface EmptySlot {
  class_name: string;
  day: string;
  period_index: number;
  period_label: string;
}

export interface GenerationResult {
  lessons: DraftLesson[];
  unplaced: UnplacedDemand[];
  emptySlots: EmptySlot[];
  weeklySlots: number;
  dayShapeFromSchoolRecords: boolean;
}

interface Slot {
  day: string;
  index: number;
  label: string;
}

function slotKey(className: string, day: string, index: number): string {
  return `${className}|${day}|${index}`;
}

/**
 * One teacher counted as the clash rule counts them: by staff id when the plan
 * carries one, otherwise by the typed name. Two rows that spell "Mrs Okon"
 * differently but name the same staff id are one person, and a load limit that
 * called them two would let a teacher be given twice the periods the school allows.
 */
function teacherKey(teacherName: string, teacherRef?: string | null): string {
  const ref = (teacherRef ?? "").trim();
  if (ref) return `ref:${ref}`;
  return `name:${teacherName.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/**
 * How much this slot would unbalance the week, from the class's point of view.
 *
 * A day that already holds lessons is worse than an empty one, the same subject
 * appearing on a day twice is worse still, and otherwise the earliest period wins
 * so the same plan produces the same draft every time it is asked for.
 */
function slotCost(
  slot: Slot,
  demand: GenerationDemand,
  dayCount: Map<string, number>,
  subjectDayCount: Map<string, number>,
  order: number
): number {
  const dayLoad = dayCount.get(`${demand.class_name}|${slot.day}`) ?? 0;
  const subjectOnDay = subjectDayCount.get(`${demand.class_name}|${demand.subject}|${slot.day}`) ?? 0;
  return subjectOnDay * 1000 + dayLoad * 100 + order;
}

/**
 * Files the plan into the week, or says which parts of it do not fit.
 *
 * `existing` is what the school already holds for this session and term; the draft
 * is built around it, never over it. A person who wants a whole week rebuilt clears
 * the class first — the screen says so — rather than the generator quietly
 * burying lessons it was never told to move.
 */
export function buildTimetableDraft(
  input: {
    session: string;
    term: string;
    demands: GenerationDemand[];
    periods: TimetablePeriod[];
    days: string[];
    dayShapeFromSchoolRecords: boolean;
  },
  existing: TimetableLesson[],
  options: GenerationOptions = {}
): GenerationResult {
  const cap = options.maxPeriodsPerTeacher ?? null;

  const periods: Slot[] = teachablePeriods(input.periods).map((period) => ({
    day: "",
    index: period.index,
    label: period.label,
  }));
  const week: Slot[] = input.days.flatMap((day) => periods.map((slot) => ({ ...slot, day })));
  const weeklySlots = week.length;

  const lessons: DraftLesson[] = [];
  const unplaced: UnplacedDemand[] = [];

  const occupied = new Set<string>();
  const placedCount = new Map<string, number>();
  const dayCount = new Map<string, number>();
  const subjectDayCount = new Map<string, number>();

  const counted = (lesson: TimetableLesson) => {
    const key = teacherKey(lesson.teacher_name, lesson.teacher_ref);
    placedCount.set(key, (placedCount.get(key) ?? 0) + 1);
  };

  for (const lesson of existing) {
    if (lesson.session !== input.session || lesson.term !== input.term) continue;
    occupied.add(slotKey(lesson.class_name, lesson.day, lesson.period_index));
    if (!isUnassigned(lesson.teacher_name, lesson.teacher_ref)) counted(lesson);
    lessons.push({
      ...lesson,
      period_label: lesson.period_label || periodLabel(input.periods, lesson.period_index),
      onSchoolRecord: true,
    });
  }

  const isFreeForTeacher = (candidate: DraftLesson) => findTeacherClash(candidate, lessons) === null;

  for (const demand of input.demands) {
    const className = demand.class_name.trim();
    const subject = demand.subject.trim();
    let placed = 0;
    const wanted = Math.max(0, Math.floor(demand.periods_wanted));

    if (!className || !subject) {
      unplaced.push({
        class_name: className,
        subject,
        teacher_name: demand.teacher_name,
        wanted,
        placed: 0,
        reason: "A plan row needs both a class arm and a subject.",
      });
      continue;
    }
    if (wanted === 0) {
      continue;
    }

    const loadKey = teacherKey(demand.teacher_name, demand.teacher_ref);
    const named = !isUnassigned(demand.teacher_name, demand.teacher_ref ?? null);

    while (placed < wanted) {
      // Checked once per period, not once per slot: the count only changes when a
      // lesson is placed, and a slot-by-slot test reads as if the day shape were
      // the thing refusing it.
      const overCap = named && cap !== null && (placedCount.get(loadKey) ?? 0) >= cap;
      const candidates: { slot: Slot; cost: number }[] = [];
      if (!overCap) {
        for (let order = 0; order < week.length; order += 1) {
          const slot = week[order];
          if (occupied.has(slotKey(className, slot.day, slot.index))) continue;

          const trial: DraftLesson = {
            session: input.session,
            term: input.term,
            class_name: className,
            day: slot.day,
            period_index: slot.index,
            period_label: slot.label,
            subject,
            teacher_name: demand.teacher_name,
            teacher_ref: demand.teacher_ref ?? null,
            onSchoolRecord: false,
          };
          if (named && !isFreeForTeacher(trial)) continue;

          candidates.push({
            slot,
            cost: slotCost(slot, demand, dayCount, subjectDayCount, order),
          });
        }
      }

      if (candidates.length === 0) {
        // Say which of the three reasons stopped it, because they need different
        // fixes: one needs the week rearranged, one needs the limit raised, one
        // needs a second teacher.
        const anySlotForClass = week.some((slot) => !occupied.has(slotKey(className, slot.day, slot.index)));
        unplaced.push({
          class_name: className,
          subject,
          teacher_name: demand.teacher_name,
          wanted,
          placed,
          reason: overCap
            ? `${demand.teacher_name} is already holding the ${cap} periods the plan allows one teacher.`
            : !anySlotForClass
              ? `${className} has no empty slot left in the ${weeklySlots} the week holds.`
              : named
                ? `No time in the week has ${demand.teacher_name} free while ${className} is empty — every slot left is one they already teach in another class.`
                : `${className} has no empty slot left for ${subject}.`,
        });
        break;
      }

      candidates.sort((a, b) => a.cost - b.cost);
      const chosen = candidates[0].slot;
      const lesson: DraftLesson = {
        session: input.session,
        term: input.term,
        class_name: className,
        day: chosen.day,
        period_index: chosen.index,
        period_label: chosen.label,
        subject,
        teacher_name: demand.teacher_name,
        teacher_ref: demand.teacher_ref ?? null,
        onSchoolRecord: false,
      };

      lessons.push(lesson);
      occupied.add(slotKey(className, chosen.day, chosen.index));
      if (named) counted(lesson);
      dayCount.set(`${className}|${chosen.day}`, (dayCount.get(`${className}|${chosen.day}`) ?? 0) + 1);
      subjectDayCount.set(
        `${className}|${subject}|${chosen.day}`,
        (subjectDayCount.get(`${className}|${subject}|${chosen.day}`) ?? 0) + 1
      );
      placed += 1;
    }
  }

  const emptySlots: EmptySlot[] = [];
  const filledByClass = new Map<string, Set<string>>();
  for (const lesson of lessons) {
    const set = filledByClass.get(lesson.class_name) ?? new Set<string>();
    set.add(slotKey(lesson.class_name, lesson.day, lesson.period_index));
    filledByClass.set(lesson.class_name, set);
  }
  for (const className of filledByClass.keys()) {
    for (const slot of week) {
      if (!(filledByClass.get(className) ?? new Set<string>()).has(slotKey(className, slot.day, slot.index))) {
        emptySlots.push({ class_name: className, day: slot.day, period_index: slot.index, period_label: slot.label });
      }
    }
  }

  return { lessons, unplaced, emptySlots, weeklySlots, dayShapeFromSchoolRecords: input.dayShapeFromSchoolRecords };
}
