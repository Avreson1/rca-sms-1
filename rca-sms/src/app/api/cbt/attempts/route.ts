import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const REVIEWERS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER"] as const;

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// A student/parent account submits its own CBT attempt. Questions are still scored in the
// browser, so every attempt is stored with needs_review = true until a teacher confirms it.
export async function POST(request: Request) {
  const auth = await requireRole(["STUDENT_PARENT"]);
  if ("error" in auth) return auth.error;
  const { profile, supabase } = auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.subject !== "string" || !body.subject.trim()) {
    return NextResponse.json({ success: false, error: "subject is required" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, class_name")
    .eq("portal_user_id", profile.authUserId)
    .limit(1)
    .maybeSingle<{ id: string; class_name: string }>();
  if (studentError || !student) {
    return NextResponse.json({ success: false, error: "No student record is linked to this login" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ success: false, error: "CBT submissions are not configured" }, { status: 503 });
  }

  const maxMarks = Math.min(Math.max(toNumber(body.maxMarks, 60), 1), 999);
  const score = Math.min(Math.max(toNumber(body.score), 0), maxMarks);
  const logs = Array.isArray(body.logs) ? body.logs.slice(0, 50) : [];

  const { data, error } = await admin
    .from("cbt_exam_sessions")
    .insert({
      student_id: student.id,
      subject: body.subject.trim().slice(0, 255),
      class_name: student.class_name,
      cbt_score: score,
      max_marks: maxMarks,
      strikes: Math.min(Math.max(Math.trunc(toNumber(body.strikes)), 0), 99),
      is_expelled: body.flagged === true,
      malpractice_logs: logs,
      needs_review: true,
    })
    .select("id, needs_review")
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function GET() {
  const auth = await requireRole([...REVIEWERS]);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("cbt_exam_sessions")
    .select("id, subject, class_name, cbt_score, max_marks, strikes, is_expelled, completed_at, students(full_name, admission_no)")
    .eq("needs_review", true)
    .order("completed_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

// A reviewer confirms (and optionally corrects) a flagged attempt.
export async function PATCH(request: Request) {
  const auth = await requireRole([...REVIEWERS]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }
  const update: Record<string, unknown> = { needs_review: false };
  if (body.cbtScore !== undefined) update.cbt_score = Math.max(toNumber(body.cbtScore), 0);

  const { data, error } = await auth.supabase
    .from("cbt_exam_sessions")
    .update(update)
    .eq("id", body.id)
    .select("id, cbt_score, needs_review")
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ success: false, error: "Attempt not found" }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
