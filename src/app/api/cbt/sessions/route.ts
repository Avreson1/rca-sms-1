import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/rbac";
import { requireRoleSession } from "@/lib/auth/guard";
import { guardianScope } from "@/lib/auth/guardian-links";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { closedTermRefusal, validateScope } from "@/lib/supabase/term-scope";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/cbt.sql";
const COLUMNS = "id, student_id, student_name, admission_no, class_name, session, term, subject, question_count, cbt_score, max_marks, strikes, is_expelled, malpractice_logs, synced_to_ca, completed_at";

// Everything except the bursary: an attempt is a piece of a pupil's academic
// history, and the office that needs it is the one that marks, teaches or sits it.
const READ_SESSIONS: readonly UserRole[] = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "STUDENT_PARENT", "TESTERS"];
// The candidate login files its own sitting, because the sitting happens in the
// family's browser. Staff may file one too, which is what a supervised room does.
const WRITE_SESSIONS: readonly UserRole[] = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "STUDENT_PARENT"];

const MAX_LOGS = 100;
const DESCRIPTION_MAX = 300;
const LOG_TYPES = ["TAB_SWITCH", "FULLSCREEN_EXIT", "SHORTCUT_BLOCKED", "AUDIO_SPIKE", "GAZE_AWAY"] as const;

interface MalpracticeLog {
  type: string;
  severity: "LOW" | "MEDIUM" | "CRITICAL";
  description: string;
  at: string;
}

type SittingPayload = {
  admission_no?: unknown;
  session?: unknown;
  term?: unknown;
  subject?: unknown;
  question_count?: unknown;
  cbt_score?: unknown;
  max_marks?: unknown;
  strikes?: unknown;
  is_expelled?: unknown;
  malpractice_logs?: unknown;
};

/**
 * Sittings on the school's records, newest first.
 *
 * A parent sees only the attempts of the children linked to their login, and the
 * narrowing is done from the guardian table rather than from an admission number
 * the browser typed into the query string.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_SESSIONS);
  if (access.denied) return access.denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  const scope = await guardianScope(access.session);
  if (scope.error) {
    return NextResponse.json(
      { success: false, error: `The guardian link table could not be read: ${scope.error}.`, reason: scope.error },
      { status: 502 }
    );
  }
  if (scope.admissionNos !== null && scope.admissionNos.length === 0) {
    return NextResponse.json(
      { success: false, error: "No pupil is linked to this login yet, so there are no sittings to show. Ask the office to link your child in User Access." },
      { status: 403 }
    );
  }

  let query = supabase.from("cbt_exam_sessions").select(COLUMNS).order("completed_at", { ascending: false });

  if (scope.admissionNos) query = query.in("admission_no", scope.admissionNos);

  const admissionNo = params.get("admission_no")?.trim();
  if (admissionNo) {
    // A parent asking for a number that is not their child gets their own
    // children, not an empty answer that looks like a refusal and not the number.
    if (scope.admissionNos && !scope.admissionNos.some((no) => no.toUpperCase() === admissionNo.toUpperCase())) {
      return NextResponse.json({ success: true, data: [] });
    }
    query = query.eq("admission_no", admissionNo);
  }

  const className = params.get("class_name")?.trim();
  if (className) query = query.eq("class_name", className);

  const session = params.get("session")?.trim();
  if (session) query = query.eq("session", session);

  const term = params.get("term")?.trim();
  if (term) query = query.eq("term", term);

  const limit = Math.min(Math.max(Number(params.get("limit")) || 200, 1), 1000);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE, /cbt_exam_sessions|question_count|admission_no/);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: (data ?? []).map((row) => ({
      ...row,
      malpractice_logs: Array.isArray(row.malpractice_logs) ? row.malpractice_logs : [],
    })),
  });
}

/**
 * Files one finished sitting.
 *
 * The browser sends the score it worked out and the infractions it counted; the
 * pupil, their name, their class and the marks available are all decided here,
 * from the register. That is the difference between a record and a claim: a
 * sitting used to name whoever the machine had cached, which meant a score could
 * be attached to a child who never sat anything.
 *
 * Marking still happens in the browser, so this is a practice figure until a
 * teacher or the exam office files the mark — and it stays true to that: nothing
 * here writes into the CA columns.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_SESSIONS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as SittingPayload;

  const session = typeof sent.session === "string" ? sent.session.trim() : "";
  const term = typeof sent.term === "string" ? sent.term.trim() : "";
  const scopeError = validateScope(session, term);
  if (scopeError) return scopeError;

  const admissionNo = typeof sent.admission_no === "string" ? sent.admission_no.trim() : "";
  if (admissionNo.length < 2) {
    return NextResponse.json(
      { success: false, error: "A sitting needs the admission number of the pupil who sat it, so it can be traced to a real child." },
      { status: 400 }
    );
  }

  const cbtScore = Number(sent.cbt_score);
  const maxMarks = Number(sent.max_marks);
  if (!Number.isFinite(cbtScore) || cbtScore < 0) {
    return NextResponse.json({ success: false, error: `The score “${String(sent.cbt_score)}” is not a number of marks gained.` }, { status: 400 });
  }
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    return NextResponse.json(
      { success: false, error: `The paper has to say how many marks were available; “${String(sent.max_marks)}” is not a figure.` },
      { status: 400 }
    );
  }
  if (cbtScore > maxMarks) {
    return NextResponse.json(
      { success: false, error: `${cbtScore} marks gained is more than the ${maxMarks} the paper was worth. Nothing was filed.` },
      { status: 400 }
    );
  }

  const questionCount = Number(sent.question_count);
  if (!Number.isInteger(questionCount) || questionCount < 0 || questionCount > 2000) {
    return NextResponse.json(
      { success: false, error: `The number of questions on a sitting must be a whole number between 0 and 2000, not “${String(sent.question_count)}”.` },
      { status: 400 }
    );
  }

  const strikes = Number(sent.strikes);
  if (!Number.isInteger(strikes) || strikes < 0 || strikes > MAX_LOGS) {
    return NextResponse.json(
      { success: false, error: `The infraction count must be a whole number between 0 and ${MAX_LOGS}.` },
      { status: 400 }
    );
  }

  const rawLogs = Array.isArray(sent.malpractice_logs) ? sent.malpractice_logs.slice(0, MAX_LOGS) : [];
  const logs: MalpracticeLog[] = [];
  for (const entry of rawLogs) {
    const record = (entry ?? {}) as Partial<MalpracticeLog>;
    const type = typeof record.type === "string" ? record.type.trim() : "";
    if (!(LOG_TYPES as readonly string[]).includes(type)) continue;
    const severity = record.severity === "CRITICAL" || record.severity === "MEDIUM" || record.severity === "LOW"
      ? record.severity
      : "LOW";
    logs.push({
      type,
      severity,
      description: (typeof record.description === "string" ? record.description.trim() : "").slice(0, DESCRIPTION_MAX),
      at: typeof record.at === "string" ? record.at.slice(0, 40) : new Date().toISOString(),
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // Resolved from the register, never taken on faith from the request.
  const { data: pupil, error: pupilError } = await supabase
    .from("students")
    .select("id, full_name, admission_no, class_name")
    .ilike("admission_no", admissionNo)
    .maybeSingle();
  if (pupilError) {
    return NextResponse.json({ success: false, error: pupilError.message }, { status: 502 });
  }
  if (!pupil) {
    return NextResponse.json(
      { success: false, error: `“${admissionNo}” is not a pupil on the school's register, so no sitting can be filed for them.` },
      { status: 404 }
    );
  }

  const scope = await guardianScope(access.session);
  if (scope.error) {
    return NextResponse.json(
      { success: false, error: `The guardian link table could not be read: ${scope.error}.`, reason: scope.error },
      { status: 502 }
    );
  }
  if (scope.admissionNos && !scope.admissionNos.some((no) => no.toUpperCase() === pupil.admission_no.toUpperCase())) {
    return NextResponse.json(
      { success: false, error: `“${pupil.full_name}” is not a pupil linked to this login, so this browser cannot file a sitting for them.` },
      { status: 403 }
    );
  }

  const closed = await closedTermRefusal(supabase, session, term);
  if (closed) return closed;

  const isExpelled = sent.is_expelled === true;
  const row = {
    student_id: pupil.id,
    student_name: pupil.full_name,
    admission_no: pupil.admission_no,
    class_name: pupil.class_name,
    session,
    term,
    subject: (typeof sent.subject === "string" ? sent.subject.trim() : "").slice(0, 255),
    question_count: questionCount,
    cbt_score: Math.round(cbtScore * 100) / 100,
    max_marks: Math.round(maxMarks * 100) / 100,
    strikes: isExpelled ? Math.max(strikes, 3) : strikes,
    is_expelled: isExpelled,
    malpractice_logs: logs,
    // Deliberately false, always: filing a sitting is not filing a mark. The
    // flag is left for the CA entry screen to set when a person moves the figure
    // into the gradebook, so a green tick here would be a promise nobody kept.
    synced_to_ca: false,
  };

  const { data: filed, error } = await supabase
    .from("cbt_exam_sessions")
    .insert(row)
    .select(COLUMNS)
    .single();
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE, /cbt_exam_sessions|question_count|admission_no/);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: { ...filed, malpractice_logs: Array.isArray(filed.malpractice_logs) ? filed.malpractice_logs : [] },
  });
}

/**
 * Removes sittings, for the office clearing a mis-run practice attempt.
 *
 * Only the two roles that set papers may do it: a family cannot make a sitting
 * disappear, which is the reason the record exists.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(["SUPER_ADMIN", "EXAM_OFFICER"]);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { ids?: unknown };
  const ids = (Array.isArray(sent.ids) ? sent.ids : [])
    .map((id) => String(id).trim())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "No sitting on this device is a record on the school's list, so nothing was removed. Reload the page." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("cbt_exam_sessions")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { removed: removed?.length ?? 0 } });
}
