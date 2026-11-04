import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { guardianScope } from "@/lib/auth/guardian-links";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Teachers and the bursary need the roll; enrolling a student is an admissions
// action. A parent is on the read list but never sees the whole school: the row
// set is narrowed to the pupils linked to their login in guardian_students,
// which the server looks up from the signed session cookie.
const READ_STUDENTS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "TESTERS", "STUDENT_PARENT"] as const;
const WRITE_STUDENTS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StudentPayload = {
  id?: string;
  admission_no?: string;
  full_name?: string;
  gender?: string;
  class_name?: string;
  house?: string;
  guardian_name?: string;
  guardian_phone?: string;
  fee_status?: string;
};

function sanitizeStudent(raw: StudentPayload) {
  if (!raw || typeof raw !== "object") return null;
  const admissionNo = typeof raw.admission_no === "string" ? raw.admission_no.trim() : "";
  const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
  if (!admissionNo || !fullName) return null;
  return {
    // The browser invents its own ids (`s-1730…`); only a real database id may
    // update a row, otherwise the upsert targets a UUID column with garbage.
    id: typeof raw.id === "string" && UUID_PATTERN.test(raw.id.trim()) ? raw.id.trim() : undefined,
    admission_no: admissionNo,
    full_name: fullName,
    gender: raw.gender === "Female" ? "Female" : "Male",
    class_name: typeof raw.class_name === "string" && raw.class_name ? raw.class_name : "Primary 1",
    house: typeof raw.house === "string" && raw.house ? raw.house : "Sapphire (Blue)",
    guardian_name: typeof raw.guardian_name === "string" ? raw.guardian_name : null,
    guardian_phone: typeof raw.guardian_phone === "string" ? raw.guardian_phone : null,
    fee_status: typeof raw.fee_status === "string" && raw.fee_status ? raw.fee_status : "Outstanding",
  };
}

export async function GET() {
  const access = await requireRoleSession(READ_STUDENTS);
  if (access.denied) return access.denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const scope = await guardianScope(access.session);
  if (scope.error) {
    return NextResponse.json(
      {
        success: false,
        error: `The guardian link table could not be read: ${scope.error}.`,
        reason: scope.error,
      },
      { status: 502 }
    );
  }
  if (scope.admissionNos !== null && scope.admissionNos.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No pupil is linked to this login yet, so there is nothing to show. The school office links a parent login to its children in Settings → User Access.",
      },
      { status: 403 }
    );
  }

  // No `ca_scores` embed here. That table is keyed by subject, session and term,
  // so attaching it to a pupil gave the browser one arbitrary subject's marks
  // to display as though they were the child's whole continuous assessment.
  // Filed marks are read from /api/ca, which is asked for a class, a session
  // and a term.
  let query = supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });
  if (scope.admissionNos) query = query.in("admission_no", scope.admissionNos);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const denied = await requireRole(WRITE_STUDENTS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  const rows = list.map((item) => sanitizeStudent(item as StudentPayload)).filter((row): row is NonNullable<typeof row> => row !== null);
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "Provide at least one student with admission_no and full_name." }, { status: 400 });
  }

  // Every row needs an id. The browser is not trusted to supply one (it invents
  // `s-1730…`, which the UUID column rejects), and the live `students` table has
  // no working `uuid_generate_v4()` default, so an insert without an id fails
  // with a not-null violation. A pupil already on file keeps their existing id:
  // `ca_scores` and `invoices` point at students(id), so handing back a fresh
  // UUID on re-save would strand every mark and invoice that child already has.
  const missing = rows.filter((row) => !row.id).map((row) => row.admission_no);
  const existingById = new Map<string, string>();
  if (missing.length > 0) {
    const { data, error: lookupError } = await supabase
      .from("students")
      .select("id, admission_no")
      .in("admission_no", missing);
    if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
    for (const found of data ?? []) {
      if (typeof found.id === "string") existingById.set(found.admission_no, found.id);
    }
  }

  const withIds = rows.map((row) => ({
    ...row,
    id: row.id ?? existingById.get(row.admission_no) ?? randomUUID(),
  }));

  // Keyed on the admission number, which is the identifier the whole portal
  // uses for a pupil (CA scores, invoices and removal all address it) and the
  // column the schema makes unique. Keyed on `id`, re-saving an enrolled child —
  // the same admission number with a browser-generated id — tried to insert a
  // second row and the database refused with a 502 that looked like a fault.
  const { error } = await supabase.from("students").upsert(withIds, { onConflict: "admission_no" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true });
}

/**
 * Removes one student, addressed by admission number. Their CA scores and
 * invoices go with them: both tables reference students(id) ON DELETE CASCADE,
 * which is why this route takes the admission number the school actually uses
 * rather than a client-generated id.
 */
export async function DELETE(request: Request) {
  const denied = await requireRole(WRITE_STUDENTS);
  if (denied) return denied;

  let body: { admissionNo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const admissionNo = typeof body.admissionNo === "string" ? body.admissionNo.trim() : "";
  if (!admissionNo) {
    return NextResponse.json({ success: false, error: "Provide the admission number of the student to remove." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("students")
    .delete()
    .eq("admission_no", admissionNo)
    .select("id");

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  if (!removed || removed.length === 0) {
    return NextResponse.json({ success: false, error: `No student on file with admission number ${admissionNo}.` }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { admissionNo } });
}
