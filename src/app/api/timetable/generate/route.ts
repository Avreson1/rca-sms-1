import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import { KNOWN_TERMS } from "@/lib/supabase/term-scope";
import { buildTimetableDraft, type GenerationDemand } from "@/lib/timetable/generator";
import {
  DEFAULT_TIMETABLE_DAYS,
  DEFAULT_TIMETABLE_PERIODS,
  type TimetablePeriod,
} from "@/lib/timetable/day-shape";
import type { TimetableLesson } from "@/lib/timetable/clashes";

export const dynamic = "force-dynamic";

// Building a draft writes nothing — it reads the school's day and its filed
// lessons and hands back a proposal a human then files. So every role that may
// read the timetable may draft one; a form master planning next week is the
// normal case. Only the filing step is limited to the office.
const READ_TIMETABLE = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "TESTERS"] as const;

const SQL_FILE = "supabase/timetable.sql";

const MAX_PLAN_ROWS = 200;
const MAX_PERIODS_PER_SUBJECT = 40;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * One line of the plan, or the sentence saying why it is not a plan yet.
 *
 * A teacher is not required, because half a timetable is written before the staff
 * are booked into it. An unassigned line stays a gap and is reported as one.
 */
function readDemand(raw: unknown): { demand: GenerationDemand } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "Every plan row must name a class, a subject and how many periods it wants." };
  const row = raw as Record<string, unknown>;

  const className = text(row.className ?? row.class_name, 100);
  if (!className) return { error: "A plan row is missing its class arm." };

  const subject = text(row.subject, 120);
  if (subject.length < 2) return { error: `${className}: a plan row needs a subject of at least two letters.` };

  const wanted = Number(row.periodsWanted ?? row.periods_wanted);
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > MAX_PERIODS_PER_SUBJECT) {
    return { error: `${className} · ${subject}: the periods wanted must be a whole number from 0 to ${MAX_PERIODS_PER_SUBJECT}.` };
  }

  return {
    demand: {
      class_name: className,
      subject,
      teacher_name: text(row.teacherName ?? row.teacher_name, 120),
      teacher_ref: text(row.teacherId ?? row.teacher_ref, 40) || null,
      periods_wanted: wanted,
    },
  };
}

/**
 * A draft timetable for one session and term, built from a plan the school wrote.
 *
 * Nothing is saved. The answer carries the rows the generator placed, the rows it
 * could not place with the reason for each, and the slots that stayed empty — so
 * the person reading it can see a gap as a gap rather than assume the week is
 * finished. Filing is a separate, deliberate call.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(READ_TIMETABLE);
  if (access.denied) return access.denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const session = text(body.session, 20);
  const term = text(body.term, 20);
  if (!session || !term) {
    return NextResponse.json(
      { success: false, error: "Say which session and term the draft is for — a timetable belongs to both." },
      { status: 400 }
    );
  }
  if (!KNOWN_TERMS.includes(term)) {
    return NextResponse.json({ success: false, error: `The term must be one of: ${KNOWN_TERMS.join(", ")}.` }, { status: 400 });
  }

  const rawPlan = Array.isArray(body.demands) ? body.demands : null;
  if (!rawPlan || rawPlan.length === 0) {
    return NextResponse.json(
      { success: false, error: "No plan was sent. Say which class needs which subject, and how many periods of it." },
      { status: 400 }
    );
  }
  if (rawPlan.length > MAX_PLAN_ROWS) {
    return NextResponse.json({ success: false, error: `No more than ${MAX_PLAN_ROWS} plan rows at a time.` }, { status: 400 });
  }

  const demands: GenerationDemand[] = [];
  for (const raw of rawPlan) {
    const read = readDemand(raw);
    if ("error" in read) return NextResponse.json({ success: false, error: read.error }, { status: 400 });
    demands.push(read.demand);
  }

  const capRaw = body.maxPeriodsPerTeacher;
  const cap = capRaw === undefined || capRaw === null || capRaw === "" ? null : Number(capRaw);
  if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 60)) {
    return NextResponse.json(
      { success: false, error: "The limit for one teacher must be a whole number of periods from 1 to 60, or left blank to mean no limit." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: shapeRow, error: shapeError } = await supabase
    .from("timetable_periods")
    .select("periods, days")
    .eq("session", session)
    .eq("term", term)
    .maybeSingle<{ periods: unknown; days: unknown }>();

  if (shapeError) {
    return databaseSetupRequired(shapeError, SQL_FILE) ?? NextResponse.json({ success: false, error: shapeError.message }, { status: 502 });
  }

  const periods = Array.isArray(shapeRow?.periods) ? (shapeRow!.periods as TimetablePeriod[]) : DEFAULT_TIMETABLE_PERIODS;
  const days = Array.isArray(shapeRow?.days) && (shapeRow!.days as string[]).length > 0
    ? (shapeRow!.days as string[])
    : [...DEFAULT_TIMETABLE_DAYS];

  const { data: filed, error: filedError } = await supabase
    .from("timetable_entries")
    .select("session, term, class_name, day, period_index, period_label, subject, teacher_name, teacher_ref")
    .eq("session", session)
    .eq("term", term);

  if (filedError) {
    return databaseSetupRequired(filedError, SQL_FILE) ?? NextResponse.json({ success: false, error: filedError.message }, { status: 502 });
  }

  const draft = buildTimetableDraft(
    {
      session,
      term,
      demands,
      periods,
      days,
      dayShapeFromSchoolRecords: Array.isArray(shapeRow?.periods),
    },
    (filed as unknown as TimetableLesson[]) ?? [],
    { maxPeriodsPerTeacher: cap }
  );

  const proposed = draft.lessons.filter((lesson) => !lesson.onSchoolRecord);

  return NextResponse.json({
    success: true,
    data: {
      session,
      term,
      weeklySlots: draft.weeklySlots,
      dayShapeFromSchoolRecords: draft.dayShapeFromSchoolRecords,
      lessons: draft.lessons,
      proposed: proposed.length,
      unplaced: draft.unplaced,
      emptySlots: draft.emptySlots,
      draftedBy: access.session.username,
    },
  });
}
