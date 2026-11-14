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
  is_active?: boolean;
  sort_order?: number;
};

type ArmRow = {
  id: string;
  name: string;
  section: string;
  form_teacher: string;
  form_teacher_id: string;
  capacity: number;
  is_active: boolean;
  sort_order: number;
};

/**
 * The arms the school runs, with the number of pupils actually filed in each.
 */
export async function GET() {
  const denied = await requireRole(READ_ARMS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("class_arms")
    .select("*")
    .order("name");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const rawArms = (data ?? []) as any[];
  if (rawArms.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const arms: ArmRow[] = rawArms.map((row) => ({
    id: row.id,
    name: row.name,
    section: row.section,
    form_teacher: row.form_teacher || "",
    form_teacher_id: row.form_teacher_id || "",
    capacity: typeof row.capacity === "number" ? row.capacity : 0,
    is_active: row.is_active !== false,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  }));

  const { data: pupils, error: pupilError } = await supabase
    .from("students")
    .select("class_name")
    .in("class_name", arms.map((arm) => arm.name));
  if (pupilError) {
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
 * Files one arm, or the batch of arms.
 * Strict RBAC: SUPER_ADMIN and EXAM_OFFICER only. Never creates portal user accounts or ID cards.
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

  const rows: Omit<ArmRow, "id">[] = [];
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
    if (!(SECTIONS as readonly string[]).includes(section as any)) {
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
      name,
      section,
      form_teacher: typeof item?.form_teacher === "string" ? item.form_teacher.trim().slice(0, 255) : "",
      form_teacher_id: typeof item?.form_teacher_id === "string" ? item.form_teacher_id.trim().slice(0, 50) : "",
      capacity,
      is_active: item?.is_active !== false,
      sort_order: typeof item?.sort_order === "number" ? Math.round(item.sort_order) : 0,
    });
    ids.push(id);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: ArmRow[] = [];
  for (const [index, columns] of rows.entries()) {
    const id = ids[index];
    const stamped = { ...columns, updated_at: new Date().toISOString() };
    const query = id
      ? supabase.from("class_arms").update(stamped).eq("id", id)
      : supabase.from("class_arms").upsert(stamped, { onConflict: "name" });

    const { data, error } = await query.select("*");
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: `A class arm with name “${columns.name}” already exists on the register.` },
          { status: 409 }
        );
      }
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as any[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Fast direct inline editing for class arms (renaming, changing teacher, capacity, active state).
 * Catches 409 Conflict on duplicate names without crashing.
 */
export async function PATCH(request: Request) {
  const access = await requireRoleSession(WRITE_ARMS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, name, section, form_teacher, form_teacher_id, capacity, is_active, sort_order } = (body ?? {}) as Record<string, any>;
  if (!id && !name) {
    return NextResponse.json({ success: false, error: "Provide a class arm ID or unique name to update." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // If renaming, ensure name uniqueness
  if (name && id) {
    const { data: duplicate } = await supabase
      .from("class_arms")
      .select("id")
      .eq("name", String(name).trim())
      .neq("id", id)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        { success: false, error: `A class arm named “${String(name).trim()}” already exists on the school records.` },
        { status: 409 }
      );
    }
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof name === "string" && name.trim().length >= 2) updates.name = name.trim().slice(0, 60);
  if (typeof section === "string" && (SECTIONS as readonly string[]).includes(section as any)) updates.section = section;
  if (typeof form_teacher === "string") updates.form_teacher = form_teacher.trim().slice(0, 255);
  if (typeof form_teacher_id === "string") updates.form_teacher_id = form_teacher_id.trim().slice(0, 50);
  if (typeof capacity === "number" && Number.isFinite(capacity) && capacity >= 0 && capacity <= 500) updates.capacity = Math.round(capacity);
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (typeof sort_order === "number") updates.sort_order = Math.round(sort_order);

  let query = supabase.from("class_arms").update(updates);
  if (id && UUID_PATTERN.test(String(id).trim())) {
    query = query.eq("id", String(id).trim());
  } else if (name) {
    query = query.eq("name", String(name).trim());
  }

  const { data, error } = await query.select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ success: false, error: `A class arm named “${name}” already exists.` }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Class arm record not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

/**
 * Removes arms from the list with strict Referential Integrity Protection.
 * Blocks hard deletion if enrolled pupils or timetable lessons reference this class arm.
 * Suggests deactivating / archiving instead.
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
    // 1. Check enrolled pupils
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

    // 2. Check timetable slots
    const { data: timetableSlots } = await supabase
      .from("timetable_entries")
      .select("id, class_name")
      .in("class_name", names);

    const timetableMap = new Map<string, number>();
    for (const slot of (timetableSlots ?? []) as { class_name: string }[]) {
      timetableMap.set(slot.class_name, (timetableMap.get(slot.class_name) ?? 0) + 1);
    }

    const conflicts: string[] = [];
    for (const name of names) {
      const pCount = holding.get(name) ?? 0;
      const tCount = timetableMap.get(name) ?? 0;
      if (pCount > 0 || tCount > 0) {
        conflicts.push(
          `${name}: ${pCount > 0 ? `${pCount} enrolled pupil${pCount === 1 ? "" : "s"}` : ""}${
            pCount > 0 && tCount > 0 ? ", " : ""
          }${tCount > 0 ? `${tCount} timetable lesson${tCount === 1 ? "" : "s"}` : ""}`
        );
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete class arms with active academic data: ${conflicts.join("; ")}. Deactivate or archive the class arm instead of deleting to preserve historical records.`,
          canArchive: true,
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
