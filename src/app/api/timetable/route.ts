import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import { closedTermRefusal, KNOWN_TERMS, validateScope } from "@/lib/supabase/term-scope";
import { findTeacherClash, slotLabel, type TimetableLesson } from "@/lib/timetable/clashes";

export const dynamic = "force-dynamic";

// The timetable is built by the people who run the teaching day. A bursar has no
// reason to move a lesson, and a family has no reason to see how the school
// staffs it, so neither reaches this route — read or write. TESTERS read every
// screen and write none.
const READ_TIMETABLE = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "TESTERS"] as const;
const WRITE_TIMETABLE = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const SQL_FILE = "supabase/timetable.sql";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const MAX_PERIODS = 12;
const MAX_BATCH = 400;

interface TimetableRow {
  id: string;
  session: string;
  term: string;
  class_name: string;
  day: string;
  period_index: number;
  period_label: string;
  subject: string;
  teacher_name: string;
  teacher_ref: string | null;
  room: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

const COLUMNS =
  "id, session, term, class_name, day, period_index, period_label, subject, teacher_name, teacher_ref, room, created_at, updated_at, created_by";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

interface ShapedLesson extends TimetableLesson {
  period_label: string;
  room: string;
}

/**
 * One lesson, validated. The day and the term are checked against what this portal
 * actually prints a grid for: a lesson filed on a Saturday, or under a term name
 * three letters long, is a record every screen would skip over.
 */
function shape(raw: Record<string, unknown>, session: string, term: string): { error: string } | { lesson: ShapedLesson } {
  const className = text(raw.className ?? raw.class_name, 100);
  if (!className) return { error: "Say which class arm this lesson belongs to." } as const;

  const day = text(raw.day, 20);
  if (!DAYS.includes(day as (typeof DAYS)[number])) {
    return { error: `${day || "That day"} is not one of the five school days this portal prints a grid for (${DAYS.join(", ")}). A lesson filed on a day no screen shows would be a record nobody could read.` } as const;
  }

  const periodIndex = Number(raw.periodIndex ?? raw.period_index);
  if (!Number.isInteger(periodIndex) || periodIndex < 0 || periodIndex >= MAX_PERIODS) {
    return { error: `The period must be a whole number from 0 to ${MAX_PERIODS - 1}.` } as const;
  }

  const subject = text(raw.subject, 120);
  if (subject.length < 2) return { error: "Give the lesson a subject of at least two letters." } as const;

  return {
    lesson: {
      session,
      term,
      class_name: className,
      day,
      period_index: periodIndex,
      period_label: text(raw.periodLabel ?? raw.period_label, 80),
      subject,
      teacher_name: text(raw.teacherName ?? raw.teacher_name, 120),
      teacher_ref: text(raw.teacherId ?? raw.teacher_ref, 40) || null,
      room: text(raw.room, 80),
    } satisfies ShapedLesson,
  } as const;
}

/**
 * The lessons already on file for one session and term, for the clash test to read.
 *
 * A read that failed is returned, not thrown: the caller turns it into the same
 * `503` that names the migration, and a thrown error would surface as a bare 500
 * that tells the school nothing about what to run.
 */
async function filedLessons(
  supabase: SupabaseClient,
  session: string,
  term: string
): Promise<{ rows: TimetableLesson[]; error: null } | { rows: []; error: { code?: string; message?: string } }> {
  const { data, error } = await supabase
    .from("timetable_entries")
    .select("session, term, class_name, day, period_index, period_label, subject, teacher_name, teacher_ref")
    .eq("session", session)
    .eq("term", term);

  if (error) return { rows: [], error };
  return { rows: (data as TimetableLesson[]) ?? [], error: null };
}

/**
 * The timetable as the school's records hold it, for one session and term.
 *
 * The session and term are asked for, never assumed: a grid with no date on it is
 * how last term's schedule printed as this term's, and a teacher who moved rooms
 * between terms would be shown in the wrong place with nothing to say so.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_TIMETABLE);
  if (access.denied) return access.denied;

  const params = new URL(request.url).searchParams;
  const session = (params.get("session") || "").trim();
  const term = (params.get("term") || "").trim();

  if (!session || !term) {
    return NextResponse.json(
      { success: false, error: "Say which session and term to read — a timetable belongs to both." },
      { status: 400 }
    );
  }
  if (!KNOWN_TERMS.includes(term)) {
    return NextResponse.json({ success: false, error: `The term must be one of: ${KNOWN_TERMS.join(", ")}.` }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const className = (params.get("class_name") || "").trim();
  // The `or` filter is one comma-separated PostgREST expression, so a name typed
  // with a comma in it would be read as two conditions. The characters that would
  // do that are taken out; nothing in a real name needs them.
  const teacher = (params.get("teacher") || "").replace(/[,()]/g, "").trim();

  let query = supabase.from("timetable_entries").select(COLUMNS).eq("session", session).eq("term", term);
  if (className) query = query.eq("class_name", className);
  if (teacher) query = query.or(`teacher_name.ilike.%${teacher}%,teacher_ref.eq.${teacher}`);

  const { data, error } = await query.order("day", { ascending: true }).order("period_index", { ascending: true });
  if (error) {
    return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  // Re-mapped field by field, so a column added to the table later cannot arrive
  // on a screen that has no idea what it means.
  const rows = ((data as unknown as TimetableRow[]) ?? []).map((row) => ({
    id: row.id,
    session: row.session,
    term: row.term,
    className: row.class_name,
    day: row.day,
    periodIndex: row.period_index,
    periodLabel: row.period_label,
    subject: row.subject,
    teacherName: row.teacher_name,
    teacherId: row.teacher_ref ?? "",
    room: row.room,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }));

  return NextResponse.json({ success: true, data: rows });
}

/**
 * Files one lesson into one slot, and refuses it if that teacher is already
 * standing in another class at that time.
 *
 * Re-saving a slot updates the lesson that was there — the UNIQUE on
 * (session, term, class, day, period) is what makes that the database's rule and
 * not this route's opinion, so two people saving the same slot cannot stack two
 * lessons that the grid then draws one at a time.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_TIMETABLE);
  if (access.denied) return access.denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const session = text(body.session, 20);
  const term = text(body.term, 20);
  const scopeRefusal = validateScope(session, term);
  if (scopeRefusal) return scopeRefusal;

  const shaped = shape(body, session, term);
  if ("error" in shaped) return NextResponse.json({ success: false, error: shaped.error }, { status: 400 });
  const lesson = shaped.lesson;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const termRefusal = await closedTermRefusal(supabase, session, term);
  if (termRefusal) return termRefusal;

  const filed = await filedLessons(supabase, session, term);
  if (filed.error !== null) {
    return databaseSetupRequired(filed.error, SQL_FILE) ?? NextResponse.json({ success: false, error: filed.error.message ?? "The timetable could not be read." }, { status: 502 });
  }

  // The slot being overwritten must not count against its own teacher: correcting
  // "Maths with Mrs Okon" to "Further Maths with Mrs Okon" is the same person in
  // the same room, not a double-booking.
  const occupying = filed.rows.find(
    (row) => row.class_name === lesson.class_name && row.day === lesson.day && row.period_index === lesson.period_index
  );
  const others = filed.rows.filter((row) => row !== occupying);

  const clash = findTeacherClash(lesson, others);
  if (clash) {
    return NextResponse.json(
      {
        success: false,
        error: `${lesson.teacher_name} is already scheduled in ${slotLabel(clash)} at the same time. Move one of the two first — a teacher cannot be in two class arms at once, and a timetable that says otherwise is the one document everyone in the school acts on.`,
      },
      { status: 409 }
    );
  }

  const { data: saved, error: saveError } = await supabase
    .from("timetable_entries")
    .upsert(
      {
        session: lesson.session,
        term: lesson.term,
        class_name: lesson.class_name,
        day: lesson.day,
        period_index: lesson.period_index,
        period_label: lesson.period_label,
        subject: lesson.subject,
        teacher_name: lesson.teacher_name,
        teacher_ref: lesson.teacher_ref,
        room: lesson.room,
        // Whose login filed the lesson, taken from the signed session and never
        // from the body: when a card surprises someone, the record says who moved it.
        created_by: access.session.username,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session,term,class_name,day,period_index", ignoreDuplicates: false }
    )
    .select(COLUMNS);

  if (saveError) {
    return databaseSetupRequired(saveError, SQL_FILE) ?? NextResponse.json({ success: false, error: saveError.message }, { status: 502 });
  }

  const row = (Array.isArray(saved) ? saved[0] : null) as TimetableRow | null;
  return NextResponse.json({
    success: true,
    data: {
      id: row?.id ?? null,
      className: lesson.class_name,
      day: lesson.day,
      periodIndex: lesson.period_index,
      subject: lesson.subject,
      teacherName: lesson.teacher_name,
      replaced: Boolean(occupying),
      filedBy: access.session.username,
    },
  });
}

/**
 * Files a whole grid in one call — the carry-over of a timetable an older version
 * of this screen kept in one browser, and later the draft the generator builds.
 *
 * It does not refuse the batch because one row clashed. It files what it can and
 * says exactly which rows it did not, with the reason for each, because "nothing
 * happened" would throw away thirty good lessons over one double-booked teacher,
 * and "everything happened" would be a lie.
 */
export async function PUT(request: Request) {
  const access = await requireRoleSession(WRITE_TIMETABLE);
  if (access.denied) return access.denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const session = text(body.session, 20);
  const term = text(body.term, 20);
  const scopeRefusal = validateScope(session, term);
  if (scopeRefusal) return scopeRefusal;

  const rawEntries = Array.isArray(body.entries) ? body.entries : null;
  if (!rawEntries || rawEntries.length === 0) {
    return NextResponse.json({ success: false, error: "No lessons were sent, so nothing was filed." }, { status: 400 });
  }
  if (rawEntries.length > MAX_BATCH) {
    return NextResponse.json({ success: false, error: `No more than ${MAX_BATCH} lessons at a time.` }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const termRefusal = await closedTermRefusal(supabase, session, term);
  if (termRefusal) return termRefusal;

  const opening = await filedLessons(supabase, session, term);
  if (opening.error !== null) {
    return databaseSetupRequired(opening.error, SQL_FILE) ?? NextResponse.json({ success: false, error: opening.error.message ?? "The timetable could not be read." }, { status: 502 });
  }

  const refused: { className: string; day: string; periodIndex: number; subject: string; reason: string }[] = [];
  // A batch is judged against what is already filed AND against the rows earlier
  // in this same batch, so a draft that books one teacher into two new classes
  // cannot pass simply because neither is on file yet.
  const accepted: ShapedLesson[] = [];
  let onFile: TimetableLesson[] = opening.rows;

  for (const raw of rawEntries as Record<string, unknown>[]) {
    const shaped = shape(raw, session, term);
    if ("error" in shaped) {
      refused.push({
        className: text(raw.className ?? raw.class_name, 100),
        day: text(raw.day, 20),
        periodIndex: Number(raw.periodIndex ?? raw.period_index) || 0,
        subject: text(raw.subject, 120),
        reason: shaped.error,
      });
      continue;
    }

    const lesson = shaped.lesson;
    const occupying = onFile.find(
      (row) => row.class_name === lesson.class_name && row.day === lesson.day && row.period_index === lesson.period_index
    );
    const against = [...onFile.filter((row) => row !== occupying), ...accepted];
    const clash = findTeacherClash(lesson, against);
    if (clash) {
      refused.push({
        className: lesson.class_name,
        day: lesson.day,
        periodIndex: lesson.period_index,
        subject: lesson.subject,
        reason: `${lesson.teacher_name} is already in ${slotLabel(clash)} at the same time.`,
      });
      continue;
    }

    accepted.push(lesson);
    // Counted at once, so a second lesson for the same class slot in this batch is
    // seen as the overwrite of the first rather than filed as a separate row.
    onFile = [
      ...onFile.filter((row) => !(row.class_name === lesson.class_name && row.day === lesson.day && row.period_index === lesson.period_index)),
      lesson,
    ];
  }

  if (accepted.length === 0) {
    return NextResponse.json({
      success: false,
      error: `None of the ${refused.length} lesson(s) could be filed. The first reason: ${refused[0]?.reason ?? "no lesson was given"}`,
      data: { filed: 0, refused },
    }, { status: 409 });
  }

  const { error: saveError } = await supabase.from("timetable_entries").upsert(
    accepted.map((lesson) => ({
      session,
      term,
      class_name: lesson.class_name,
      day: lesson.day,
      period_index: lesson.period_index,
      period_label: lesson.period_label,
      subject: lesson.subject,
      teacher_name: lesson.teacher_name,
      teacher_ref: lesson.teacher_ref,
      room: lesson.room,
      created_by: access.session.username,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "session,term,class_name,day,period_index", ignoreDuplicates: false }
  );

  if (saveError) {
    return databaseSetupRequired(saveError, SQL_FILE) ?? NextResponse.json({ success: false, error: saveError.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: { filed: accepted.length, refused, filedBy: access.session.username, session, term },
  });
}

/**
 * Takes one lesson out of the grid, or a whole class arm out of it.
 *
 * `id` removes a single lesson. `class_name` (with the session and term) empties
 * one arm — the button that used to be called "Clear Class Schedule" and only
 * cleared this browser's copy, while the school's own grid still printed the
 * periods.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_TIMETABLE);
  if (access.denied) return access.denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = text(body.id, 60);
  const session = text(body.session, 20);
  const term = text(body.term, 20);
  const className = text(body.className ?? body.class_name, 100);

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  if (id) {
    const { data: removed, error: removeError } = await supabase
      .from("timetable_entries")
      .delete()
      .eq("id", id)
      .select("id, class_name, day, period_index, subject");

    if (removeError) {
      return databaseSetupRequired(removeError, SQL_FILE) ?? NextResponse.json({ success: false, error: removeError.message }, { status: 502 });
    }
    if (!removed || removed.length === 0) {
      return NextResponse.json({ success: false, error: "That lesson was not on the grid, so nothing was removed." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { removed: removed.length, removedBy: access.session.username } });
  }

  if (!className) {
    return NextResponse.json(
      { success: false, error: "Say which class arm to clear, or name the one lesson to take out." },
      { status: 400 }
    );
  }
  const scopeRefusal = validateScope(session, term);
  if (scopeRefusal) return scopeRefusal;

  const termRefusal = await closedTermRefusal(supabase, session, term);
  if (termRefusal) return termRefusal;

  const { data: removed, error: removeError } = await supabase
    .from("timetable_entries")
    .delete()
    .eq("session", session)
    .eq("term", term)
    .eq("class_name", className)
    .select("id");

  if (removeError) {
    return databaseSetupRequired(removeError, SQL_FILE) ?? NextResponse.json({ success: false, error: removeError.message }, { status: 502 });
  }

  const count = removed?.length ?? 0;
  if (count === 0) {
    return NextResponse.json(
      { success: false, error: `${className} has no lessons filed for ${term}, ${session}, so there was nothing to clear.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { removed: count, className, session, term, removedBy: access.session.username },
  });
}
