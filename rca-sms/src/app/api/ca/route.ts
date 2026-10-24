import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

const SCORE_FIELDS = ["test1", "test2", "project", "mid_term", "exam"] as const;

export async function POST(request: Request) {
  const auth = await requireRole(["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER"]);
  if ("error" in auth) return auth.error;

  let body: { admissionNo?: string; subject?: string; session?: string; term?: string; scores?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid CA payload" }, { status: 400 });
  }
  const { admissionNo, subject, session, term, scores } = body;
  if (!admissionNo || !subject || !session || !term || !scores) {
    return NextResponse.json(
      { success: false, error: "admissionNo, subject, session, term and scores are required" },
      { status: 400 }
    );
  }

  const { data: student, error: studentError } = await auth.supabase
    .from("students")
    .select("id")
    .eq("admission_no", admissionNo)
    .maybeSingle<{ id: string }>();
  if (studentError || !student) {
    return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
  }

  const values = Object.fromEntries(
    SCORE_FIELDS.filter((k) => k in scores).map((k) => [k, Number(scores[k])])
  );
  const { data, error } = await auth.supabase
    .from("ca_scores")
    .upsert(
      { student_id: student.id, subject, session, term, ...values, updated_at: new Date().toISOString() },
      { onConflict: "student_id,subject,session,term" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: `Scores saved for ${admissionNo}`, data });
}
