import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/classes_and_subjects.sql";

// The subject list decides which lines a CA grid offers and which papers a
// timetable can place, so it is read by everybody who teaches and written by
// the office that sets the curriculum.
const READ_SUBJECTS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
const WRITE_SUBJECTS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubjectPayload = {
  id?: string;
  name?: string;
  code?: string;
  category?: string;
  applicable_classes?: unknown;
  is_compulsory?: unknown;
  is_core?: boolean;
  school_level?: "PRIMARY" | "SECONDARY" | "ALL";
  is_active?: boolean;
};

type SubjectRow = {
  id: string;
  name: string;
  code: string;
  category: string;
  applicable_classes: string[];
  is_compulsory: boolean;
  is_core: boolean;
  school_level: "PRIMARY" | "SECONDARY" | "ALL";
  is_active: boolean;
};

function nameList(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean))
  ).slice(0, cap);
}

/**
 * The subjects the school teaches with core status, school level, and active flags.
 */
export async function GET() {
  const denied = await requireRole(READ_SUBJECTS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("name")
    .order("category");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const rows = ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code || "",
    category: row.category || "General / Core",
    applicable_classes: Array.isArray(row.applicable_classes) ? row.applicable_classes : [],
    is_compulsory: row.is_compulsory !== false,
    is_core: Boolean(row.is_core),
    school_level: (row.school_level || "PRIMARY") as "PRIMARY" | "SECONDARY" | "ALL",
    is_active: row.is_active !== false,
  }));

  return NextResponse.json({
    success: true,
    data: rows,
  });
}

/**
 * Files a subject, or the batch of subjects.
 * Supports comma-separated batch names (e.g. "Maths, English, Basic Science").
 * Strict RBAC: SUPER_ADMIN and EXAM_OFFICER only.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_SUBJECTS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawList = Array.isArray(body) ? body : [body];
  if (rawList.length === 0) {
    return NextResponse.json({ success: false, error: "No subject was sent." }, { status: 400 });
  }
  if (rawList.length > 200) {
    return NextResponse.json({ success: false, error: "Too many subjects in one submission (max 200)." }, { status: 400 });
  }

  // Expand comma-separated names into individual subjects if passed
  const list: SubjectPayload[] = [];
  for (const item of rawList as SubjectPayload[]) {
    const rawName = typeof item?.name === "string" ? item.name.trim() : "";
    if (rawName.includes(",")) {
      const parts = rawName.split(",").map((s) => s.trim()).filter((s) => s.length >= 2);
      for (const part of parts) {
        list.push({ ...item, name: part });
      }
    } else {
      list.push(item);
    }
  }

  const rows: Omit<SubjectRow, "id">[] = [];
  const ids: string[] = [];
  for (const item of list) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "A subject needs a name a parent would read on the card (at least two characters)." },
        { status: 400 }
      );
    }
    if (name.length > 120) {
      return NextResponse.json({ success: false, error: `“${name.slice(0, 30)}…” is longer than the 120 characters a subject name holds.` }, { status: 400 });
    }

    const classes = nameList(item?.applicable_classes, 60);
    const isCore =
      Boolean(item?.is_core) ||
      name.toLowerCase().includes("mathematics") ||
      name.toLowerCase().includes("english language") ||
      name.toLowerCase() === "english" ||
      name.toLowerCase() === "maths";

    rows.push({
      name,
      code: typeof item?.code === "string" ? item.code.trim().slice(0, 40) : "",
      category: typeof item?.category === "string" ? item.category.trim().slice(0, 60) : "General / Core",
      applicable_classes: classes,
      is_compulsory: item?.is_compulsory !== false,
      is_core: isCore,
      school_level: (item?.school_level || "PRIMARY") as "PRIMARY" | "SECONDARY" | "ALL",
      is_active: item?.is_active !== false,
    });
    ids.push(typeof item?.id === "string" && UUID_PATTERN.test(item.id.trim()) ? item.id.trim() : "");
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: SubjectRow[] = [];
  for (const [index, columns] of rows.entries()) {
    const id = ids[index];
    const stamped = { ...columns, updated_at: new Date().toISOString() };
    const query = id
      ? supabase.from("subjects").update(stamped).eq("id", id)
      : supabase.from("subjects").upsert(stamped, { onConflict: "name,category" });

    const { data, error } = await query.select("*");
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: `A subject with name “${columns.name}” already exists in department “${columns.category}”.` },
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
 * Fast direct inline editing for subjects (name, code, category, is_compulsory, is_core, school_level, is_active).
 * Catches 409 Conflict without crashing.
 */
export async function PATCH(request: Request) {
  const access = await requireRoleSession(WRITE_SUBJECTS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    id,
    name,
    code,
    category,
    applicable_classes,
    is_compulsory,
    is_core,
    school_level,
    is_active,
  } = (body ?? {}) as Record<string, any>;

  if (!id && !name) {
    return NextResponse.json({ success: false, error: "Provide a subject ID or name to update." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // If renaming, ensure (name, category) uniqueness
  if (name && id) {
    const checkQuery = supabase
      .from("subjects")
      .select("id")
      .eq("name", String(name).trim())
      .neq("id", id);
    if (category) checkQuery.eq("category", String(category).trim());

    const { data: duplicate } = await checkQuery.maybeSingle();
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: `Subject “${String(name).trim()}” is already registered in this department.` },
        { status: 409 }
      );
    }
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof name === "string" && name.trim().length >= 2) updates.name = name.trim().slice(0, 120);
  if (typeof code === "string") updates.code = code.trim().slice(0, 40);
  if (typeof category === "string" && category.trim()) updates.category = category.trim().slice(0, 60);
  if (Array.isArray(applicable_classes)) updates.applicable_classes = nameList(applicable_classes, 60);
  if (typeof is_compulsory === "boolean") updates.is_compulsory = is_compulsory;
  if (typeof is_core === "boolean") updates.is_core = is_core;
  if (typeof school_level === "string") updates.school_level = school_level;
  if (typeof is_active === "boolean") updates.is_active = is_active;

  let query = supabase.from("subjects").update(updates);
  if (id && UUID_PATTERN.test(String(id).trim())) {
    query = query.eq("id", String(id).trim());
  } else if (name) {
    query = query.eq("name", String(name).trim());
  }

  const { data, error } = await query.select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ success: false, error: `A subject with name “${name}” already exists in this category.` }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Subject record not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

/**
 * Removes subjects with Referential Integrity Protection.
 * Blocks hard deletion if CA scores or timetable lessons reference this subject.
 * Offers deactivation / archiving instead.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_SUBJECTS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { ids?: unknown };
  const ids = Array.isArray(sent.ids) ? sent.ids.filter((id) => typeof id === "string" && UUID_PATTERN.test(id.trim())) : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "No subject on this device has a record on the school's list, so nothing was removed. Reload the page." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: subjects, error: readError } = await supabase
    .from("subjects")
    .select("id, name")
    .in("id", ids.map((id) => id.trim()));
  if (readError) {
    const setup = databaseSetupRequired(readError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }

  const names = (subjects ?? []).map((row) => row.name as string);

  if (names.length > 0) {
    // 1. Check CA Scores
    const { data: filedMarks } = await supabase
      .from("ca_scores")
      .select("subject")
      .in("subject", names);

    const markCounts = new Map<string, number>();
    for (const row of (filedMarks ?? []) as { subject: string }[]) {
      markCounts.set(row.subject, (markCounts.get(row.subject) ?? 0) + 1);
    }

    // 2. Check Timetable Entries
    const { data: timetableSlots } = await supabase
      .from("timetable_entries")
      .select("subject")
      .in("subject", names);

    const timetableCounts = new Map<string, number>();
    for (const row of (timetableSlots ?? []) as { subject: string }[]) {
      timetableCounts.set(row.subject, (timetableCounts.get(row.subject) ?? 0) + 1);
    }

    const conflicts: string[] = [];
    for (const name of names) {
      const marks = markCounts.get(name) ?? 0;
      const slots = timetableCounts.get(name) ?? 0;
      if (marks > 0 || slots > 0) {
        conflicts.push(
          `${name}: ${marks > 0 ? `${marks} CA score record${marks === 1 ? "" : "s"}` : ""}${
            marks > 0 && slots > 0 ? ", " : ""
          }${slots > 0 ? `${slots} timetable slot${slots === 1 ? "" : "s"}` : ""}`
        );
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete subjects with existing academic records: ${conflicts.join("; ")}. Deactivate or archive this subject instead to preserve historical pupil report cards.`,
          canArchive: true,
          data: { blocked: [...markCounts.keys(), ...timetableCounts.keys()] },
        },
        { status: 409 }
      );
    }
  }

  const { data: removed, error } = await supabase
    .from("subjects")
    .delete()
    .in("id", ids.map((id) => id.trim()))
    .select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: { removed: removed?.length ?? 0 },
  });
}
