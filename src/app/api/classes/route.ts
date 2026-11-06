import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/classes_and_subjects.sql";

// The arm list is read by half the portal — the CA grid filters by it, the
// timetable groups by it, the fee schedule prices per arm — so it is not a
// secret and everyone signed in may read it. Writing it is an admissions act,
// the same pair that enrols a pupil.
const READ_ARMS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
const WRITE_ARMS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECTIONS = [
  "Creche & Playgroup",
  "Nursery School",
  "Basic Primary",
  "Junior Secondary",
  "Senior Secondary",
] as const;

type ArmPayload = {
  id?: string;
  name?: string;
  section?: string;
  form_teacher?: string;
  form_teacher_id?: string;
  capacity?: number;
};

type ArmRow = {
  id: string;
  name: string;
  section: string;
  form_teacher: string;
  form_teacher_id: string;
  capacity: number;
};

/**
 * The arms the school runs, with the number of pupils actually filed in each.
 *
 * The count is counted here rather than read from a stored figure, because the
 * stored one is whatever somebody typed when the arm was created. The screen
 * above this route prints the number as a fact about the class, so it has to be
 * true of the roll as it stands.
 */
export async function GET() {
  const denied = await requireRole(READ_ARMS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("class_arms").select("*").order("name");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const arms = (data ?? []) as ArmRow[];
  if (arms.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const { data: pupils, error: pupilError } = await supabase
    .from("students")
    .select("class_name")
    .in("class_name", arms.map((arm) => arm.name));
  if (pupilError) {
    // The roll is a different table from the arm list, and it can fail on its
    // own. Answering with zeroes would tell the office that nobody is enrolled
    // in any class, which is the opposite of what is known.
    return NextResponse.json({ success: false, error: pupilError.message }, { status: 502 });
  }

  const counts = new Map<string, number>();
  for (const pupil of (pupils ?? []) as { class_name: string }[]) {
    counts.set(pupil.class_name, (counts.get(pupil.class_name) ?? 0) + 1);
  }

  return NextResponse.json({
    success: true,
    data: arms.map((arm) => ({ ...arm, students_count: counts.get(arm.name) ?? 0 })),
  });
}

/**
 * Files one arm, or the whole list a screen is holding.
 *
 * Sending an arm whose name is already on file updates that row instead of
 * creating a second JSS 1A, which is what lets the Classes screen keep a single
 * Save button. A row sent with a real database id is updated by id, so renaming
 * an arm corrects the row it came from rather than leaving the old spelling
 * behind as a second class.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_ARMS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No class arm was sent." }, { status: 400 });
  }
  if (list.length > 200) {
    return NextResponse.json({ success: false, error: "Too many class arms in one submission (max 200)." }, { status: 400 });
  }

  const rows: ArmRow[] = [];
  const ids: string[] = [];
  for (const item of list as ArmPayload[]) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "A class arm needs a name a parent would recognise on a report card (at least two characters)." },
        { status: 400 }
      );
    }
    if (name.length > 60) {
      return NextResponse.json({ success: false, error: `“${name.slice(0, 30)}…” is longer than the 60 characters an arm name holds.` }, { status: 400 });
    }

    const section = typeof item?.section === "string" ? item.section : "";
    if (!(SECTIONS as readonly string[]).includes(section)) {
      return NextResponse.json(
        { success: false, error: `“${name}” has a section the school does not run: ${section || "(none)"}. Use one of: ${SECTIONS.join(", ")}.` },
        { status: 400 }
      );
    }

    const capacity =
      typeof item?.capacity === "number" && Number.isFinite(item.capacity) ? Math.round(item.capacity) : 0;
    if (capacity < 0 || capacity > 500) {
      return NextResponse.json({ success: false, error: `“${name}” has a capacity of ${item?.capacity}. A class holds between 0 and 500.` }, { status: 400 });
    }

    const id = typeof item?.id === "string" && UUID_PATTERN.test(item.id.trim()) ? item.id.trim() : "";
    rows.push({
      // A browser id (`c-1730…`) is not a row id, so it is dropped and the name
      // decides which row this arm belongs to.
      id,
      name,
      section,
      form_teacher: typeof item?.form_teacher === "string" ? item.form_teacher.trim().slice(0, 255) : "",
      form_teacher_id: typeof item?.form_teacher_id === "string" ? item.form_teacher_id.trim().slice(0, 50) : "",
      capacity,
    });
    ids.push(id);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: ArmRow[] = [];
  for (const row of rows) {
    const { id, ...columns } = row;
    const stamped = { ...columns, updated_at: new Date().toISOString() };
    const query = id
      ? supabase.from("class_arms").update(stamped).eq("id", id)
      : supabase.from("class_arms").upsert(stamped, { onConflict: "name" });

    const { data, error } = await query.select("*");
    if (error) {
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as ArmRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Removes arms from the list — and refuses to remove one that still has pupils.
 *
 * A child is filed in a class by its written name. Deleting the arm that names
 * it leaves the child in a class the school no longer runs, and every screen
 * that groups by arm drops them. Moving the children is the office's decision,
 * so this asks for it instead of making it.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_ARMS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { ids?: unknown };
  const ids = Array.isArray(sent.ids) ? sent.ids.filter((id): id is string => typeof id === "string") : [];
  const realIds = ids.filter((id) => UUID_PATTERN.test(id.trim()));
  if (realIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "No class arm on this device has a record on the school's list, so nothing was removed. Reload the page." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: arms, error: readError } = await supabase
    .from("class_arms")
    .select("id, name")
    .in("id", realIds);
  if (readError) {
    const setup = databaseSetupRequired(readError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }

  const names = (arms ?? []).map((arm) => arm.name as string);
  if (names.length > 0) {
    const { data: pupils, error: pupilError } = await supabase
      .from("students")
      .select("id, class_name")
      .in("class_name", names);
    if (pupilError) {
      return NextResponse.json({ success: false, error: pupilError.message }, { status: 502 });
    }
    const holding = new Map<string, number>();
    for (const pupil of (pupils ?? []) as { class_name: string }[]) {
      holding.set(pupil.class_name, (holding.get(pupil.class_name) ?? 0) + 1);
    }
    if (holding.size > 0) {
      const listed = [...holding.entries()].map(([name, count]) => `${name} (${count} pupil${count === 1 ? "" : "s"})`);
      return NextResponse.json(
        {
          success: false,
          error: `These arms still have pupils filed in them: ${listed.join(", ")}. Move or withdraw the children first, then the arm can go.`,
          data: { blocked: [...holding.keys()] },
        },
        { status: 409 }
      );
    }
  }

  const { data: removed, error } = await supabase.from("class_arms").delete().in("id", realIds).select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { removed: removed?.length ?? 0 } });
}
