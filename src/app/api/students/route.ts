import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Teachers and the bursary need the roll; enrolling a student is an admissions
// action. A parent's own child is not served here — this route returns the whole
// school, so STUDENT_PARENT stays off the read list until it filters by admission
// number.
const READ_STUDENTS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "TESTERS"] as const;
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
  const denied = await requireRole(READ_STUDENTS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("students")
    .select("*, ca_scores(test1, test2, project, mid_term, exam)")
    .order("created_at", { ascending: false });
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

  const { error } = await supabase.from("students").upsert(rows, { onConflict: "id" });
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
