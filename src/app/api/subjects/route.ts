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
};

type SubjectRow = {
  id: string;
  name: string;
  code: string;
  category: string;
  applicable_classes: string[];
  is_compulsory: boolean;
};

function nameList(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean))
  ).slice(0, cap);
}

/**
 * The subjects the school teaches.
 *
 * A subject is one row per name within a band, so "Mathematics" in Nursery and
 * "Mathematics" in SSS 3 stay two entries — they are two different papers on two
 * different grids, and merging them would put one set of marks under both.
 */
export async function GET() {
  const denied = await requireRole(READ_SUBJECTS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("subjects").select("*").order("name").order("category");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: ((data ?? []) as unknown as SubjectRow[]).map((row) => ({
      ...row,
      applicable_classes: Array.isArray(row.applicable_classes) ? row.applicable_classes : [],
    })),
  });
}

/**
 * Files a subject, or the batch the Subjects screen has on screen.
 *
 * The same name in the same band updates the row instead of adding a second
 * line, because a duplicated subject in a CA grid means two sets of marks for
 * one paper and the office has no way to tell which one the card printed.
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

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No subject was sent." }, { status: 400 });
  }
  if (list.length > 200) {
    return NextResponse.json({ success: false, error: "Too many subjects in one submission (max 200)." }, { status: 400 });
  }

  const rows: Omit<SubjectRow, "id">[] = [];
  const ids: string[] = [];
  for (const item of list as SubjectPayload[]) {
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
    rows.push({
      name,
      code: typeof item?.code === "string" ? item.code.trim().slice(0, 40) : "",
      category: typeof item?.category === "string" ? item.category.trim().slice(0, 60) : "",
      applicable_classes: classes,
      is_compulsory: item?.is_compulsory !== false,
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
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as unknown as SubjectRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Removes subjects from the list.
 *
 * Marks already filed keep the subject name they were entered under, so this
 * cannot empty a child's card. It does take the subject out of the CA grid, so
 * the answer says which of the removed subjects still have marks behind them:
 * putting the name back on the list brings those marks onto the grid again.
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

  let stillFiled: string[] = [];
  if (names.length > 0) {
    const { data: filed, error: filedError } = await supabase
      .from("ca_scores")
      .select("subject")
      .in("subject", names);
    if (filedError) {
      // The marks are in a different table from the list. Not being able to read
      // them does not mean there are none, so the screen is told which check
      // could not be made rather than being handed a clean answer.
      return NextResponse.json({ success: false, error: filedError.message }, { status: 502 });
    }
    stillFiled = [...new Set(((filed ?? []) as { subject: string }[]).map((row) => row.subject))];
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
    data: { removed: removed?.length ?? 0, still_filed: stillFiled },
  });
}
