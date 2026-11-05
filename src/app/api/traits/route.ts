import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { guardianScope } from "@/lib/auth/guardian-links";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import { closedTermRefusal, KNOWN_TERMS, validateScope } from "@/lib/supabase/term-scope";

export const dynamic = "force-dynamic";

// Who may file a child's behaviour ratings, attendance and remarks. This is the
// same short list that files marks: the person who rates a pupil's conduct is the
// person who teaches them or signs off their record. TESTERS is absent on purpose
// — QA may read every screen, never write into a child's record.
const WRITE_ASSESSMENT = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER"] as const;

// Reading them is wider, because the family is the reason they exist. The bursary
// still has no business seeing a child's conduct rating.
const READ_ASSESSMENT = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "STUDENT_PARENT", "TESTERS"] as const;

const SQL_FILE = "supabase/traits_assessments.sql";

const MAX_TRAITS = 60;
const REMARK_MAX = 600;
const LABEL_MAX = 100;

type Ratings = Record<string, number>;

interface AssessmentRow {
  student_id: string;
  session: string;
  term: string;
  affective_ratings: Ratings | null;
  psychomotor_ratings: Ratings | null;
  days_opened: number | null;
  days_present: number | null;
  days_absent: number | null;
  form_teacher_remark: string | null;
  principal_remark: string | null;
  next_term_begins: string | null;
  promoted_to: string | null;
  updated_at: string | null;
  students: { admission_no: string; full_name: string; class_name: string } | null;
}

/**
 * One trait object, validated. A rating is a whole number from 0 to 5, where 0
 * means the trait was not rated for this child — it is not a score of zero and
 * the card prints it as a gap, not a mark.
 */
function sanitizeRatings(raw: unknown, label: string): { values: Ratings | null; error: string | null } {
  if (raw === undefined || raw === null) return { values: {}, error: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { values: null, error: `${label} must be a list of trait ratings.` };
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_TRAITS) {
    return { values: null, error: `${label}: no more than ${MAX_TRAITS} traits in one assessment.` };
  }

  const values: Ratings = {};
  for (const [key, value] of entries) {
    const traitId = key.trim();
    if (!traitId || traitId.length > LABEL_MAX) {
      return { values: null, error: `${label}: every rating needs a trait name of at most ${LABEL_MAX} characters.` };
    }
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      return { values: null, error: `${label}: ${traitId} must be a whole number between 0 and 5.` };
    }
    values[traitId] = rating;
  }
  return { values, error: null };
}

/** A bounded whole number, or null when the value is missing, not a number, or outside the range. */
function boundedInt(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.floor(value);
  if (rounded < 0 || rounded > max) return null;
  return rounded;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Reads the assessments the school has actually filed, for one session and term.
 *
 * A family's report card used to be built from the form teacher's own browser: the
 * marks came from the database, the conduct ratings did not exist anywhere else,
 * and a parent on a phone saw an empty panel and were told the child had not been
 * assessed. This is the read half of that repair, and it is the same guardian
 * filter every other pupil-shaped route applies — a parent gets their own children
 * and no other name on the roll.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_ASSESSMENT);
  if (access.denied) return access.denied;

  const params = new URL(request.url).searchParams;
  const session = (params.get("session") || "").trim();
  const terms = Array.from(
    new Set((params.get("term") || "").split(",").map((value) => value.trim()).filter(Boolean))
  );
  const className = (params.get("class_name") || "").trim();

  if (!session || terms.length === 0) {
    return NextResponse.json(
      { success: false, error: "Say which session and term to read — an assessment belongs to both." },
      { status: 400 }
    );
  }
  if (terms.length > 3 || terms.some((term) => !KNOWN_TERMS.includes(term))) {
    return NextResponse.json(
      { success: false, error: `The terms must be chosen from: ${KNOWN_TERMS.join(", ")}.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const scope = await guardianScope(access.session);
  if (scope.error) {
    return NextResponse.json(
      { success: false, error: `The guardian link table could not be read: ${scope.error}.`, reason: scope.error },
      { status: 502 }
    );
  }
  if (scope.admissionNos !== null && scope.admissionNos.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  // traits_assessments carries no class and no admission number of its own; both
  // live on the pupil. Resolving those ids first keeps the filter one the database
  // can honour, rather than a condition on an embedded table a REST layer can
  // quietly ignore and answer with the whole school.
  let studentIds: string[] | null = null;
  if (scope.admissionNos !== null || className) {
    let lookup = supabase.from("students").select("id");
    if (scope.admissionNos) lookup = lookup.in("admission_no", scope.admissionNos);
    if (className) lookup = lookup.eq("class_name", className);

    const { data: pupils, error: pupilError } = await lookup;
    if (pupilError) return NextResponse.json({ success: false, error: pupilError.message }, { status: 502 });

    const ids = (pupils as { id: string }[] ?? []).map((pupil) => pupil.id);
    if (ids.length === 0) return NextResponse.json({ success: true, data: [] });
    studentIds = ids;
  }

  let query = supabase
    .from("traits_assessments")
    .select(
      "student_id, session, term, affective_ratings, psychomotor_ratings, days_opened, days_present, days_absent, form_teacher_remark, principal_remark, next_term_begins, promoted_to, updated_at, students!inner ( admission_no, full_name, class_name )"
    )
    .eq("session", session)
    .in("term", terms);
  if (studentIds) query = query.in("student_id", studentIds);

  const { data, error } = await query;
  if (error) {
    return databaseSetupRequired(error, SQL_FILE) ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const rows = (data as unknown as AssessmentRow[]) ?? [];
  return NextResponse.json({
    success: true,
    data: rows.map((row) => ({
      id: `${row.student_id}|${row.session}|${row.term}`,
      studentId: row.student_id,
      admissionNo: row.students?.admission_no ?? "",
      studentName: row.students?.full_name ?? "",
      className: row.students?.class_name ?? "",
      session: row.session,
      term: row.term,
      affectiveRatings: row.affective_ratings ?? {},
      psychomotorRatings: row.psychomotor_ratings ?? {},
      attendance: {
        daysOpened: Number(row.days_opened) || 0,
        daysPresent: Number(row.days_present) || 0,
        daysAbsent: Number(row.days_absent) || 0,
      },
      formTeacherRemark: row.form_teacher_remark ?? "",
      principalRemark: row.principal_remark ?? "",
      nextTermBegins: row.next_term_begins ?? "",
      promotedTo: row.promoted_to || undefined,
      updatedAt: row.updated_at || undefined,
    })),
  });
}

interface AssessmentBody {
  admissionNo?: string;
  session?: string;
  term?: string;
  affectiveRatings?: unknown;
  psychomotorRatings?: unknown;
  attendance?: { daysOpened?: unknown; daysPresent?: unknown };
  formTeacherRemark?: unknown;
  principalRemark?: unknown;
  nextTermBegins?: unknown;
  promotedTo?: unknown;
}

/**
 * Files one pupil's character, psychomotor and attendance record for a session and
 * term, replacing what was there for that term.
 *
 * `days_absent` is a generated column and is never sent: it is the days the school
 * was opened minus the days the child was there, and a figure the browser typed in
 * could disagree with both.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_ASSESSMENT);
  if (access.denied) return access.denied;

  let body: AssessmentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const admissionNo = (body.admissionNo || "").trim();
  if (!admissionNo) {
    return NextResponse.json({ success: false, error: "Provide the student's admission number." }, { status: 400 });
  }

  const session = (body.session || "").trim();
  const term = (body.term || "").trim();
  const scopeRefusal = validateScope(session, term);
  if (scopeRefusal) return scopeRefusal;

  const affective = sanitizeRatings(body.affectiveRatings, "The affective ratings");
  if (affective.error) return NextResponse.json({ success: false, error: affective.error }, { status: 400 });
  const psychomotor = sanitizeRatings(body.psychomotorRatings, "The psychomotor ratings");
  if (psychomotor.error) return NextResponse.json({ success: false, error: psychomotor.error }, { status: 400 });

  const daysOpened = boundedInt(body.attendance?.daysOpened, 400);
  if (daysOpened === null) {
    return NextResponse.json(
      { success: false, error: "Days school opened must be a whole number between 0 and 400." },
      { status: 400 }
    );
  }
  const daysPresent = boundedInt(body.attendance?.daysPresent, daysOpened);
  if (daysPresent === null) {
    return NextResponse.json(
      { success: false, error: `Days present must be a whole number between 0 and the ${daysOpened} days the school was opened.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const termRefusal = await closedTermRefusal(supabase, session, term);
  if (termRefusal) return termRefusal;

  const { data: student, error: lookupError } = await supabase
    .from("students")
    .select("id, full_name, class_name, admission_no")
    .ilike("admission_no", admissionNo)
    .maybeSingle<{ id: string; full_name: string; class_name: string; admission_no: string }>();

  if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  if (!student) {
    return NextResponse.json({ success: false, error: `No student found with admission number ${admissionNo}.` }, { status: 404 });
  }

  const { data: saved, error: saveError } = await supabase
    .from("traits_assessments")
    .upsert(
      {
        student_id: student.id,
        session,
        term,
        affective_ratings: affective.values,
        psychomotor_ratings: psychomotor.values,
        days_opened: daysOpened,
        days_present: daysPresent,
        form_teacher_remark: text(body.formTeacherRemark, REMARK_MAX),
        principal_remark: text(body.principalRemark, REMARK_MAX),
        next_term_begins: text(body.nextTermBegins, LABEL_MAX),
        promoted_to: text(body.promotedTo, LABEL_MAX),
        // Who filed it, from the signed session rather than from the request, so a
        // card that surprises a family has a name behind the rating.
        assessed_by: access.session.username,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,session,term" }
    )
    .select("student_id, session, term, affective_ratings, psychomotor_ratings, days_opened, days_present, days_absent, form_teacher_remark, principal_remark, next_term_begins, promoted_to, updated_at");

  if (saveError) {
    return databaseSetupRequired(saveError, SQL_FILE) ?? NextResponse.json({ success: false, error: saveError.message }, { status: 502 });
  }

  const row = (Array.isArray(saved) ? saved[0] : null) as Omit<AssessmentRow, "students"> | null;
  return NextResponse.json({
    success: true,
    data: {
      admissionNo: student.admission_no,
      studentName: student.full_name,
      className: student.class_name,
      session,
      term,
      attendance: {
        daysOpened: Number(row?.days_opened) || daysOpened,
        daysPresent: Number(row?.days_present) || daysPresent,
        daysAbsent: Number(row?.days_absent) || Math.max(0, daysOpened - daysPresent),
      },
      savedAt: row?.updated_at ?? null,
    },
  });
}
