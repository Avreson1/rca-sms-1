import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/classes_and_subjects.sql";

// A template is the set of subjects one arm sits. The CA grid offers it as a
// shortcut, so a teacher on another machine needs the same shortcut the office
// built — which is the whole reason this stopped living in one browser.
const READ_TEMPLATES = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
const WRITE_TEMPLATES = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEPARTMENTS = [
  "Early Years",
  "Nursery",
  "Primary",
  "Science",
  "Arts",
  "Commercial",
  "General",
] as const;

type TemplatePayload = {
  id?: string;
  name?: string;
  department?: string;
  target_class?: string;
  subjects?: unknown;
};

type TemplateRow = {
  id: string;
  name: string;
  department: string;
  target_class: string;
  subjects: string[];
};

/**
 * The saved subject packages, one row per template name.
 *
 * A package names its year group in its own words — "SS 1 - SS 3" covers three
 * arms — so the list carries text, not a foreign key. What the CA grid does with
 * it is the teacher's choice, made against the class actually on screen.
 */
export async function GET() {
  const denied = await requireRole(READ_TEMPLATES);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("subject_templates").select("*").order("name");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const rows = ((data ?? []) as unknown as TemplateRow[]).map((row) => ({
    ...row,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
  }));

  return NextResponse.json({ success: true, data: rows });
}

/**
 * Files a template. Re-sending the same name corrects that template.
 *
 * A second "JSS 1 Sciences" with a different list of subjects in it is not two
 * packages, it is one package whose editor was used twice, and the CA grid
 * would ask a teacher which one to sit.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_TEMPLATES);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No subject template was sent." }, { status: 400 });
  }
  if (list.length > 100) {
    return NextResponse.json({ success: false, error: "Too many templates in one submission (max 100)." }, { status: 400 });
  }

  const rows: Omit<TemplateRow, "id">[] = [];
  const ids: string[] = [];
  for (const item of list as TemplatePayload[]) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "A subject package needs a name the office would recognise (at least two characters)." },
        { status: 400 }
      );
    }

    const department = typeof item?.department === "string" ? item.department : "";
    if (!(DEPARTMENTS as readonly string[]).includes(department)) {
      return NextResponse.json(
        { success: false, error: `“${name || "(unnamed)"}” has a department the school does not use: ${department || "(none)"}. Use one of: ${DEPARTMENTS.join(", ")}.` },
        { status: 400 }
      );
    }

    const subjects = Array.isArray(item?.subjects)
      ? Array.from(
          new Set(item.subjects.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean))
        ).slice(0, 100)
      : [];
    if (subjects.length === 0) {
      return NextResponse.json(
        { success: false, error: `“${name}” has no subjects in it, so filing it would save nothing a teacher could sit.` },
        { status: 400 }
      );
    }

    rows.push({
      name: name.slice(0, 120),
      department,
      target_class: typeof item?.target_class === "string" ? item.target_class.trim().slice(0, 60) : "",
      subjects,
    });
    ids.push(typeof item?.id === "string" && UUID_PATTERN.test(item.id.trim()) ? item.id.trim() : "");
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: TemplateRow[] = [];
  for (const [index, columns] of rows.entries()) {
    const id = ids[index];
    const stamped = { ...columns, updated_at: new Date().toISOString() };
    const query = id
      ? supabase.from("subject_templates").update(stamped).eq("id", id)
      : supabase.from("subject_templates").upsert(stamped, { onConflict: "name" });

    const { data, error } = await query.select("*");
    if (error) {
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as unknown as TemplateRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Removes templates. The marks already entered from a template are on the CA
 * grid under each subject and do not live here, so this only takes the shortcut
 * away.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_TEMPLATES);
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
      { success: false, error: "No template on this device has a record on the school's list, so nothing was removed. Reload the page." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("subject_templates")
    .delete()
    .in("id", ids.map((id) => id.trim()))
    .select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { removed: removed?.length ?? 0 } });
}
