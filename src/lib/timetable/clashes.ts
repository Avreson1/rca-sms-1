/**
 * The one rule a timetable has that makes it worth printing: a teacher is in one
 * class at one time.
 *
 * This lives apart from the routes so the hand-built grid, the batch that carries
 * an old browser copy over, and the generated draft are all judged by the same
 * test. Two different clash rules is how a timetable ends up with Mrs Okon in two
 * rooms at 10:00 and nobody noticing until a class arrives empty.
 */

export interface TimetableLesson {
  session: string;
  term: string;
  class_name: string;
  day: string;
  period_index: number;
  /** The slot's printed time, when the caller has it. Only ever used to word a refusal. */
  period_label?: string;
  subject: string;
  teacher_name: string;
  teacher_ref?: string | null;
}

/**
 * A slot nobody is assigned to.
 *
 * "Unassigned" is typed on this screen when a lesson exists but the school has not
 * said who teaches it yet. Two classes may both hold an unassigned slot at the same
 * time — that is a gap to fill, not a person double-booked — so it must not raise a
 * clash, or the generator would refuse to place anything until every gap was filled.
 */
export function isUnassigned(teacherName: string, teacherRef?: string | null): boolean {
  const name = teacherName.trim().toLowerCase();
  return !teacherRef && (name === "" || name === "unassigned" || name === "n/a" || name === "tba");
}

/**
 * The same person, in the way this portal already counts them: by their staff id
 * when the row carries one, and otherwise by the typed name, ignoring case and
 * spacing. A timetable was kept for a term with names only, so a rule that
 * required an id would call "Mrs. Okon" and "Mrs Okon" two different people and
 * let the same teacher be booked twice.
 */
export function sameTeacher(
  a: { teacher_name: string; teacher_ref?: string | null },
  b: { teacher_name: string; teacher_ref?: string | null }
): boolean {
  if (a.teacher_ref && b.teacher_ref) return a.teacher_ref === b.teacher_ref;
  if (a.teacher_ref || b.teacher_ref) return false;
  return a.teacher_name.trim().toLowerCase().replace(/\s+/g, " ") === b.teacher_name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The first lesson already on file that puts this candidate's teacher elsewhere in the same slot. */
export function findTeacherClash(candidate: TimetableLesson, alreadyFiled: TimetableLesson[]): TimetableLesson | null {
  if (isUnassigned(candidate.teacher_name, candidate.teacher_ref)) return null;

  for (const lesson of alreadyFiled) {
    if (lesson.session !== candidate.session || lesson.term !== candidate.term) continue;
    if (lesson.day !== candidate.day || lesson.period_index !== candidate.period_index) continue;
    if (lesson.class_name === candidate.class_name) continue;
    if (sameTeacher(candidate, lesson)) return lesson;
  }
  return null;
}

/** Every pair of lessons that puts one teacher in two classes at one time. */
export function findAllClashes(lessons: TimetableLesson[]): TimetableLesson[][] {
  const clashes: TimetableLesson[][] = [];
  const seen = new Set<string>();

  for (const a of lessons) {
    for (const b of lessons) {
      if (a === b || a.class_name === b.class_name) continue;
      if (a.day !== b.day || a.period_index !== b.period_index) continue;
      if (a.session !== b.session || a.term !== b.term) continue;
      if (isUnassigned(a.teacher_name, a.teacher_ref) || isUnassigned(b.teacher_name, b.teacher_ref)) continue;
      if (!sameTeacher(a, b)) continue;

      const key = [a.session, a.term, a.day, a.period_index, a.teacher_ref || a.teacher_name.toLowerCase(), [a.class_name, b.class_name].sort().join("~")].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      clashes.push([a, b]);
    }
  }
  return clashes;
}

/** A slot named the way a person reads it, for the sentence that refuses a clash. */
export function slotLabel(lesson: TimetableLesson): string {
  return `${lesson.class_name} · ${lesson.day} · ${lesson.period_label || `Period ${lesson.period_index + 1}`}`;
}
