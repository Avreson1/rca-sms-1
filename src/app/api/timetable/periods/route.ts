import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import { closedTermRefusal, KNOWN_TERMS, validateScope } from "@/lib/supabase/term-scope";
import { DEFAULT_TIMETABLE_DAYS, type TimetablePeriod } from "@/lib/timetable/day-shape";

export const dynamic = "force-dynamic";

// The day shape decides how many lessons a class can hold, so it belongs to the
// people who build the timetable. It is readable by the roles that read the grid —
// a teacher needs to know what Period 4 is before they take a class to it.
const READ_TIMETABLE = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "TESTERS"] as const;
const WRITE_TIMETABLE = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const SQL_FILE = "supabase/timetable.sql";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const MAX_PERIODS = 24;
/** The most the `timetable_entries` CHECK will accept as a real slot. */
const MAX_SLOT_INDEX = 11;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * One term's day, validated.
 *
 * Breaks are allowed in the shape (they are what the printed day is made of) but
 * they are never slots. A slot index above `MAX_SLOT_INDEX` is refused here rather
 * than left to fail at the database CHECK when someone tries to file a lesson into
 * it, because the error would then arrive on a different screen than the one that
 * set the shape.
 */
function sanitizeShape(raw: Record<string, unknown>, session: string, term: string) {
  if (!Array.isArray(raw.periods) || raw.periods.length === 0) {
    return { error: "The day needs at least one period. An empty list would leave every class with nowhere to be scheduled." } as const;
  }
  if (raw.periods.length > MAX_PERIODS) {
    return { error: `No more than ${MAX_PERIODS} entries in one school day.` } as const;
  }

  const periods: TimetablePeriod[] = [];
  const seenIndex = new Set<number>();
  for (const entry of raw.periods as Record<string, unknown>[]) {
    const index = Number(entry?.index);
    if (!Number.isInteger(index)) return { error: "Every period needs a whole-number position in the day." } as const;
    if (seenIndex.has(index)) return { error: `Two entries claim position ${index} in the same day.` } as const;
    seenIndex.add(index);

    const label = text(entry?.label, 80);
    if (label.length < 2) return { error: `The period at position ${index} needs a name, such as "Period 1 (08:00 - 08:45 AM)".` } as const;

    const isBreak = entry?.is_break === true || entry?.isBreak === true;
    if (!isBreak && (index < 0 || index > MAX_SLOT_INDEX)) {
      return { error: `A teaching period must sit between position 0 and ${MAX_SLOT_INDEX}; a lesson cannot be filed anywhere else. Mark it as a break if it is one.` } as const;
    }
    periods.push(isBreak ? { index, label, is_break: true } : { index, label });
  }

  if (periods.every((period) => period.is_break)) {
    return { error: "The day has no teaching period in it, only breaks." } as const;
  }

  if (!Array.isArray(raw.days) || raw.days.length === 0) {
    return { error: "Say which days the school teaches on." } as const;
  }
  const days: string[] = [];
  for (const entry of raw.days as unknown[]) {
    const day = text(entry, 20);
    if (!DAYS.includes(day as (typeof DAYS)[number])) {
      return { error: `${day || "That day"} is not one of the five days this portal prints a grid for (${DAYS.join(", ")}).` } as const;
    }
    if (days.includes(day)) return { error: `${day} is listed twice in the school week.` } as const;
    days.push(day);
  }

  return { shape: { session, term, periods, days } } as const;
}

/**
 * The shape the school filed for one session and term.
 *
 * `configured: false` is a different fact from an empty list: it means the school
 * has never set a day, and the screen then has to say it is showing the periods the
 * portal ships with rather than implying the office chose them.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_TIMETABLE);
  if (access.denied) return access.denied;

  const params = new URL(request.url).searchParams;
  const session = (params.get("session") || "").trim();
  const term = (params.get("term") || "").trim();

  if (!session || !term) {
    return NextResponse.json(
      { success: false, error: "Say which session and term's day to read — the shape belongs to both." },
      { status: 400 }
    );
  }
  if (!KNOWN_TERMS.includes(term)) {
    return NextResponse.json({ success: false, error: `The term must be one of: ${KNOWN_TERMS.join(", ")}.` }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("timetable_periods")
    .select("session, term, periods, days, updated_at, updated_by")
    .eq("session", session)
    .eq("term", term)
    .maybeSingle<{ session: string; term: string; periods: unknown; days: unknown; updated_at: string; updated_by: string }>();

  if (error) {
    return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  if (!data) {
    return NextResponse.json({
      success: true,
      data: {
        session,
        term,
        configured: false,
        periods: [],
        days: [...DEFAULT_TIMETABLE_DAYS],
        updatedAt: null,
        updatedBy: "",
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      session: data.session,
      term: data.term,
      configured: true,
      periods: Array.isArray(data.periods) ? (data.periods as TimetablePeriod[]) : [],
      days: Array.isArray(data.days) ? (data.days as string[]) : [...DEFAULT_TIMETABLE_DAYS],
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    },
  });
}

/**
 * Files the school's day for one session and term.
 *
 * A shape that would strand lessons already on file is refused: five periods cannot
 * replace six while a class still holds a lesson in Period 6, because the grid would
 * stop printing that period and the lesson would go on existing where nobody can see
 * it. The refusal says which lessons and where they sit.
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

  const sanitized = sanitizeShape(body, session, term);
  if ("error" in sanitized) return NextResponse.json({ success: false, error: sanitized.error }, { status: 400 });
  const { periods, days } = sanitized.shape;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const termRefusal = await closedTermRefusal(supabase, session, term);
  if (termRefusal) return termRefusal;

  const slotIndexes = periods.filter((period) => !period.is_break).map((period) => period.index);

  const { data: stranded, error: strandedError } = await supabase
    .from("timetable_entries")
    .select("class_name, day, period_index, period_label, subject")
    .eq("session", session)
    .eq("term", term)
    .not("period_index", "in", `(${slotIndexes.join(",")})`)
    .limit(20);

  if (strandedError) {
    return databaseSetupRequired(strandedError, SQL_FILE) ?? NextResponse.json({ success: false, error: strandedError.message }, { status: 502 });
  }

  const { data: offWeek, error: offWeekError } = await supabase
    .from("timetable_entries")
    .select("class_name, day, period_index, period_label, subject")
    .eq("session", session)
    .eq("term", term)
    .not("day", "in", `(${days.map((day) => `"${day}"`).join(",")})`)
    .limit(20);

  if (offWeekError) return NextResponse.json({ success: false, error: offWeekError.message }, { status: 502 });

  const unprintable = [...((stranded as { class_name: string; day: string; period_index: number; subject: string }[]) ?? []),
    ...((offWeek as { class_name: string; day: string; period_index: number; subject: string }[]) ?? [])];
  if (unprintable.length > 0) {
    const examples = unprintable
      .slice(0, 3)
      .map((row) => `${row.class_name} · ${row.day} · Period ${row.period_index + 1} (${row.subject})`)
      .join("; ");
    return NextResponse.json(
      {
        success: false,
        error: `${unprintable.length} lesson(s) already filed for ${term}, ${session} do not fit the day being saved — for example ${examples}. They would keep existing while the grid stopped printing them. Move them into a period the new day has, or clear that class's timetable first.`,
      },
      { status: 409 }
    );
  }

  const { error: saveError } = await supabase.from("timetable_periods").upsert(
    {
      session,
      term,
      periods,
      days,
      updated_by: access.session.username,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session,term", ignoreDuplicates: false }
  );

  if (saveError) {
    return databaseSetupRequired(saveError, SQL_FILE) ?? NextResponse.json({ success: false, error: saveError.message }, { status: 502 });
  }

  const teachingCount = periods.length - periods.filter((period) => period.is_break).length;
  return NextResponse.json({
    success: true,
    data: {
      session,
      term,
      teachingPeriods: teachingCount,
      days,
      weeklySlots: teachingCount * days.length,
      savedBy: access.session.username,
    },
  });
}
