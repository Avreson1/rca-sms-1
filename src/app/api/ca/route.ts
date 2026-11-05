import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { guardianScope } from "@/lib/auth/guardian-links";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import { closedTermRefusal, validateScope } from "@/lib/supabase/term-scope";

export const dynamic = "force-dynamic";

// Matches isActionAuthorized("ENTER_CA") in src/lib/rbac.ts. TESTERS is absent on
// purpose: QA may exercise modules, never a write path.
const ENTER_CA = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER"] as const;

// Reading filed marks is a different permission from filing them. The bursary
// and the accountant have no need of a child's grades, so they are not here.
const READ_CA = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "STUDENT_PARENT", "TESTERS"] as const;

// ca_scores column limits, straight from the schema's CHECK constraints.
const COMPONENT_MAX = { test1: 10, test2: 10, project: 10, midTerm: 10 } as const;
const EXAM_MAX = 60;

// The REST layer hands back at most this many rows per request, so a read that
// could exceed it is paged rather than silently truncated.
const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;

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

/** One `ca_scores` row with its pupil attached. Money-like columns arrive as strings. */
type CaReadRow = {
  student_id: string;
  subject: string;
  session: string;
  term: string;
  test1: string | number | null;
  test2: string | number | null;
  project: string | number | null;
  mid_term: string | number | null;
  exam: string | number | null;
  total_score: string | number | null;
  tier_grade: string | null;
  remark: string | null;
  updated_at: string | null;
  students: { admission_no: string; full_name: string; class_name: string } | null;
};

/** Returns a bounded number, or null when the value is missing, not a number, or out of range. */
function bounded(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return null;
  return Math.round(value * 100) / 100;
}

interface BracketRow {
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
}

interface TierRow {
  id: string;
  applicable_classes: string[] | null;
  brackets: BracketRow[] | null;
}

/**
 * The scale a pupil is graded against, from the school's own `grading_tiers`
 * table. The class arms listed in `applicable_classes` win; the name heuristic
 * is only the fallback for a class the office has not listed anywhere.
 */
function tierForClass(className: string, tiers: TierRow[]): TierRow | null {
  const lower = (className || "").toLowerCase();
  const listed = tiers.find(
    (tier) => Array.isArray(tier.applicable_classes) && tier.applicable_classes.some((arm) => String(arm).toLowerCase() === lower)
  );
  if (listed) return listed;

  const wanted =
    lower.includes("pre-play") || (lower.includes("play") && !lower.includes("display"))
      ? "PRE_PLAY_PLAY"
      : lower.includes("nursery")
        ? "NURSERY"
        : lower.includes("primary") || lower.includes("basic")
          ? "PRIMARY"
          : lower.includes("jss") || lower.includes("junior")
            ? "JUNIOR_SECONDARY"
            : "SECONDARY";

  return tiers.find((tier) => tier.id === wanted) ?? tiers.find((tier) => tier.id === "PRIMARY") ?? tiers.find((tier) => tier.id === "SECONDARY") ?? null;
}

/**
 * The bracket a total falls into.
 *
 * The bracket with the highest floor that the total clears wins, because a
 * scale written in whole numbers (70-84) has no bracket for 84.5, and a mark of
 * 84.5 is nearer an A than a B than it is anything else. null means the total
 * is below every bracket on the scale, which is a scale the office must fix.
 */
function bracketForTotal(total: number, tier: TierRow | null) {
  if (!tier || !Array.isArray(tier.brackets)) return null;
  let best: BracketRow | null = null;
  for (const bracket of tier.brackets) {
    const floor = Number(bracket.minScore);
    if (Number.isFinite(floor) && total >= floor && (!best || floor > Number(best.minScore))) best = bracket;
  }
  return best;
}

/**
 * Reads the marks the school has actually filed, for one session and term.
 *
 * Report cards used to be built from the browser's own copy, so a clerk who
 * filed a pupil's Mathematics on the staff room machine saw an empty card on
 * the one in the office. This is the read half of that repair.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_CA);
  if (access.denied) return access.denied;

  const params = new URL(request.url).searchParams;
  const session = (params.get("session") || "").trim();
  // A cumulative card needs all three terms, and one request per card beats
  // three requests that can disagree with each other half-way through.
  const terms = Array.from(new Set((params.get("term") || "").split(",").map((value) => value.trim()).filter(Boolean)));
  const className = (params.get("class_name") || "").trim();

  if (!session || terms.length === 0) {
    return NextResponse.json(
      { success: false, error: "Say which session and term to read — a mark belongs to both." },
      { status: 400 }
    );
  }
  if (terms.length > 3) {
    return NextResponse.json(
      { success: false, error: "A session has three terms; ask for no more than that in one read." },
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

  // ca_scores carries no class and no admission number of its own; both live on
  // the pupil. Resolving those ids first means the filter is one the database
  // can honour, rather than a condition on an embedded table that a REST layer
  // can quietly ignore and answer with the whole school.
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

  const found: CaReadRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    let query = supabase
      .from("ca_scores")
      .select(
        "student_id, subject, session, term, test1, test2, project, mid_term, exam, total_score, tier_grade, remark, updated_at, students!inner ( admission_no, full_name, class_name )"
      )
      .eq("session", session)
      .in("term", terms)
      .order("id", { ascending: true });
    if (studentIds) query = query.in("student_id", studentIds);

    const { data, error } = await query.range(start, start + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });

    const page = (data as unknown as CaReadRow[]) ?? [];
    found.push(...page);
    if (page.length < PAGE_SIZE) break;
    if (found.length >= MAX_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `There are more than ${MAX_ROWS} filed marks for ${session} (${terms.join(", ")}). Ask for one class at a time with class_name.`,
        },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: found.map((row) => ({
      student_id: row.student_id,
      admission_no: row.students?.admission_no ?? "",
      full_name: row.students?.full_name ?? "",
      class_name: row.students?.class_name ?? "",
      subject: row.subject,
      session: row.session,
      term: row.term,
      test1: row.test1,
      test2: row.test2,
      project: row.project,
      mid_term: row.mid_term,
      exam: row.exam,
      total_score: row.total_score,
      tier_grade: row.tier_grade,
      remark: row.remark,
      updated_at: row.updated_at,
    })),
  });
}

/**
 * Writes one student's continuous-assessment scores for a session/term.
 *
 * `total_score` is a generated column and is never sent. `tier_grade` and
 * `remark` are worked out here from the school's `grading_tiers`, because the
 * letter on a printed card has to follow from the marks rather than from
 * whatever the browser sent — and the schema default of 'F' would otherwise
 * book a failed grade against a child who was never graded.
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

  const session = (body.session || "").trim();
  const term = (body.term || "").trim();
  const scopeRefusal = validateScope(session, term);
  if (scopeRefusal) return scopeRefusal;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // A term the office has signed off is finished; nothing may be filed into it.
  const termRefusal = await closedTermRefusal(supabase, session, term);
  if (termRefusal) return termRefusal;

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

    // The grade is not taken from the request. A browser that had a different
    // scale, a stale tab or a tampered body could file an 'A' against 32/100,
    // and that letter is what prints on the paper card the family collects.
    const total = (components.test1 ?? 0) + (components.test2 ?? 0) + (components.project ?? 0) + (components.midTerm ?? 0) + exam;

    rows.push({
      subject,
      session,
      term,
      test1: components.test1,
      test2: components.test2,
      project: components.project,
      mid_term: components.midTerm,
      exam,
      total,
      updated_at: new Date().toISOString(),
    });
  }

  const { data: student, error: lookupError } = await supabase
    .from("students")
    .select("id, full_name, class_name, admission_no")
    .ilike("admission_no", admissionNo)
    .maybeSingle<{ id: string; full_name: string; class_name: string; admission_no: string }>();

  if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  if (!student) {
    return NextResponse.json({ success: false, error: `No student found with admission number ${admissionNo}.` }, { status: 404 });
  }

  // The grade is worked out here, from the school's own scale, and the pupil's
  // class decides which scale applies.
  const { data: tierRows, error: tierError } = await supabase
    .from("grading_tiers")
    .select("id, applicable_classes, brackets");

  if (tierError) {
    return NextResponse.json(
      { success: false, error: `The grading scale could not be read: ${tierError.message}.`, reason: tierError.message },
      { status: 502 }
    );
  }

  const tiers = (tierRows as unknown as TierRow[]) ?? [];
  const tier = tierForClass(student.class_name, tiers);
  if (!tier) {
    return NextResponse.json(
      {
        success: false,
        error: `There is no grading scale on file to grade ${student.class_name} with, so nothing was saved. Set one up under Settings → Grading Scales.`,
      },
      { status: 409 }
    );
  }

  const graded: Record<string, unknown>[] = [];
  for (const row of rows) {
    const total = Number(row.total);
    const bracket = bracketForTotal(total, tier);
    if (!bracket) {
      return NextResponse.json(
        {
          success: false,
          error: `${String(row.subject)}: a total of ${total} falls outside every bracket in the ${tier.id} scale, so it cannot be graded. Nothing was saved.`,
        },
        { status: 400 }
      );
    }

    // `total` is not a column; the database computes total_score from the five
    // marks that were sent.
    const { total: _derivedOnly, ...columns } = row;
    graded.push({
      ...columns,
      student_id: student.id,
      tier_grade: String(bracket.grade).slice(0, 10),
      remark: String(bracket.remark).slice(0, 100),
    });
  }

  const { data: saved, error: saveError } = await supabase
    .from("ca_scores")
    .upsert(graded, { onConflict: "student_id,subject,session,term" })
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
