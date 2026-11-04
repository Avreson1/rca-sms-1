import { getSupabaseBrowserClient } from "./client";
import { SCHOOL_INFO } from "../constants";
import {
  StudentRecord,
  StaffRecord,
  InvoiceRecord,
  SubjectScoreRecord,
  TierGradingConfig,
  GradeBracket,
} from "../realtime-store";

// All reads and writes go through the authenticated API routes. The browser no
// longer touches student/staff/invoice tables directly, so the anon key cannot
// be used to read or modify personal data.
//
// A refused or failed request is reported to the on-screen sync notice. Before
// this, every non-2xx became a silent `null` and the dashboard carried on
// showing the browser's own copy as if it were the school's record.

import { reportSyncFailure, reportSyncSaved } from "../sync-status";

async function serverReason(response: Response): Promise<string> {
  const statusText = response.status === 403
    ? "your role is not allowed to do this"
    : response.status === 401
      ? "your session is no longer valid — sign in again"
      : response.status === 503
        ? "the server could not reach the database"
        : `the server replied ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: string; reason?: string };
    // `reason` names the setting that is missing, which is the part an operator
    // can act on; the status text alone only says the database was unreachable.
    const detail = [payload?.error, payload?.reason].filter(Boolean).join(" — ");
    // When the server explained itself, its sentence is the whole message.
    // Appending "your role is not allowed to do this" underneath a parent's
    // "no pupil is linked to this login yet" reads like an accusation.
    return detail || statusText;
  } catch {
    return statusText;
  }
}

async function requestJson<T>(path: string, label: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });

    if (!response.ok) {
      reportSyncFailure(`${label} could not be loaded: ${await serverReason(response)}. Showing this device's copy.`);
      return null;
    }

    const payload = (await response.json()) as { data?: T };
    return payload?.data ?? null;
  } catch (error) {
    console.warn(`API ${path} request failed`, error);
    reportSyncFailure(`${label} could not be loaded: the portal server did not answer. Showing this device's copy.`);
    return null;
  }
}

/** Posts one write and returns why it failed, or null when it landed. */
async function postQuiet(path: string, body: unknown): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) return await serverReason(response);
    return null;
  } catch (error) {
    console.warn(`API ${path} write failed`, error);
    return "the portal server did not answer";
  }
}

async function requestOk(path: string, body: unknown, label: string): Promise<boolean> {
  const reason = await postQuiet(path, body);
  if (reason) {
    reportSyncFailure(`${label} was NOT saved to the school records: ${reason}.`);
    return false;
  }

  reportSyncSaved(`${label} saved to the school records.`);
  return true;
}

/**
 * Onboarding a staff member is the one write whose answer has to reach the
 * screen: the server generates the password, shows it in that single response
 * and never stores it again. A helper that reports only success or failure
 * would leave the form to invent a passcode of its own, which is what it used
 * to do — and the memo it printed then let nobody sign in.
 */
async function postStaffForLogin(
  body: unknown,
  label: string
): Promise<{ login: StaffLogin | null; loginError: string | null }> {
  let reason: string | null = null;
  let login: StaffLogin | null = null;
  let loginError: string | null = null;

  try {
    const response = await fetch("/api/staff", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        login?: StaffLogin | null;
        loginError?: string | null;
      } | null;
      login = payload?.login ?? null;
      loginError = payload?.loginError ?? null;
    } else {
      reason = await serverReason(response);
    }
  } catch (error) {
    console.warn("API /api/staff write failed", error);
    reason = "the portal server did not answer";
  }

  if (reason) {
    reportSyncFailure(`${label} was NOT saved to the school records: ${reason}.`);
    return { login: null, loginError: reason };
  }

  reportSyncSaved(
    login
      ? `${label} saved, and a portal login was created for ${login.username}.`
      : `${label} saved to the school records.`
  );
  return { login, loginError };
}

interface StudentRow {
  id: string;
  admission_no: string;
  full_name: string;
  gender: string | null;
  class_name: string;
  house: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  fee_status: string | null;
}

interface StaffRow {
  id: string;
  staff_id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  assigned_subjects: string[] | null;
  assigned_class: string | null;
  is_form_master: boolean | null;
  email_verified: boolean | null;
  status: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_no: string;
  admission_no: string;
  student_name: string;
  class_name: string;
  amount_billed: number | string | null;
  amount_paid: number | string | null;
  payment_status: string;
  last_payment_date: string | null;
  session: string | null;
  term: string | null;
}

interface GradingTierRow {
  id: string;
  tier_title: string;
  applicable_classes: string[] | null;
  description: string | null;
  brackets: GradeBracket[] | null;
}

function toStudentRow(student: StudentRecord) {
  return {
    admission_no: student.admissionNo,
    full_name: student.fullName,
    gender: student.gender,
    class_name: student.className,
    house: student.house,
    guardian_name: student.guardianName ?? null,
    guardian_phone: student.guardianPhone ?? null,
    fee_status: student.feeStatus,
  };
}

// ============================================================================
// 1. STUDENTS SERVICE
// ============================================================================
export async function fetchStudentsFromSupabase(): Promise<StudentRecord[] | null> {
  const rows = await requestJson<StudentRow[]>("/api/students", "The student list");
  if (!rows) return null;

  return rows.map((item) => {
    return {
      id: item.id,
      admissionNo: item.admission_no,
      fullName: item.full_name,
      gender: (item.gender === "Female" ? "Female" : "Male") as StudentRecord["gender"],
      className: item.class_name,
      house: (item.house || "Sapphire (Blue)") as StudentRecord["house"],
      guardianName: item.guardian_name || undefined,
      guardianPhone: item.guardian_phone || undefined,
      feeStatus: (item.fee_status || "Outstanding") as StudentRecord["feeStatus"],
      // The roll carries no marks. `caScores` is the CA entry grid's buffer, and
      // the only thing that fills it is /api/ca, for one subject at a time.
      caScores: { test1: 0, test2: 0, project: 0, midTerm: 0, exam: 0 },
    };
  });
}

export async function insertStudentToSupabase(student: StudentRecord): Promise<boolean> {
  return requestOk("/api/students", toStudentRow(student), `${student.fullName}'s enrolment`);
}

export async function bulkInsertStudentsToSupabase(students: StudentRecord[]): Promise<boolean> {
  if (students.length === 0) return false;
  return requestOk("/api/students", students.map(toStudentRow), `${students.length} enrolled students`);
}

/**
 * The browser's copy drops a student locally without asking the server, so this
 * is what makes the removal real. Deleting a student also removes their CA
 * scores and invoices in the database (ON DELETE CASCADE).
 */
export async function deleteStudentFromSupabase(admissionNo: string): Promise<boolean> {
  try {
    const response = await fetch("/api/students", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admissionNo }),
    });

    if (!response.ok) {
      reportSyncFailure(`${admissionNo} is still on the school records: ${await serverReason(response)}.`);
      return false;
    }

    reportSyncSaved(`${admissionNo} removed from the school records.`);
    return true;
  } catch (error) {
    console.warn("API /api/students delete failed", error);
    reportSyncFailure(`${admissionNo} was NOT removed from the school records: the portal server did not answer.`);
    return false;
  }
}

// ============================================================================
// 2. STAFF SERVICE
// ============================================================================
export async function fetchStaffFromSupabase(): Promise<StaffRecord[] | null> {
  const rows = await requestJson<StaffRow[]>("/api/staff", "The staff list");
  if (!rows) return null;

  return rows.map((item) => ({
    id: item.id,
    staffId: item.staff_id,
    fullName: item.full_name,
    username: item.username,
    email: item.email,
    phone: item.phone || "08030000000",
    role: item.role,
    assignedSubjects: Array.isArray(item.assigned_subjects) ? item.assigned_subjects : ["General Subjects"],
    assignedClass: item.assigned_class || "Primary 1",
    isFormMaster: Boolean(item.is_form_master),
    emailVerified: Boolean(item.email_verified),
    status: item.status || "Active",
  })) as StaffRecord[];
}

/** The one-time credentials the server hands back when it creates a login. */
export interface StaffLogin {
  username: string;
  password: string;
}

export async function insertStaffToSupabase(
  staff: StaffRecord
): Promise<{ login: StaffLogin | null; loginError: string | null }> {
  return postStaffForLogin({
    staff_id: staff.staffId,
    full_name: staff.fullName,
    username: staff.username,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    assigned_subjects: staff.assignedSubjects,
    assigned_class: staff.assignedClass,
    is_form_master: staff.isFormMaster,
    email_verified: staff.emailVerified,
    status: staff.status,
  }, `${staff.fullName}'s staff record`);
}

// ============================================================================
// 3. INVOICES SERVICE
// ============================================================================
export async function fetchInvoicesFromSupabase(): Promise<InvoiceRecord[] | null> {
  const rows = await requestJson<InvoiceRow[]>("/api/invoices", "The fees and invoices list");
  if (!rows) return null;

  return rows.map((inv) => ({
    id: inv.id,
    invoiceNo: inv.invoice_no,
    admissionNo: inv.admission_no,
    studentName: inv.student_name,
    className: inv.class_name,
    amountBilled: Number(inv.amount_billed) || 0,
    amountPaid: Number(inv.amount_paid) || 0,
    paymentStatus: inv.payment_status as "Paid" | "Partial" | "Unpaid",
    lastPaymentDate: inv.last_payment_date || new Date().toISOString().split("T")[0],
    session: inv.session || undefined,
    term: inv.term || undefined,
  }));
}

function toInvoiceRow(invoice: InvoiceRecord) {
  return {
    invoice_no: invoice.invoiceNo,
    admission_no: invoice.admissionNo,
    student_name: invoice.studentName,
    class_name: invoice.className,
    session: invoice.session || SCHOOL_INFO.currentSession,
    term: invoice.term || SCHOOL_INFO.currentTerm,
    amount_billed: invoice.amountBilled,
    amount_paid: invoice.amountPaid,
    payment_status: invoice.paymentStatus,
    last_payment_date: invoice.lastPaymentDate || null,
  };
}

/**
 * Saves one invoice, or the payment recorded against it. The server resolves
 * the student from the admission number, so a fee recorded here is the school's
 * record of that fee and not just this device's.
 */
export async function saveInvoiceToSupabase(invoice: InvoiceRecord): Promise<boolean> {
  return requestOk("/api/invoices", toInvoiceRow(invoice), `the invoice for ${invoice.studentName}`);
}

export async function bulkSaveInvoicesToSupabase(invoices: InvoiceRecord[]): Promise<boolean> {
  if (invoices.length === 0) return false;
  return requestOk("/api/invoices", invoices.map(toInvoiceRow), `${invoices.length} invoices`);
}

// ============================================================================
// 5. CONTINUOUS ASSESSMENT SCORES
// ============================================================================

interface CaReadRow {
  student_id: string;
  admission_no: string;
  full_name: string;
  class_name: string;
  subject: string;
  session: string;
  term: string;
  test1: number | string | null;
  test2: number | string | null;
  project: number | string | null;
  mid_term: number | string | null;
  exam: number | string | null;
  total_score: number | string | null;
  tier_grade: string | null;
  remark: string | null;
  updated_at: string | null;
}

/**
 * Reads the marks filed on the school's own tables for one session and term.
 *
 * A report card built from `saveSubjectScore` alone only ever held the marks
 * typed into that browser, which is why the same pupil showed a full card in
 * the staff room and an empty one in the office.
 */
export async function fetchCaScoresFromSupabase(options: {
  session: string;
  terms: string[];
  className?: string;
}): Promise<SubjectScoreRecord[] | null> {
  const params = new URLSearchParams({ session: options.session, term: options.terms.join(",") });
  if (options.className) params.set("class_name", options.className);

  const rows = await requestJson<CaReadRow[]>(`/api/ca?${params.toString()}`, "The filed marks");
  if (!rows) return null;

  return rows.map((row) => {
    const components = {
      test1: Number(row.test1) || 0,
      test2: Number(row.test2) || 0,
      project: Number(row.project) || 0,
      midTerm: Number(row.mid_term) || 0,
      exam: Number(row.exam) || 0,
    };
    const total =
      Number.isFinite(Number(row.total_score)) && Number(row.total_score) > 0
        ? Number(row.total_score)
        : components.test1 + components.test2 + components.project + components.midTerm + components.exam;

    return {
      id: `${row.student_id}|${row.subject}|${row.session}|${row.term}`,
      studentId: row.student_id,
      admissionNo: row.admission_no,
      subjectName: row.subject,
      className: row.class_name,
      session: row.session,
      term: row.term as SubjectScoreRecord["term"],
      ...components,
      total,
      grade: row.tier_grade || "",
      remark: row.remark || "",
      updatedAt: row.updated_at || undefined,
    };
  });
}

/**
 * `/api/ca` files one student's scores for a session and term, so records for
 * different pupils are sent as separate requests. The subject name is required
 * by the database; a score entered without picking a subject cannot be saved.
 */
export async function saveCaScoresToSupabase(
  records: {
    admissionNo: string;
    subject: string;
    session: string;
    term: string;
    test1: number;
    test2: number;
    project: number;
    midTerm: number;
    exam: number;
    total: number;
    grade: string;
    remark?: string;
  }[],
  summary: string
): Promise<boolean> {
  const grouped = new Map<string, typeof records>();
  for (const record of records) {
    const key = `${record.admissionNo}|${record.session}|${record.term}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(record);
    else grouped.set(key, [record]);
  }

  // One request per pupil because /api/ca files a pupil's subjects for one
  // session and term, so the notice reports the whole batch rather than the
  // last pupil in it.
  const failures: string[] = [];
  for (const [, entries] of grouped) {
    const first = entries[0];
    const reason = await postQuiet("/api/ca", {
      admissionNo: first.admissionNo,
      session: first.session,
      term: first.term,
      scores: entries.map((entry) => ({
        subject: entry.subject,
        test1: entry.test1,
        test2: entry.test2,
        project: entry.project,
        midTerm: entry.midTerm,
        exam: entry.exam,
        grade: entry.grade,
        remark: entry.remark,
      })),
    });
    if (reason) failures.push(`${first.admissionNo}: ${reason}`);
  }

  if (failures.length > 0) {
    reportSyncFailure(
      `${summary} were NOT saved to the school records — ${failures.length} of ${grouped.size} pupils refused (${failures[0]}).`
    );
    return false;
  }

  reportSyncSaved(`${summary} saved to the school records.`);
  return true;
}

// ============================================================================
// 6. GRADING TIERS SERVICE (reference data — public read allowed by RLS)
// ============================================================================
export async function fetchGradingTiersFromSupabase(): Promise<Record<string, TierGradingConfig> | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("grading_tiers").select("*");
  if (error || !data || data.length === 0) return null;

  const map: Record<string, TierGradingConfig> = {};
  for (const row of data as GradingTierRow[]) {
    map[row.id] = {
      tierKey: row.id as TierGradingConfig["tierKey"],
      tierTitle: row.tier_title,
      applicableClasses: row.applicable_classes || [],
      description: row.description || "",
      brackets: row.brackets || [],
    };
  }

  return map;
}
