import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Matches isActionAuthorized("ENTER_CA") in src/lib/rbac.ts. TESTERS is absent on
// purpose: QA may exercise modules, never a write path.
const ENTER_CA = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER"] as const;

// ca_scores column limits, straight from the schema's CHECK constraints.
const COMPONENT_MAX = { test1: 10, test2: 10, project: 10, midTerm: 10 } as const;
const EXAM_MAX = 60;

type ScoreEntry = {
  subject?: string;
  test1?: number;
  test2?: number;
  project?: number;
  midTerm?: number;
  exam?: number;
  grade?: string;
  remark?: string;
};

type CAPayload = {
  admissionNo?: string;
  session?: string;
  term?: string;
  scores?: ScoreEntry[];
};

/** Returns a bounded number, or null when the value is missing, not a number, or out of range. */
function bounded(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Writes one student's continuous-assessment scores for a session/term.
 *
 * `total_score` is a generated column and is never sent. `tier_grade` is
 * required from the caller rather than defaulted: the database would happily
 * accept the schema default of 'F', which would silently book a failed grade
 * against a child who was never graded.
 */
export async function POST(request: Request) {
  const denied = await requireRole(ENTER_CA);
  if (denied) return denied;

  let body: CAPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const admissionNo = (body.admissionNo || "").trim();
  if (!admissionNo) {
    return NextResponse.json({ success: false, error: "Provide the student's admission number." }, { status: 400 });
  }

  const session = (body.session || "").trim() || "2025/2026";
  const term = (body.term || "").trim() || "First Term";

  if (!Array.isArray(body.scores) || body.scores.length === 0) {
    return NextResponse.json({ success: false, error: "Provide at least one subject score." }, { status: 400 });
  }
  if (body.scores.length > 60) {
    return NextResponse.json({ success: false, error: "Too many subjects in one submission (max 60)." }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  const seenSubjects = new Set<string>();

  for (const entry of body.scores) {
    const subject = (entry?.subject || "").trim();
    if (!subject || subject.length > 255) {
      return NextResponse.json({ success: false, error: "Every score needs a subject name." }, { status: 400 });
    }

    const key = subject.toLowerCase();
    if (seenSubjects.has(key)) {
      return NextResponse.json({ success: false, error: `${subject} appears twice in one submission.` }, { status: 400 });
    }
    seenSubjects.add(key);

    const components: Record<string, number | null> = {};
    for (const [field, max] of Object.entries(COMPONENT_MAX)) {
      components[field] = bounded(entry[field as keyof ScoreEntry], max);
      if (components[field] === null) {
        return NextResponse.json(
          { success: false, error: `${subject}: ${field} must be a number between 0 and ${max}.` },
          { status: 400 }
        );
      }
    }

    const exam = bounded(entry.exam, EXAM_MAX);
    if (exam === null) {
      return NextResponse.json({ success: false, error: `${subject}: exam must be a number between 0 and ${EXAM_MAX}.` }, { status: 400 });
    }

    const grade = (entry.grade || "").trim();
    if (!grade || grade.length > 10) {
      return NextResponse.json(
        { success: false, error: `${subject}: grade is required so a score is never filed under the schema default.` },
        { status: 400 }
      );
    }

    rows.push({
      subject,
      session,
      term,
      test1: components.test1,
      test2: components.test2,
      project: components.project,
      mid_term: components.midTerm,
      exam,
      tier_grade: grade,
      remark: (entry.remark || "").trim().slice(0, 100) || "Fair",
      updated_at: new Date().toISOString(),
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

  const { data: student, error: lookupError } = await supabase
    .from("students")
    .select("id, full_name, class_name, admission_no")
    .ilike("admission_no", admissionNo)
    .maybeSingle<{ id: string; full_name: string; class_name: string; admission_no: string }>();

  if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  if (!student) {
    return NextResponse.json({ success: false, error: `No student found with admission number ${admissionNo}.` }, { status: 404 });
  }

  for (const row of rows) row.student_id = student.id;

  const { data: saved, error: saveError } = await supabase
    .from("ca_scores")
    .upsert(rows, { onConflict: "student_id,subject,session,term" })
    .select("subject, session, term, test1, test2, project, mid_term, exam, total_score, tier_grade, remark, updated_at");

  if (saveError) return NextResponse.json({ success: false, error: saveError.message }, { status: 502 });

  return NextResponse.json({
    success: true,
    data: {
      admissionNo: student.admission_no,
      studentName: student.full_name,
      className: student.class_name,
      session,
      term,
      saved: saved?.length ?? 0,
      scores: saved ?? [],
    },
  });
}
