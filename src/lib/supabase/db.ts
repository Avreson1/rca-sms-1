import {
  StudentRecord,
  StaffRecord,
  InvoiceRecord,
  FeeComponentRecord,
  SubjectScoreRecord,
  TierGradingConfig,
  PsychomotorRecord,
  TraitConfigItem,
  ClassArmRecord,
  SubjectRecord,
  SubjectTemplateRecord,
  CBTQuestionRecord,
  CBTConfigRecord,
  CBTSittingRecord,
  CalendarEventRecord,
  ActivityTemplateRecord,
  CAComponentItem,
  CATierKey,
  NewsletterRecord,
  ReportTheme,
} from "../realtime-store";
import { DEFAULT_TIMETABLE_DAYS, DEFAULT_TIMETABLE_PERIODS, type TimetablePeriod } from "../timetable/day-shape";
import {
  ID_CARD_LAYOUTS,
  ID_CARD_THEMES,
  type IdCardHolderType,
  type IdCardInput,
  type IdCardRecord,
} from "../id-cards";

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
  designation: string | null;
  standing_duties: string[] | null;
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

/**
 * Updates a student record on the server and synchronizes changes across
 * identity cards and invoices.
 */
export async function updateStudentOnServer(
  studentIdOrAdmissionNo: string,
  updates: Partial<StudentRecord>
): Promise<{ ok: boolean; reason: string | null; student?: StudentRecord }> {
  try {
    const payload: Record<string, unknown> = {};
    if (updates.fullName !== undefined) payload.fullName = updates.fullName;
    if (updates.admissionNo !== undefined) payload.admissionNo = updates.admissionNo;
    if (updates.className !== undefined) payload.className = updates.className;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.house !== undefined) payload.house = updates.house;
    if (updates.guardianName !== undefined) payload.guardianName = updates.guardianName;
    if (updates.guardianPhone !== undefined) payload.guardianPhone = updates.guardianPhone;
    if (updates.feeStatus !== undefined) payload.feeStatus = updates.feeStatus;
    if (updates.dateOfBirth !== undefined) payload.dateOfBirth = updates.dateOfBirth;
    if (updates.bloodGroup !== undefined) payload.bloodGroup = updates.bloodGroup;
    if (updates.guardianEmail !== undefined) payload.guardianEmail = updates.guardianEmail;
    if (updates.guardianAddress !== undefined) payload.guardianAddress = updates.guardianAddress;
    if (updates.guardianRelationship !== undefined) payload.guardianRelationship = updates.guardianRelationship;
    if (updates.medicalNotes !== undefined) payload.medicalNotes = updates.medicalNotes;
    if (updates.allergies !== undefined) payload.allergies = updates.allergies;
    if (updates.nationality !== undefined) payload.nationality = updates.nationality;
    if (updates.stateOfOrigin !== undefined) payload.stateOfOrigin = updates.stateOfOrigin;
    if (updates.lga !== undefined) payload.lga = updates.lga;
    if (updates.religion !== undefined) payload.religion = updates.religion;

    const targetUrl = `/api/students/${encodeURIComponent(studentIdOrAdmissionNo)}`;
    const response = await fetch(targetUrl, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      data?: StudentRecord;
    } | null;

    if (!response.ok || !result?.success) {
      const reason = result?.error || (await serverReason(response)) || "Failed to update student";
      reportSyncFailure(`Could not update student: ${reason}`);
      return { ok: false, reason };
    }

    reportSyncSaved(`Student record updated on school database.`);
    return { ok: true, reason: null, student: result.data };
  } catch (error) {
    console.warn("API /api/students/[id] patch failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`Could not update student: ${reason}`);
    return { ok: false, reason };
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
    // Absent until supabase/staff_duties.sql is run, and empty after it is run and
    // nobody has filled it in. Both print as "the register does not say", never as
    // a job title invented from the access tier.
    designation: item.designation || "",
    standingDuties: Array.isArray(item.standing_duties) ? item.standing_duties : [],
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
    designation: staff.designation ?? "",
    standing_duties: staff.standingDuties ?? [],
  }, `${staff.fullName}'s staff record`);
}

/**
 * Removes a staff record from the school's records.
 *
 * The register used to filter this browser's list, which looked like a
 * removal until the page was reloaded and the member was back — with their
 * login still working. The server answers with a warning when it took the
 * record but could not suspend the login, and that has to reach the office.
 */
export async function deleteStaffFromSupabase(
  staffId: string
): Promise<{ ok: boolean; reason: string | null; warning: string | null }> {
  try {
    const response = await fetch("/api/staff", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId }),
    });

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      data?: { loginSuspended?: boolean; loginWarning?: string };
    } | null;

    if (!response.ok || !payload?.success) {
      const reason = await serverReason(response);
      reportSyncFailure(`The staff member was NOT removed from the school records: ${reason}.`);
      return { ok: false, reason, warning: null };
    }

    const warning = payload.data?.loginWarning ?? null;
    reportSyncSaved(
      payload.data?.loginSuspended
        ? "Staff record removed from the school records and its login suspended."
        : "Staff record removed from the school records."
    );
    return { ok: true, reason: null, warning };
  } catch (error) {
    console.warn("API /api/staff delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The staff member was NOT removed from the school records: ${reason}.`);
    return { ok: false, reason, warning: null };
  }
}

/**
 * Updates a staff record on the server and synchronizes login display names,
 * staff duties roster, and active identity cards.
 */
export async function updateStaffOnServer(
  staffIdOrId: string,
  updates: Partial<StaffRecord>
): Promise<{ ok: boolean; reason: string | null; staff?: StaffRecord }> {
  try {
    const payload: Record<string, unknown> = {};
    if (updates.fullName !== undefined) payload.fullName = updates.fullName;
    if (updates.staffId !== undefined) payload.staffId = updates.staffId;
    if (updates.username !== undefined) payload.username = updates.username;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.assignedSubjects !== undefined) payload.assignedSubjects = updates.assignedSubjects;
    if (updates.assignedClass !== undefined) payload.assignedClass = updates.assignedClass;
    if (updates.isFormMaster !== undefined) payload.isFormMaster = updates.isFormMaster;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.designation !== undefined) payload.designation = updates.designation;
    if (updates.standingDuties !== undefined) payload.standingDuties = updates.standingDuties;
    if (updates.staffType !== undefined) payload.staffType = updates.staffType;
    if (updates.qualifications !== undefined) payload.qualifications = updates.qualifications;
    if (updates.bankName !== undefined) payload.bankName = updates.bankName;
    if (updates.accountNumber !== undefined) payload.accountNumber = updates.accountNumber;
    if (updates.accountName !== undefined) payload.accountName = updates.accountName;
    if (updates.salaryGrade !== undefined) payload.salaryGrade = updates.salaryGrade;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.emergencyContactName !== undefined) payload.emergencyContactName = updates.emergencyContactName;
    if (updates.emergencyContactPhone !== undefined) payload.emergencyContactPhone = updates.emergencyContactPhone;
    if (updates.dateOfBirth !== undefined) payload.dateOfBirth = updates.dateOfBirth;
    if (updates.employmentDate !== undefined) payload.employmentDate = updates.employmentDate;

    const targetUrl = `/api/staff/${encodeURIComponent(staffIdOrId)}`;
    const response = await fetch(targetUrl, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      data?: StaffRecord;
    } | null;

    if (!response.ok || !result?.success) {
      const reason = result?.error || (await serverReason(response)) || "Failed to update staff member";
      reportSyncFailure(`Could not update staff: ${reason}`);
      return { ok: false, reason };
    }

    reportSyncSaved(`Staff record updated on school database.`);
    return { ok: true, reason: null, staff: result.data };
  } catch (error) {
    console.warn("API /api/staff/[id] patch failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`Could not update staff: ${reason}`);
    return { ok: false, reason };
  }
}

export interface BulkStaffResult {
  saved: number;
  /** The one-time credentials the server issued, named so the slip can be read out. */
  logins: (StaffLogin & { fullName: string })[];
  failures: string[];
}

/**
 * Files a CSV import on the server, one member at a time.
 *
 * The import used to write straight into this browser's list and announce every
 * row as onboarded, so none of them reached the school's records and no login
 * was ever issued. Going one at a time is what lets the answer name the people
 * who were refused — a duplicate username in a 40-row file is not something the
 * office can find by eye.
 */
export async function bulkInsertStaffOnServer(members: StaffRecord[]): Promise<BulkStaffResult> {
  const result: BulkStaffResult = { saved: 0, logins: [], failures: [] };

  for (const member of members) {
    const row = {
      staff_id: member.staffId,
      full_name: member.fullName,
      username: member.username,
      email: member.email,
      phone: member.phone,
      role: member.role,
      assigned_subjects: member.assignedSubjects,
      assigned_class: member.assignedClass,
      is_form_master: member.isFormMaster,
      email_verified: member.emailVerified,
      status: member.status,
      designation: member.designation ?? "",
      standing_duties: member.standingDuties ?? [],
    };

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        login?: StaffLogin | null;
        loginError?: string | null;
      } | null;

      if (response.ok && payload?.success) {
        result.saved += 1;
        if (payload.login) result.logins.push({ ...payload.login, fullName: member.fullName });
        if (payload.loginError) result.failures.push(`${member.fullName}: ${payload.loginError}`);
      } else {
        result.failures.push(`${member.fullName}: ${await serverReason(response)}`);
      }
    } catch {
      result.failures.push(`${member.fullName}: the portal server did not answer`);
    }
  }

  return result;
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
    // Left empty rather than guessed at: the server files an undated invoice
    // under the session and term the school says it is in, instead of the term
    // this device last managed to load.
    session: invoice.session?.trim() || null,
    term: invoice.term?.trim() || null,
    amount_billed: invoice.amountBilled,
    amount_paid: invoice.amountPaid,
    payment_status: invoice.paymentStatus,
    last_payment_date: invoice.lastPaymentDate || null,
  };
}

/**
 * Files a run of generated invoices.
 *
 * Returns the reason the school's records said no, or null when they were
 * filed. A term's worth of bills is the one import where "it worked on my
 * browser" is not an acceptable answer: the bursar has to know whether the
 * amounts went out or stayed on the machine.
 */
export async function bulkSaveInvoicesToSupabase(invoices: InvoiceRecord[]): Promise<string | null> {
  if (invoices.length === 0) return "no invoice was generated";

  const reason = await postQuiet("/api/invoices", invoices.map(toInvoiceRow));
  if (reason) {
    reportSyncFailure(`${invoices.length} invoices were NOT filed on the school's records: ${reason}.`);
    return reason;
  }

  reportSyncSaved(`${invoices.length} invoices filed on the school's records.`);
  return null;
}

// ============================================================================
// 4. PAYMENT RECEIPTS
// ============================================================================

export interface ReceiptDetails {
  ref: string;
  amount: number;
  channel: string;
  bankReference: string;
  receivedBy: string;
  issuedAt: string;
}

export interface FiledPayment {
  receipt: ReceiptDetails | null;
  invoice: {
    id: string;
    amountPaid: number;
    amountBilled: number;
    paymentStatus: string;
    lastPaymentDate: string;
  };
}

/**
 * Takes a payment on the school's records: one call files the receipt and moves
 * the balance, and the receipt number comes back to be printed for the family.
 */
export async function recordPaymentOnServer(input: {
  invoiceNo: string;
  amount: number;
  paymentChannel: string;
  bankReference: string;
}): Promise<{ ok: boolean; filed: FiledPayment | null; reason: string | null }> {
  try {
    const response = await fetch("/api/payments", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_no: input.invoiceNo,
        amount: input.amount,
        payment_channel: input.paymentChannel,
        bank_reference: input.bankReference,
      }),
    });

    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The payment of ₦${input.amount.toLocaleString()} was NOT filed: ${reason}.`);
      return { ok: false, filed: null, reason };
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: {
        receipt?: {
          ref?: string;
          amount?: number | string;
          payment_channel?: string;
          bank_reference?: string;
          received_by?: string;
          created_at?: string;
        } | null;
        invoice?: {
          id?: string;
          amount_paid?: number | string;
          amount_billed?: number | string;
          payment_status?: string;
          last_payment_date?: string;
        };
      };
    } | null;

    const invoice = payload?.data?.invoice;
    if (!invoice?.id) {
      const reason = "the server accepted the payment but sent no updated balance back";
      reportSyncFailure(`The payment of ₦${input.amount.toLocaleString()} is not shown as received: ${reason}.`);
      return { ok: false, filed: null, reason };
    }

    const receipt = payload?.data?.receipt;
    reportSyncSaved(
      receipt?.ref
        ? `Payment filed and receipt ${receipt.ref} issued.`
        : "Payment filed on the school's records."
    );

    return {
      ok: true,
      filed: {
        receipt: receipt
          ? {
              ref: receipt.ref ?? "",
              amount: Number(receipt.amount) || input.amount,
              channel: receipt.payment_channel ?? input.paymentChannel,
              bankReference: receipt.bank_reference ?? input.bankReference,
              receivedBy: receipt.received_by ?? "",
              issuedAt: receipt.created_at ?? new Date().toISOString(),
            }
          : null,
        invoice: {
          id: invoice.id,
          amountPaid: Number(invoice.amount_paid) || 0,
          amountBilled: Number(invoice.amount_billed) || 0,
          paymentStatus: invoice.payment_status ?? "Partial",
          lastPaymentDate: invoice.last_payment_date ?? "",
        },
      },
      reason: null,
    };
  } catch (error) {
    console.warn("API /api/payments write failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The payment of ₦${input.amount.toLocaleString()} was NOT filed: ${reason}.`);
    return { ok: false, filed: null, reason };
  }
}

interface ReceiptRow {
  ref: string;
  amount: number | string | null;
  payment_channel: string | null;
  fee_type: string | null;
  bank_reference: string | null;
  received_by: string | null;
  created_at: string | null;
  status: string | null;
  session: string | null;
  term: string | null;
  admission_no: string | null;
  student_name: string | null;
  invoices: { invoice_no: string | null; class_name: string | null } | null;
}

/**
 * One payment as the school filed it: the receipt number it issued, the money it
 * took, and who signed for it.
 */
export interface FiledReceipt {
  invoiceNo: string;
  feeType: string;
  studentName: string;
  admissionNo: string;
  className: string;
  status: string;
  session: string;
  term: string;
  receipt: ReceiptDetails;
}

function toFiledReceipt(row: ReceiptRow): FiledReceipt {
  return {
    invoiceNo: row.invoices?.invoice_no ?? "",
    feeType: row.fee_type ?? "",
    studentName: row.student_name ?? "",
    admissionNo: row.admission_no ?? "",
    className: row.invoices?.class_name ?? "",
    status: row.status ?? "",
    session: row.session ?? "",
    term: row.term ?? "",
    receipt: {
      ref: row.ref,
      amount: Number(row.amount) || 0,
      channel: row.payment_channel ?? "",
      bankReference: row.bank_reference ?? "",
      receivedBy: row.received_by ?? "",
      issuedAt: row.created_at ?? "",
    },
  };
}

async function readReceipts(query: string): Promise<{ receipts: FiledReceipt[]; reason: string | null }> {
  try {
    const response = await fetch(`/api/payments?${query}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) return { receipts: [], reason: await serverReason(response) };

    const payload = (await response.json().catch(() => null)) as { data?: ReceiptRow[] } | null;
    return { receipts: (payload?.data ?? []).map(toFiledReceipt), reason: null };
  } catch (error) {
    console.warn("API /api/payments read failed", error);
    return { receipts: [], reason: "the portal server did not answer" };
  }
}

/**
 * Receipts already filed for one pupil, newest first.
 *
 * A family that lost its slip and a bursary checking what it handed out both
 * need the number the server issued, so a reprint shows what was actually
 * received rather than a slip rebuilt on the spot.
 */
export function fetchFiledReceipts(admissionNo: string) {
  return readReceipts(`admission_no=${encodeURIComponent(admissionNo)}`);
}

/**
 * The bursary ledger for one session and term.
 *
 * Every row is a payment somebody filed; nothing here is derived from an
 * invoice's balance, which is how the old version of this screen came to
 * "confirm" money that was never received.
 */
export function fetchReceiptLedger(scope: { session?: string; term?: string } = {}) {
  const params = new URLSearchParams();
  if (scope.session) params.set("session", scope.session);
  if (scope.term) params.set("term", scope.term);
  return readReceipts(params.toString());
}

// ============================================================================
// 4A. THE FEE SCHEDULE
// ============================================================================
// The amounts typed here used to live only in this browser, while the total
// they add up to was written into the invoices table and sent to families. The
// schedule an invoice was priced from has to be on the school's records too, or
// no printed bill can be checked by anybody who did not type it.

interface FeeComponentRow {
  id: string;
  name: string;
  category: string;
  applicable_class: string;
  amount: number | string | null;
  is_mandatory: boolean | null;
  session: string | null;
  term: string | null;
}

function toFeeRecord(row: FeeComponentRow): FeeComponentRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category as FeeComponentRecord["category"],
    applicableClass: row.applicable_class,
    amount: Number(row.amount) || 0,
    isMandatory: row.is_mandatory !== false,
    session: row.session ?? undefined,
    term: row.term ?? undefined,
  };
}

export async function fetchFeeComponentsFromSupabase(): Promise<FeeComponentRecord[] | null> {
  const rows = await requestJson<FeeComponentRow[]>("/api/fees", "The fee schedule");
  if (!rows) return null;
  return rows.map(toFeeRecord);
}

/**
 * Files fee components on the school's schedule.
 *
 * The server answers with the rows as it stored them, including the session and
 * term it filed them under — which is the school's current term, not whatever
 * term this device last happened to load.
 */
export async function saveFeeComponentsOnServer(
  components: FeeComponentRecord[]
): Promise<{ saved: FeeComponentRecord[]; reason: string | null }> {
  try {
    const response = await fetch("/api/fees", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        components.map((fee) => ({
          name: fee.name,
          category: fee.category,
          applicable_class: fee.applicableClass,
          amount: fee.amount,
          is_mandatory: fee.isMandatory,
        }))
      ),
    });

    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The fee schedule was NOT saved to the school records: ${reason}.`);
      return { saved: [], reason };
    }

    const payload = (await response.json().catch(() => null)) as { data?: FeeComponentRow[] } | null;
    const saved = (payload?.data ?? []).map(toFeeRecord);
    reportSyncSaved(`${saved.length} fee item${saved.length === 1 ? "" : "s"} saved to the school's schedule.`);
    return { saved, reason: null };
  } catch (error) {
    console.warn("API /api/fees write failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The fee schedule was NOT saved to the school records: ${reason}.`);
    return { saved: [], reason };
  }
}

/** Removes one item from the school's schedule, and says why if it could not. */
export async function removeFeeComponentOnServer(id: string): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/fees", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });

    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The fee item was NOT removed from the school's schedule: ${reason}.`);
      return { ok: false, reason };
    }

    reportSyncSaved("Fee item removed from the school's schedule. Invoices already printed keep the amount they went out with.");
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/fees delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The fee item was NOT removed from the school's schedule: ${reason}.`);
    return { ok: false, reason };
  }
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
// 6. GRADING TIERS SERVICE
// ============================================================================

/**
 * The scales come from /api/grading-tiers like everything else. Reading the
 * table with the browser's anon key meant a school whose live tiers had drifted
 * from the seeded ones was graded one way on screen and another way on the
 * server that filed the mark.
 */
export async function fetchGradingTiersFromSupabase(): Promise<Record<string, TierGradingConfig> | null> {
  const tiers = await requestJson<Record<string, TierGradingConfig>>("/api/grading-tiers", "The grading scales");
  if (!tiers || Object.keys(tiers).length === 0) return null;
  return tiers;
}

/** Saves the scales the office edited, so they are still there after a reload. */
export async function saveGradingTiersToSupabase(
  tiers: Record<string, TierGradingConfig>,
  summary: string
): Promise<boolean> {
  return requestOk("/api/grading-tiers", { tiers }, summary);
}

// ============================================================================
// 7. SCHOOL SETTINGS, TERM CLOSURE AND RESULT PUBLICATION
//
// These three read/write pairs back the screens that used to be a performance:
// the school's session and term, which terms have been signed off, and which
// classes have had results released. A page that prints "Published!" or
// "archived!" has to have been told by the server that the row landed, so every
// helper here hands the reason for a failure back to the caller instead of
// swallowing it — the notice bar alone is not enough when a button's label is
// the claim.
// ============================================================================

/** Reads a list and keeps "empty" apart from "could not read". */
async function readList<T>(path: string): Promise<{ rows: T[] | null; reason: string | null }> {
  try {
    const response = await fetch(path, { cache: "no-store", headers: { "Content-Type": "application/json" } });
    if (!response.ok) return { rows: null, reason: await serverReason(response) };
    const payload = (await response.json()) as { data?: T[] };
    return { rows: Array.isArray(payload?.data) ? payload.data : [], reason: null };
  } catch (error) {
    console.warn(`API ${path} read failed`, error);
    return { rows: null, reason: "the portal server did not answer" };
  }
}

/** One write, returning the server's own sentence when it was refused. */
async function writeOnce(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch(path, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, reason: await serverReason(response) };
    return { ok: true, reason: null };
  } catch (error) {
    console.warn(`API ${path} write failed`, error);
    return { ok: false, reason: "the portal server did not answer" };
  }
}

export interface SchoolConfigRow {
  school_name: string;
  short_name: string;
  motto: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  current_session: string;
  current_term: string;
  primary_signatory_name?: string;
  primary_signatory_title?: string;
  primary_signature_url?: string;
  secondary_signatory_name?: string;
  secondary_signatory_title?: string;
  secondary_signature_url?: string;
  auth_footer_note?: string;
  updated_by?: string;
  updated_at?: string;
}

/**
 * The school's own words for which session and term it is in. Returning null
 * means it was not read: callers keep the values compiled into the portal rather
 * than showing an empty term, which every mark would then fail to match.
 */
export async function fetchSchoolConfigFromSupabase(): Promise<SchoolConfigRow | null> {
  const { rows, reason } = await readList<SchoolConfigRow>("/api/school-config");
  if (reason) {
    reportSyncFailure(`The school's session and term could not be loaded: ${reason}.`);
    return null;
  }
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function saveSchoolConfigToSupabase(
  config: SchoolConfigRow
): Promise<{ ok: boolean; reason: string | null }> {
  return writeOnce("/api/school-config", "PUT", config);
}

export interface ClosedTermRow {
  session: string;
  term: string;
  closed_by: string;
  closed_at: string;
}

/** Every term the office has signed off, most recent first. */
export async function fetchClosedTermsFromSupabase(): Promise<{ rows: ClosedTermRow[] | null; reason: string | null }> {
  return readList<ClosedTermRow>("/api/term-closings");
}

export async function closeTermOnServer(
  session: string,
  term: string
): Promise<{ ok: boolean; reason: string | null }> {
  return writeOnce("/api/term-closings", "POST", { session, term });
}

export async function reopenTermOnServer(
  session: string,
  term: string
): Promise<{ ok: boolean; reason: string | null }> {
  return writeOnce("/api/term-closings", "DELETE", { session, term });
}

export interface PublicationRow {
  session: string;
  term: string;
  class_name: string;
  published_by: string;
  published_at: string;
}

/** Which classes are released for one session and term. */
export async function fetchPublicationsFromSupabase(
  session: string,
  term: string
): Promise<{ rows: PublicationRow[] | null; reason: string | null }> {
  return readList<PublicationRow>(
    `/api/result-publications?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`
  );
}

/** Releases or withdraws a set of classes; the page only claims what the server confirms. */
export async function setPublicationsOnServer(
  session: string,
  term: string,
  classes: string[],
  published: boolean
): Promise<{ ok: boolean; reason: string | null }> {
  return writeOnce("/api/result-publications", "POST", { session, term, classes, published });
}

// ============================================================================
// 10. CHARACTER, PSYCHOMOTOR AND ATTENDANCE ASSESSMENTS
// ============================================================================

interface TraitsConfigPayload {
  traits: TraitConfigItem[] | null;
  configured?: boolean;
}

/**
 * The school's rubric of rated traits.
 *
 * null means the read failed or was refused, and the caller keeps this device's
 * copy — which the on-screen sync notice has already labelled as such. An empty
 * array is a real answer: the office has cleared the list. A school whose
 * migration stopped short of the seed row is neither: it has no list at all, so
 * this says so and keeps the device's own copy rather than printing an empty
 * grid of traits under every child's name.
 */
export async function fetchTraitsConfigFromSupabase(): Promise<TraitConfigItem[] | null> {
  const payload = await requestJson<TraitsConfigPayload>("/api/traits-config", "The trait list");
  if (payload && payload.configured === false) {
    reportSyncFailure(
      "The school's records have no trait list yet. Run supabase/traits_assessments.sql, or save the list from Setup → Traits to put this one on the school's records."
    );
    return null;
  }
  return Array.isArray(payload?.traits) ? payload.traits : null;
}

export async function saveTraitsConfigOnServer(
  traits: TraitConfigItem[]
): Promise<{ ok: boolean; reason: string | null }> {
  const result = await writeOnce("/api/traits-config", "POST", { traits });
  if (result.ok) reportSyncSaved("The trait list was saved to the school records.");
  else reportSyncFailure(`The trait list was NOT saved to the school records: ${result.reason}.`);
  return result;
}

/** One `traits_assessments` row with its pupil attached. */
interface AssessmentRow {
  id: string;
  studentId: string;
  admissionNo: string;
  studentName: string;
  className: string;
  session: string;
  term: PsychomotorRecord["term"];
  affectiveRatings: Record<string, number>;
  psychomotorRatings: Record<string, number>;
  attendance: PsychomotorRecord["attendance"];
  formTeacherRemark: string;
  principalRemark: string;
  nextTermBegins: string;
  promotedTo?: string;
  updatedAt?: string;
}

/**
 * Reads the behaviour, skills, attendance and remarks the school has actually
 * filed for one session and term.
 *
 * Without this the report card was half a document: the marks came off the
 * database and the ratings came from whichever browser had typed them, so a parent
 * opening the portal on their phone saw a card that said their child had never been
 * assessed while the form teacher's laptop said otherwise.
 */
export async function fetchAssessmentsFromSupabase(options: {
  session: string;
  terms: string[];
  className?: string;
}): Promise<PsychomotorRecord[] | null> {
  const params = new URLSearchParams({ session: options.session, term: options.terms.join(",") });
  if (options.className) params.set("class_name", options.className);

  const rows = await requestJson<AssessmentRow[]>(`/api/traits?${params.toString()}`, "The character assessments");
  if (!rows) return null;

  // The route already answers in the client's own shape; the copy is deliberate
  // rather than a spread of the row, so a column the server adds cannot leak into
  // what the card prints.
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    admissionNo: row.admissionNo,
    className: row.className,
    session: row.session,
    term: row.term,
    affectiveRatings: row.affectiveRatings ?? {},
    psychomotorRatings: row.psychomotorRatings ?? {},
    attendance: {
      daysOpened: Number(row.attendance?.daysOpened) || 0,
      daysPresent: Number(row.attendance?.daysPresent) || 0,
      daysAbsent: Number(row.attendance?.daysAbsent) || 0,
    },
    formTeacherRemark: row.formTeacherRemark ?? "",
    principalRemark: row.principalRemark ?? "",
    nextTermBegins: row.nextTermBegins ?? "",
    promotedTo: row.promotedTo || undefined,
    updatedAt: row.updatedAt || undefined,
  }));
}

/**
 * Files one pupil's assessment. `/api/traits` writes one child per request, so
 * these are sent one at a time and the notice can name the child it failed on.
 */
export async function saveAssessmentOnServer(
  record: Pick<
    PsychomotorRecord,
    | "admissionNo"
    | "session"
    | "term"
    | "affectiveRatings"
    | "psychomotorRatings"
    | "attendance"
    | "formTeacherRemark"
    | "principalRemark"
    | "nextTermBegins"
    | "promotedTo"
  >
): Promise<{ ok: boolean; reason: string | null }> {
  return writeOnce("/api/traits", "POST", {
    admissionNo: record.admissionNo,
    session: record.session,
    term: record.term,
    affectiveRatings: record.affectiveRatings,
    psychomotorRatings: record.psychomotorRatings,
    attendance: { daysOpened: record.attendance.daysOpened, daysPresent: record.attendance.daysPresent },
    formTeacherRemark: record.formTeacherRemark,
    principalRemark: record.principalRemark,
    nextTermBegins: record.nextTermBegins,
    promotedTo: record.promotedTo ?? "",
  });
}


// ============================================================================
// 11. INVENTORY: THE STORES REGISTER AND ITS MOVEMENT LOG
//
// Nothing here is kept on this device. An inventory list that lives in one
// browser's localStorage is a rumour about the school's property: the person
// standing in the store with a clipboard has no way to check it, and clearing
// that machine loses the only copy of what was bought. So every read goes to
// /api/inventory and every write goes through it, and a failed read is shown as
// a failed read rather than as an empty store.
// ============================================================================

export interface InventoryItem {
  id: string;
  asset_ref: string | null;
  item_name: string;
  category: string;
  unit: string;
  opening_quantity: number;
  quantity_in: number;
  quantity_out: number;
  quantity_on_hand: number;
  location: string;
  custodian: string;
  condition: string;
  acquired_on: string | null;
  purchase_value: string | number | null;
  reorder_level: number | null;
  notes: string;
  created_by: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  direction: "in" | "out";
  quantity: number;
  party: string;
  purpose: string;
  moved_on: string;
  recorded_by: string;
  inventory_items: { item_name: string } | null;
}

/** The register. `rows: null` means it could not be read — which is not the same as an empty store. */
export function fetchInventoryRegister(scope: { category?: string; location?: string; q?: string } = {}) {
  const params = new URLSearchParams();
  if (scope.category) params.set("category", scope.category);
  if (scope.location) params.set("location", scope.location);
  if (scope.q) params.set("q", scope.q);
  return readList<InventoryItem>(`/api/inventory${params.toString() ? `?${params}` : ""}`);
}

export function fetchInventoryMovements(itemId?: string) {
  return readList<InventoryMovement>(`/api/inventory/movements${itemId ? `?item_id=${encodeURIComponent(itemId)}` : ""}`);
}

/**
 * A register line as the form holds it.
 *
 * Counts and money travel as the text that was typed. Turning them into numbers
 * here would mean a figure this browser mis-read still got filed; the server
 * parses and refuses, so one rule decides what a quantity is.
 */
export interface InventoryItemDraft {
  id?: string;
  item_name: string;
  asset_ref: string | null;
  category: string;
  unit: string;
  opening_quantity: string | null;
  location: string;
  custodian: string;
  condition: string;
  acquired_on: string | null;
  purchase_value: string | null;
  reorder_level: string | null;
  notes: string;
}

/**
 * Adds or corrects one register line, and hands back the server's own sentence
 * when it refuses — including the duplicate-label answer, which names the label
 * the school already holds rather than failing with a constraint nobody reads.
 */
export async function saveInventoryItemOnServer(
  item: InventoryItemDraft
): Promise<{ ok: boolean; id: string | null; reason: string | null }> {
  try {
    const response = await fetch("/api/inventory", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!response.ok) return { ok: false, id: null, reason: await serverReason(response) };
    const payload = (await response.json().catch(() => null)) as { data?: { id?: string } } | null;
    return { ok: true, id: payload?.data?.id ?? null, reason: null };
  } catch (error) {
    console.warn("API /api/inventory write failed", error);
    return { ok: false, id: null, reason: "the portal server did not answer" };
  }
}

export function removeInventoryItemOnServer(id: string) {
  return writeOnce("/api/inventory", "DELETE", { id });
}

/**
 * Files one movement and returns the shelf figure the school now holds.
 *
 * The number comes back from the server rather than being worked out here, so
 * the screen cannot show one quantity while the ledger says another — which is
 * how a hand-kept store card ends up two chairs ahead of the truth.
 */
export async function recordInventoryMovementOnServer(movement: {
  item_id: string;
  direction: "in" | "out";
  quantity: number;
  party?: string;
  purpose?: string;
  moved_on?: string;
}): Promise<{ ok: boolean; quantityOnHand: number | null; reason: string | null }> {
  try {
    const response = await fetch("/api/inventory/movements", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movement),
    });
    if (!response.ok) return { ok: false, quantityOnHand: null, reason: await serverReason(response) };
    const payload = (await response.json().catch(() => null)) as { data?: { quantityOnHand?: number } } | null;
    return { ok: true, quantityOnHand: payload?.data?.quantityOnHand ?? null, reason: null };
  } catch (error) {
    console.warn("API /api/inventory/movements write failed", error);
    return { ok: false, quantityOnHand: null, reason: "the portal server did not answer" };
  }
}


// ============================================================================
// 12. THE TIMETABLE, ON THE SCHOOL'S RECORDS
//
// The grid used to be this browser's own copy, which made it the one document
// every adult in the school acts on and none of them could check. A form teacher's
// Tuesday was not the office's Tuesday, the workload matrix counted the periods one
// machine had typed, and clearing the browser lost a term's planning with no
// warning. Every read and write here goes to /api/timetable, and a read that failed
// is shown as a failed read — never as a free week.
// ============================================================================

export interface TimetableLessonRow {
  id: string;
  session: string;
  term: string;
  className: string;
  day: string;
  periodIndex: number;
  periodLabel: string;
  subject: string;
  teacherName: string;
  teacherId: string;
  room: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** A lesson being filed. The slot it lands in is decided by class, day and period. */
export interface TimetableLessonDraft {
  session: string;
  term: string;
  className: string;
  day: string;
  periodIndex: number;
  periodLabel?: string;
  subject: string;
  teacherName?: string;
  teacherId?: string;
  room?: string;
}

export interface TimetableDayShape {
  session: string;
  term: string;
  periods: TimetablePeriod[];
  days: string[];
  /** False when the school has filed no shape and the one the portal ships with is being shown. */
  fromSchoolRecords: boolean;
}

/** The grid for one session and term. `rows: null` is a failed read, not an empty week. */
export function fetchTimetableFromSupabase(scope: { session: string; term: string; className?: string }) {
  const params = new URLSearchParams({ session: scope.session, term: scope.term });
  if (scope.className) params.set("class_name", scope.className);
  return readList<TimetableLessonRow>(`/api/timetable?${params}`);
}

/**
 * The shape of the school day — how many periods, on which days, at what times.
 *
 * A school that has never filed one is told so (`fromSchoolRecords: false`) and
 * shown the six periods the portal ships with, rather than the screen presenting a
 * default as though the office had chosen it.
 */
export async function fetchTimetableDayShape(session: string, term: string): Promise<TimetableDayShape> {
  const fallback: TimetableDayShape = {
    session,
    term,
    periods: DEFAULT_TIMETABLE_PERIODS,
    days: DEFAULT_TIMETABLE_DAYS,
    fromSchoolRecords: false,
  };
  try {
    const response = await fetch(
      `/api/timetable/periods?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`,
      { cache: "no-store", headers: { "Content-Type": "application/json" } }
    );
    if (!response.ok) {
      reportSyncFailure(
        `The school's day structure could not be read: ${await serverReason(response)}. The grid is showing the periods the portal ships with instead.`
      );
      return fallback;
    }
    const payload = (await response.json()) as { data?: { periods?: TimetablePeriod[]; days?: string[]; configured?: boolean } };
    const periods = Array.isArray(payload?.data?.periods) ? payload.data.periods : [];
    if (payload?.data?.configured === false || periods.length === 0) return fallback;
    return {
      session,
      term,
      periods,
      days: Array.isArray(payload?.data?.days) && payload.data.days.length > 0 ? payload.data.days : DEFAULT_TIMETABLE_DAYS,
      fromSchoolRecords: true,
    };
  } catch (error) {
    console.warn("API /api/timetable/periods read failed", error);
    reportSyncFailure(
      "The school's day structure could not be read: the portal server did not answer. The grid is showing the periods the portal ships with instead."
    );
    return fallback;
  }
}

/** Files one lesson into one slot, and carries back the refusal when that teacher is elsewhere at that time. */
export async function saveTimetableLessonOnServer(
  lesson: TimetableLessonDraft
): Promise<{ ok: boolean; id: string | null; replaced: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/timetable", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lesson),
    });
    if (!response.ok) return { ok: false, id: null, replaced: false, reason: await serverReason(response) };
    const payload = (await response.json().catch(() => null)) as { data?: { id?: string; replaced?: boolean } } | null;
    return { ok: true, id: payload?.data?.id ?? null, replaced: Boolean(payload?.data?.replaced), reason: null };
  } catch (error) {
    console.warn("API /api/timetable write failed", error);
    return { ok: false, id: null, replaced: false, reason: "the portal server did not answer" };
  }
}

export interface TimetableBatchRefusal {
  className: string;
  day: string;
  periodIndex: number;
  subject: string;
  reason: string;
}

/**
 * Files a grid in one call — the copy an older browser was holding, or a generated
 * draft a person has approved.
 *
 * The answer is the server's own count of what landed plus its reason for every row
 * it would not take. "Saved" would be the wrong word for a partial file, so the
 * screen prints the refused rows by name.
 */
export async function fileTimetableBatchOnServer(
  scope: { session: string; term: string },
  entries: TimetableLessonDraft[]
): Promise<{ ok: boolean; filed: number; refused: TimetableBatchRefusal[]; reason: string | null }> {
  try {
    const response = await fetch("/api/timetable", {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scope, entries }),
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: { filed?: number; refused?: TimetableBatchRefusal[] };
      error?: string;
    } | null;
    if (!response.ok) {
      return {
        ok: false,
        filed: payload?.data?.filed ?? 0,
        refused: payload?.data?.refused ?? [],
        reason: (await serverReason(response)) ?? payload?.error ?? "the portal server refused the grid",
      };
    }
    return { ok: true, filed: payload?.data?.filed ?? 0, refused: payload?.data?.refused ?? [], reason: null };
  } catch (error) {
    console.warn("API /api/timetable batch write failed", error);
    return { ok: false, filed: 0, refused: [], reason: "the portal server did not answer" };
  }
}

export function removeTimetableLessonOnServer(id: string) {
  return writeOnce("/api/timetable", "DELETE", { id });
}

/** Empties one class arm's grid for one session and term, and reports how many lessons went. */
export async function clearClassTimetableOnServer(scope: { session: string; term: string; className: string }) {
  try {
    const response = await fetch("/api/timetable", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    });
    if (!response.ok) return { ok: false, removed: 0, reason: await serverReason(response) };
    const payload = (await response.json().catch(() => null)) as { data?: { removed?: number } } | null;
    return { ok: true, removed: payload?.data?.removed ?? 0, reason: null };
  } catch (error) {
    console.warn("API /api/timetable clear failed", error);
    return { ok: false, removed: 0, reason: "the portal server did not answer" };
  }
}

/** Saves the school's own day shape, so a seven-period day stops being a rebuild. */
export async function saveTimetableDayShapeOnServer(shape: {
  session: string;
  term: string;
  periods: TimetablePeriod[];
  days: string[];
}): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/timetable/periods", {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shape),
    });
    if (!response.ok) return { ok: false, reason: await serverReason(response) };
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/timetable/periods write failed", error);
    return { ok: false, reason: "the portal server did not answer" };
  }
}

/** What the school is asking for: one arm, one subject, one teacher, N periods. */
export interface TimetablePlanRow {
  className: string;
  subject: string;
  teacherName?: string;
  teacherId?: string;
  periodsWanted: number;
}

export interface TimetableDraftLesson {
  session: string;
  term: string;
  class_name: string;
  day: string;
  period_index: number;
  period_label: string;
  subject: string;
  teacher_name: string;
  teacher_ref: string | null;
  /** True for the lessons already on the school's timetable, which the draft was built around. */
  onSchoolRecord: boolean;
}

export interface TimetableDraftShortfall {
  class_name: string;
  subject: string;
  teacher_name: string;
  wanted: number;
  placed: number;
  reason: string;
}

export interface TimetableDraftEmptySlot {
  class_name: string;
  day: string;
  period_index: number;
  period_label: string;
}

export interface TimetableDraftResult {
  ok: boolean;
  reason: string | null;
  weeklySlots: number;
  dayShapeFromSchoolRecords: boolean;
  lessons: TimetableDraftLesson[];
  unplaced: TimetableDraftShortfall[];
  emptySlots: TimetableDraftEmptySlot[];
}

/**
 * Asks the portal to place a plan into the school's week, and files nothing.
 *
 * The answer always carries three separate facts — what was placed, what could not
 * be and why, and which slots stayed empty — because a draft that only reports
 * success is how a week with four holes in it gets printed as a finished timetable.
 */
export async function draftTimetableOnServer(input: {
  session: string;
  term: string;
  plan: TimetablePlanRow[];
  maxPeriodsPerTeacher?: number | null;
}): Promise<TimetableDraftResult> {
  const empty: TimetableDraftResult = {
    ok: false,
    reason: null,
    weeklySlots: 0,
    dayShapeFromSchoolRecords: false,
    lessons: [],
    unplaced: [],
    emptySlots: [],
  };
  try {
    const response = await fetch("/api/timetable/generate", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: input.session,
        term: input.term,
        demands: input.plan,
        maxPeriodsPerTeacher: input.maxPeriodsPerTeacher ?? null,
      }),
    });
    if (!response.ok) return { ...empty, reason: await serverReason(response) };
    const payload = (await response.json().catch(() => null)) as {
      data?: {
        weeklySlots?: number;
        dayShapeFromSchoolRecords?: boolean;
        lessons?: TimetableDraftLesson[];
        unplaced?: TimetableDraftShortfall[];
        emptySlots?: TimetableDraftEmptySlot[];
      };
    } | null;
    return {
      ok: true,
      reason: null,
      weeklySlots: payload?.data?.weeklySlots ?? 0,
      dayShapeFromSchoolRecords: Boolean(payload?.data?.dayShapeFromSchoolRecords),
      lessons: payload?.data?.lessons ?? [],
      unplaced: payload?.data?.unplaced ?? [],
      emptySlots: payload?.data?.emptySlots ?? [],
    };
  } catch (error) {
    console.warn("API /api/timetable/generate failed", error);
    return { ...empty, reason: "the portal server did not answer" };
  }
}

// ============================================================================
// 8. THE DAILY DUTY ROSTER
//
// One row is one person, one duty, one part of one named day. The screen prints
// what the school filed and nothing else: a day with no duties says so, because
// an empty grid that could also mean "the read failed" is how a teacher ends up
// standing at a gate nobody assigned her.
// ============================================================================

export interface StaffDutyRow {
  id: string;
  duty_date: string;
  staff_id: string;
  staff_name: string;
  designation: string;
  duty: string;
  time_window: string;
  location: string;
  notes: string;
  assigned_by: string;
}

export interface DutyRoster {
  ok: boolean;
  /** Why the roster could not be read, in the server's own sentence. */
  reason: string | null;
  /** "school" for the office roles, "self" for a staff login reading its own rows. */
  scope: "school" | "self" | "";
  from: string;
  to: string;
  /** The server's date for the school, in West African Time — never the browser's. */
  today: string;
  duties: StaffDutyRow[];
  staffRecordLinked: boolean;
  note: string | null;
}

const EMPTY_ROSTER: DutyRoster = {
  ok: false,
  reason: null,
  scope: "",
  from: "",
  to: "",
  today: "",
  duties: [],
  staffRecordLinked: true,
  note: null,
};

export async function fetchDutyRosterOnServer(range: {
  from?: string;
  to?: string;
  date?: string;
}): Promise<DutyRoster> {
  const params = new URLSearchParams();
  if (range.date) params.set("date", range.date);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const query = params.toString();

  try {
    const response = await fetch(`/api/staff-duty${query ? `?${query}` : ""}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return { ...EMPTY_ROSTER, reason: await serverReason(response) };

    const payload = (await response.json().catch(() => null)) as {
      data?: Partial<Omit<DutyRoster, "ok" | "reason">>;
    } | null;
    const data = payload?.data ?? {};
    return {
      ok: true,
      reason: null,
      scope: data.scope === "school" || data.scope === "self" ? data.scope : "",
      from: data.from ?? "",
      to: data.to ?? "",
      today: data.today ?? "",
      duties: Array.isArray(data.duties) ? data.duties : [],
      staffRecordLinked: data.staffRecordLinked !== false,
      note: data.note ?? null,
    };
  } catch (error) {
    console.warn("API /api/staff-duty read failed", error);
    return { ...EMPTY_ROSTER, reason: "the portal server did not answer" };
  }
}

export interface DutyAssignment {
  date: string;
  staffId: string;
  duty: string;
  timeWindow: string;
  location?: string;
  notes?: string;
}

export interface DutyAssignmentResult {
  ok: boolean;
  reason: string | null;
  /** The duty that was already in this slot, when the office corrected one. */
  replaced: string | null;
  /** The register's status for this member, so a duty filed for someone on leave is visible. */
  staffStatus: string | null;
  duty: StaffDutyRow | null;
}

export async function assignDutyOnServer(input: DutyAssignment): Promise<DutyAssignmentResult> {
  try {
    const response = await fetch("/api/staff-duty", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return { ok: false, reason: await serverReason(response), replaced: null, staffStatus: null, duty: null };
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: { duty?: StaffDutyRow; replaced?: string | null; staffStatus?: string | null };
    } | null;

    return {
      ok: true,
      reason: null,
      duty: payload?.data?.duty ?? null,
      replaced: payload?.data?.replaced ?? null,
      staffStatus: payload?.data?.staffStatus ?? null,
    };
  } catch (error) {
    console.warn("API /api/staff-duty write failed", error);
    return { ok: false, reason: "the portal server did not answer", replaced: null, staffStatus: null, duty: null };
  }
}

export async function removeDutyOnServer(
  id: string
): Promise<{ ok: boolean; reason: string | null; duty: string | null }> {
  try {
    const response = await fetch("/api/staff-duty", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      return { ok: false, reason: await serverReason(response), duty: null };
    }

    const payload = (await response.json().catch(() => null)) as { data?: { duty?: string } } | null;
    return { ok: true, reason: null, duty: payload?.data?.duty ?? null };
  } catch (error) {
    console.warn("API /api/staff-duty delete failed", error);
    return { ok: false, reason: "the portal server did not answer", duty: null };
  }
}

// ============================================================================
// 14. THE CLASS LIST, THE SUBJECT LIST AND THE SUBJECT PACKAGES
// ============================================================================
// Three-quarters of the portal filters, groups or prices by one of these three
// lists, and until now each of them was whatever the office's own browser had
// cached. A teacher opening the CA grid on another machine was offered a
// different set of arms and papers than the ones the fees were billed against.
// Nothing here is optimistic: the list on screen is re-read from the server
// after a write, so an arm the school refused to file never appears on it.

interface ClassArmRow {
  id: string;
  name: string;
  section: string;
  form_teacher: string;
  form_teacher_id: string;
  capacity: number | string | null;
  students_count?: number | string | null;
  is_active?: boolean | null;
  sort_order?: number | string | null;
}

function toClassArmRecord(row: ClassArmRow): ClassArmRecord {
  return {
    id: row.id,
    name: row.name,
    section: row.section as ClassArmRecord["section"],
    formTeacher: row.form_teacher ?? "",
    formTeacherId: row.form_teacher_id ?? "",
    // Counted from the roll by the route, not read back off the arm row.
    studentsCount: Number(row.students_count) || 0,
    capacity: Number(row.capacity) || 0,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order) || 0,
  };
}

export async function fetchClassArmsFromSupabase(): Promise<ClassArmRecord[] | null> {
  const rows = await requestJson<ClassArmRow[]>("/api/classes", "The class list");
  if (!rows) return null;
  return rows.map(toClassArmRecord);
}

/** The arm as the Classes screen knows it, minus the figures the server counts. */
export interface ClassArmInput {
  id?: string;
  name: string;
  section: ClassArmRecord["section"];
  formTeacher: string;
  formTeacherId: string;
  capacity: number;
  isActive?: boolean;
  sortOrder?: number;
}

export async function saveClassArmOnServer(arm: ClassArmInput): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet("/api/classes", {
    id: arm.id,
    name: arm.name,
    section: arm.section,
    form_teacher: arm.formTeacher,
    form_teacher_id: arm.formTeacherId,
    capacity: arm.capacity,
    is_active: arm.isActive !== false,
    sort_order: arm.sortOrder ?? 0,
  });
  if (reason) reportSyncFailure(`The class arm was NOT filed on the school's list: ${reason}.`);
  else reportSyncSaved(`“${arm.name}” filed on the school's class list.`);
  return { ok: !reason, reason };
}

export async function updateClassArmOnServer(
  id: string,
  updates: Partial<ClassArmInput>
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const payload: Record<string, any> = { id };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.section !== undefined) payload.section = updates.section;
    if (updates.formTeacher !== undefined) payload.form_teacher = updates.formTeacher;
    if (updates.formTeacherId !== undefined) payload.form_teacher_id = updates.formTeacherId;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

    const response = await fetch("/api/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The class arm was NOT updated: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved(`Class arm updated.`);
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/classes patch failed", error);
    return { ok: false, reason: "the portal server did not answer" };
  }
}

export async function removeClassArmOnServer(id: string): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/classes", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The class arm was NOT removed from the school's list: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved("Class arm removed from the school's list.");
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/classes delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The class arm was NOT removed from the school's list: ${reason}.`);
    return { ok: false, reason };
  }
}

interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  applicable_classes: string[] | null;
  is_compulsory: boolean | null;
  is_core?: boolean | null;
  school_level?: string | null;
  is_active?: boolean | null;
}

function toSubjectRecord(row: SubjectRow): SubjectRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code || undefined,
    category: row.category || undefined,
    applicableClasses: Array.isArray(row.applicable_classes) ? row.applicable_classes : [],
    isCompulsory: row.is_compulsory !== false,
    isCore: Boolean(row.is_core),
    schoolLevel: (row.school_level || "PRIMARY") as "PRIMARY" | "SECONDARY" | "ALL",
    isActive: row.is_active !== false,
  };
}

export async function fetchSubjectsFromSupabase(): Promise<SubjectRecord[] | null> {
  const rows = await requestJson<SubjectRow[]>("/api/subjects", "The subject list");
  if (!rows) return null;
  return rows.map(toSubjectRecord);
}

export interface SubjectInput {
  id?: string;
  name: string;
  code?: string;
  category?: string;
  applicableClasses: string[];
  isCompulsory?: boolean;
  isCore?: boolean;
  schoolLevel?: "PRIMARY" | "SECONDARY" | "ALL";
  isActive?: boolean;
}

/** Files one subject or the whole batch the screen has typed. */
export async function saveSubjectsOnServer(list: SubjectInput[]): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet(
    "/api/subjects",
    list.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code ?? "",
      category: subject.category ?? "",
      applicable_classes: subject.applicableClasses,
      is_compulsory: subject.isCompulsory !== false,
      is_core: Boolean(subject.isCore),
      school_level: subject.schoolLevel || "PRIMARY",
      is_active: subject.isActive !== false,
    }))
  );
  if (reason) reportSyncFailure(`The subject list was NOT filed on the school's records: ${reason}.`);
  else reportSyncSaved(`${list.length} subject${list.length === 1 ? "" : "s"} filed on the school's subject list.`);
  return { ok: !reason, reason };
}

export async function updateSubjectOnServer(
  id: string,
  updates: Partial<SubjectInput>
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const payload: Record<string, any> = { id };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.code !== undefined) payload.code = updates.code;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.applicableClasses !== undefined) payload.applicable_classes = updates.applicableClasses;
    if (updates.isCompulsory !== undefined) payload.is_compulsory = updates.isCompulsory;
    if (updates.isCore !== undefined) payload.is_core = updates.isCore;
    if (updates.schoolLevel !== undefined) payload.school_level = updates.schoolLevel;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    const response = await fetch("/api/subjects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The subject was NOT updated: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved(`Subject updated.`);
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/subjects patch failed", error);
    return { ok: false, reason: "the portal server did not answer" };
  }
}

/**
 * Removes subjects and reports back what the server said was still behind them.
 *
 * The screen needs the server's own list of subjects that still have marks
 * filed, because it is the only one that can say whether a mark anybody entered
 * is about to lose the line it belongs to.
 */
export async function removeSubjectsOnServer(
  ids: string[]
): Promise<{ ok: boolean; reason: string | null; stillFiled: string[] }> {
  try {
    const response = await fetch("/api/subjects", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The subject was NOT removed from the school's list: ${reason}.`);
      return { ok: false, reason, stillFiled: [] };
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: { still_filed?: string[] };
    } | null;
    const stillFiled = Array.isArray(payload?.data?.still_filed) ? payload.data.still_filed : [];
    reportSyncSaved(
      stillFiled.length > 0
        ? `Subject removed. Marks already filed under ${stillFiled.join(", ")} are still on the record — putting the name back brings them onto the grid again.`
        : "Subject removed from the school's list."
    );
    return { ok: true, reason: null, stillFiled };
  } catch (error) {
    console.warn("API /api/subjects delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The subject was NOT removed from the school's list: ${reason}.`);
    return { ok: false, reason, stillFiled: [] };
  }
}

interface SubjectTemplateRow {
  id: string;
  name: string;
  department: string;
  target_class: string;
  subjects: string[] | null;
}

function toSubjectTemplateRecord(row: SubjectTemplateRow): SubjectTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    department: row.department as SubjectTemplateRecord["department"],
    targetClass: row.target_class ?? "",
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
  };
}

export async function fetchSubjectTemplatesFromSupabase(): Promise<SubjectTemplateRecord[] | null> {
  const rows = await requestJson<SubjectTemplateRow[]>("/api/subject-templates", "The subject packages");
  if (!rows) return null;
  return rows.map(toSubjectTemplateRecord);
}

export interface SubjectTemplateInput {
  id?: string;
  name: string;
  department: SubjectTemplateRecord["department"];
  targetClass: string;
  subjects: string[];
}

/** Files one package or the standard set the screen offers to populate. */
export async function saveSubjectTemplatesOnServer(
  list: SubjectTemplateInput[]
): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet(
    "/api/subject-templates",
    list.map((template) => ({
      id: template.id,
      name: template.name,
      department: template.department,
      target_class: template.targetClass,
      subjects: template.subjects,
    }))
  );
  if (reason) reportSyncFailure(`The subject packages were NOT filed on the school's records: ${reason}.`);
  else reportSyncSaved(`${list.length} subject package${list.length === 1 ? "" : "s"} filed on the school's records.`);
  return { ok: !reason, reason };
}

export async function removeSubjectTemplatesOnServer(ids: string[]): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/subject-templates", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The subject package was NOT removed from the school's list: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved("Subject package removed from the school's list.");
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/subject-templates delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The subject package was NOT removed from the school's list: ${reason}.`);
    return { ok: false, reason };
  }
}

/** 1-Click: Applies a subject package's subjects to an entire class arm */
export async function applySubjectTemplateOnServer(
  templateId: string,
  targetClass: string
): Promise<{ ok: boolean; reason: string | null; message?: string }> {
  try {
    const response = await fetch("/api/subject-templates", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply", templateId, targetClass }),
    });

    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`Failed to apply subject package: ${reason}.`);
      return { ok: false, reason };
    }
    const data = await response.json();
    const msg = data?.message || `Subject package applied to ${targetClass}.`;
    reportSyncSaved(msg);
    return { ok: true, reason: null, message: msg };
  } catch (error) {
    console.warn("API /api/subject-templates apply failed", error);
    return { ok: false, reason: "the portal server did not answer" };
  }
}

// ============================================================================
// 15. THE CBT BANK, THE SITTINGS AND THE LOCKDOWN SWITCH
// ============================================================================
// The question bank decided what a candidate was examined on, the switch decided
// whether they may be examined at all, and the sittings were the only evidence a
// child sat anything. All three lived in one browser, so the paper, the window
// and the record were each whatever that machine last typed. Nothing here is
// optimistic: the bank on screen is re-read from the school's records after a
// write, and a sitting that was not filed says it was not filed.

interface CBTQuestionRow {
  id: number;
  subject: string;
  class_name: string;
  question_text: string;
  options: string[] | null;
  correct_answer_index: number;
  marks: number;
}

function toCBTQuestionRecord(row: CBTQuestionRow): CBTQuestionRecord {
  return {
    id: String(row.id),
    subject: row.subject,
    className: row.class_name,
    questionText: row.question_text,
    options: Array.isArray(row.options) ? row.options : [],
    // The engine reads `correctOptionIndex`; the column is named for the answer
    // it is, so the two are mapped here and nowhere else.
    correctOptionIndex: row.correct_answer_index,
    marks: row.marks,
  };
}

export async function fetchCBTQuestionsFromSupabase(): Promise<CBTQuestionRecord[] | null> {
  const rows = await requestJson<CBTQuestionRow[]>("/api/cbt/questions", "The exam question bank");
  if (!rows) return null;
  return rows.map(toCBTQuestionRecord);
}

export interface CBTQuestionInput {
  /** The bank's own number. Absent means a question the school has never filed. */
  id?: string;
  subject: string;
  className: string;
  questionText: string;
  options: string[];
  /** Zero-based: option A is 0. The screen counts from A, the records store the index. */
  correctOptionIndex: number;
  marks: number;
}

/** Files one question or a whole imported paper, then leaves the reload to the caller. */
export async function saveCBTQuestionsOnServer(
  list: CBTQuestionInput[]
): Promise<{ ok: boolean; saved: number; reason: string | null }> {
  const reason = await postQuiet(
    "/api/cbt/questions",
    list.map((question) => ({
      id: question.id,
      subject: question.subject,
      class_name: question.className,
      question_text: question.questionText,
      options: question.options,
      correct_option_index: question.correctOptionIndex,
      marks: question.marks,
    }))
  );
  if (reason) {
    reportSyncFailure(`The questions were NOT filed on the school's exam bank: ${reason}.`);
    return { ok: false, saved: 0, reason };
  }
  reportSyncSaved(
    `${list.length} question${list.length === 1 ? "" : "s"} filed on the school's exam bank — every machine now serves this paper.`
  );
  return { ok: true, saved: list.length, reason: null };
}

export async function removeCBTQuestionOnServer(id: string): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/cbt/questions", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The question was NOT removed from the school's exam bank: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved("Question removed from the school's exam bank.");
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/cbt/questions delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The question was NOT removed from the school's exam bank: ${reason}.`);
    return { ok: false, reason };
  }
}

interface CBTConfigRow {
  is_open: boolean;
  active_exam_mode: string;
  scheduled_window: string;
  offline_message: string;
  updated_by: string;
  updated_at: string;
}

function toCBTConfigRecord(row: CBTConfigRow): CBTConfigRecord {
  return {
    isOpen: row.is_open === true,
    activeExamMode: row.active_exam_mode ?? "",
    scheduledWindow: row.scheduled_window ?? "",
    offlineMessage: row.offline_message ?? "",
    allowAdminBypass: true,
    updatedAt: row.updated_at ?? undefined,
    updatedBy: row.updated_by || undefined,
  };
}

/**
 * The school's CBT switch, or null when this device cannot reach it.
 *
 * A parent's browser has to be able to read it, because the notice a candidate
 * is given when the module is shut comes from here.
 */
export async function fetchCBTConfigFromSupabase(): Promise<CBTConfigRecord | null> {
  const row = await requestJson<CBTConfigRow>("/api/cbt/settings", "The CBT open/closed switch");
  if (!row) return null;
  return toCBTConfigRecord(row);
}

/** Moves the switch, and returns what the school now holds rather than what was typed. */
export async function saveCBTConfigOnServer(
  updates: Partial<CBTConfigRecord>
): Promise<{ ok: boolean; config: CBTConfigRecord | null; reason: string | null }> {
  try {
    const response = await fetch("/api/cbt/settings", {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_open: updates.isOpen,
        active_exam_mode: updates.activeExamMode ?? "",
        scheduled_window: updates.scheduledWindow ?? "",
        offline_message: updates.offlineMessage ?? "",
      }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The CBT switch was NOT changed on the school's records: ${reason}.`);
      return { ok: false, config: null, reason };
    }

    const payload = (await response.json().catch(() => null)) as { data?: CBTConfigRow } | null;
    const filed = payload?.data ? toCBTConfigRecord(payload.data) : null;
    reportSyncSaved(
      filed?.isOpen
        ? "The CBT module is open on the school's records — every machine sees the switch."
        : "The CBT module is closed on the school's records — candidates are turned away on every machine."
    );
    return { ok: true, config: filed, reason: null };
  } catch (error) {
    console.warn("API /api/cbt/settings put failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The CBT switch was NOT changed on the school's records: ${reason}.`);
    return { ok: false, config: null, reason };
  }
}

export interface CBTSittingInput {
  admissionNo: string;
  session: string;
  term: string;
  /** Empty when the paper mixed subjects — the records then hold no subject to name. */
  subject: string;
  questionCount: number;
  cbtScore: number;
  maxMarks: number;
  strikes: number;
  isExpelled: boolean;
  malpracticeLogs: { type: string; severity: string; description: string; at: string }[];
}

/**
 * Files one finished sitting on the school's records.
 *
 * The score is the browser's arithmetic and the route re-resolves the pupil from
 * the register, so a sitting cannot be attached to a name this machine invented.
 * It is still not a mark: the gradebook column changes when a person enters it.
 */
export async function recordCBTSittingOnServer(
  sitting: CBTSittingInput
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/cbt/sessions", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sitting),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`This sitting was NOT filed on the school's records: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved("Sitting filed on the school's records. The mark itself is still entered by a teacher or the exam office.");
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/cbt/sessions post failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`This sitting was NOT filed on the school's records: ${reason}.`);
    return { ok: false, reason };
  }
}

interface CBTSittingRow {
  id: string;
  admission_no: string;
  student_name: string;
  class_name: string;
  session: string;
  term: string;
  subject: string | null;
  question_count: number | null;
  cbt_score: number | string | null;
  max_marks: number | string | null;
  strikes: number | null;
  is_expelled: boolean | null;
  completed_at: string | null;
}

function toCBTSittingRecord(row: CBTSittingRow): CBTSittingRecord {
  return {
    id: row.id,
    admissionNo: row.admission_no,
    studentName: row.student_name,
    className: row.class_name,
    session: row.session,
    term: row.term,
    subject: row.subject ?? "",
    questionCount: Number(row.question_count) || 0,
    cbtScore: Number(row.cbt_score) || 0,
    maxMarks: Number(row.max_marks) || 0,
    strikes: Number(row.strikes) || 0,
    isExpelled: row.is_expelled === true,
    completedAt: row.completed_at ?? "",
  };
}

/** Sittings as the school holds them, newest first, for one narrowed query. */
async function readCBTSittings(query: { [key: string]: string }, label: string): Promise<CBTSittingRecord[] | null> {
  const params = new URLSearchParams(query);
  const rows = await requestJson<CBTSittingRow[]>(`/api/cbt/sessions?${params.toString()}`, label);
  return rows ? rows.map(toCBTSittingRecord) : null;
}

/** Sittings filed for one pupil in one session and term, newest first. */
export function fetchCBTSittingsOnServer(
  admissionNo: string,
  session: string,
  term: string
): Promise<CBTSittingRecord[] | null> {
  return readCBTSittings({ admission_no: admissionNo, session, term }, "The sittings filed for this pupil");
}

/**
 * Sittings filed for one class in one session and term, newest first.
 *
 * The CA entry grid is where an attempt becomes a mark, so it has to see the
 * attempts the school holds rather than the one this particular browser happened
 * to run. Rows come back newest first, so the caller takes each pupil's first.
 */
export function fetchCBTSittingsForClass(
  className: string,
  session: string,
  term: string
): Promise<CBTSittingRecord[] | null> {
  return readCBTSittings({ class_name: className, session, term }, "The sittings filed for this class");
}

/**
 * Sittings filed in one session and term, for the end-of-term checklist.
 *
 * Counted rather than assumed: the checklist used to say no portal screen wrote
 * a CBT session to the records, which stopped being true the moment the engine
 * filed its attempts. What it still cannot say is that any of them became a mark.
 */
export async function countCBTSittingsForTerm(
  session: string,
  term: string
): Promise<{ value: number | null; reason: string | null }> {
  return readList<{ id: string }>(
    `/api/cbt/sessions?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}&limit=1000`
  ).then(({ rows, reason }) => ({ value: rows ? rows.length : null, reason }));
}

// ============================================================================
// 16. THE TERM CALENDAR AND THE ACTIVITY TEMPLATES
// ============================================================================
// A term's dates decide when families send a child with a uniform, when staff
// meet the score-entry deadline, and what the circular prints. They were typed
// into one browser and kept in that browser's localStorage, so the office's
// machine was the only one that knew them and every other screen showed an empty
// calendar with no way to tell "no plans" from "not typed yet".
//
// Nothing here is optimistic. The milestone list is re-read from the school's
// records after every write, so a row the office was refused never appears on
// screen — and a row that only this browser invented cannot be edited, because
// the server says so rather than quietly updating nothing.

interface CalendarEventRow {
  id: string;
  session: string;
  term: string;
  title: string;
  date_range: string | null;
  description: string | null;
  category: string;
  status: string;
}

function toCalendarEventRecord(row: CalendarEventRow): CalendarEventRecord {
  return {
    id: row.id,
    title: row.title,
    // An empty date is the school saying "not fixed yet". It is kept empty here
    // so the screen can print those words instead of a placeholder date.
    dateRange: row.date_range ?? "",
    category: row.category as CalendarEventRecord["category"],
    term: row.term as CalendarEventRecord["term"],
    session: row.session,
    description: row.description ?? "",
    status: row.status as CalendarEventRecord["status"],
  };
}

export async function fetchCalendarEventsFromSupabase(): Promise<CalendarEventRecord[] | null> {
  const rows = await requestJson<CalendarEventRow[]>("/api/calendar", "The school calendar");
  if (!rows) return null;
  return rows.map(toCalendarEventRecord);
}

/** The milestone as the calendar screen knows it; `id` is absent when it is new. */
export interface CalendarEventInput {
  id?: string;
  session: string;
  term: string;
  title: string;
  dateRange: string;
  description: string;
  category: CalendarEventRecord["category"];
  status: CalendarEventRecord["status"];
}

/** Files one milestone, or the starting outline the screen offers, in one call. */
export async function saveCalendarEventsOnServer(
  list: CalendarEventInput[]
): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet(
    "/api/calendar",
    list.map((event) => ({
      id: event.id,
      session: event.session,
      term: event.term,
      title: event.title,
      date_range: event.dateRange,
      description: event.description,
      category: event.category,
      status: event.status,
    }))
  );
  if (reason) reportSyncFailure(`The milestone was NOT filed on the school's calendar: ${reason}.`);
  else reportSyncSaved(`${list.length} milestone${list.length === 1 ? "" : "s"} filed on the school's calendar.`);
  return { ok: !reason, reason };
}

/**
 * Moves one milestone between Upcoming, Active and Completed.
 *
 * This is the only field the screen changes in place, and it sends the status
 * alone rather than the whole row: re-sending a stale title would overwrite what
 * somebody else corrected in the meantime.
 */
export async function setCalendarStatusOnServer(
  id: string,
  status: CalendarEventRecord["status"]
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/calendar", {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The milestone's status was NOT changed on the school's calendar: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved(`Calendar milestone marked ${status.toLowerCase()} on the school's calendar.`);
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/calendar status change failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The milestone's status was NOT changed on the school's calendar: ${reason}.`);
    return { ok: false, reason };
  }
}

/** Removes milestones — and says plainly when the browser had nothing to remove. */
export async function removeCalendarEventsOnServer(
  ids: string[]
): Promise<{ ok: boolean; reason: string | null; removed: number }> {
  try {
    const response = await fetch("/api/calendar", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The milestone was NOT removed from the school's calendar: ${reason}.`);
      return { ok: false, reason, removed: 0 };
    }

    const payload = (await response.json().catch(() => null)) as { data?: { removed?: number } } | null;
    const removed = Number(payload?.data?.removed) || 0;
    reportSyncSaved(
      removed === 1
        ? "Milestone removed from the school's calendar."
        : `${removed} milestones removed from the school's calendar.`
    );
    return { ok: true, reason: null, removed };
  } catch (error) {
    console.warn("API /api/calendar delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The milestone was NOT removed from the school's calendar: ${reason}.`);
    return { ok: false, reason, removed: 0 };
  }
}

interface ActivityTemplateRow {
  id: string;
  title: string;
  category: string;
  target_section: string | null;
  coordinator: string | null;
  venue: string | null;
  budget: string | null;
  objectives: string | null;
  duration_days: number | string | null;
}

function toActivityTemplateRecord(row: ActivityTemplateRow): ActivityTemplateRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category as ActivityTemplateRecord["category"],
    // Blank stays blank. "Unassigned", "Main Campus Hall" and "₦0" used to be
    // typed in here, and each one read as a decision the school had made.
    targetSection: row.target_section ?? "",
    coordinator: row.coordinator ?? "",
    venue: row.venue ?? "",
    budget: row.budget ?? "",
    objectives: row.objectives ?? "",
    defaultDurationDays: Number(row.duration_days) || 1,
  };
}

export async function fetchActivityTemplatesFromSupabase(): Promise<ActivityTemplateRecord[] | null> {
  const rows = await requestJson<ActivityTemplateRow[]>("/api/activity-templates", "The activity templates");
  if (!rows) return null;
  return rows.map(toActivityTemplateRecord);
}

export interface ActivityTemplateInput {
  id?: string;
  title: string;
  category: ActivityTemplateRecord["category"];
  targetSection: string;
  coordinator: string;
  venue: string;
  budget: string;
  objectives: string;
  defaultDurationDays: number;
}

export async function saveActivityTemplateOnServer(
  template: ActivityTemplateInput
): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet("/api/activity-templates", {
    id: template.id,
    title: template.title,
    category: template.category,
    targetSection: template.targetSection,
    coordinator: template.coordinator,
    venue: template.venue,
    budget: template.budget,
    objectives: template.objectives,
    defaultDurationDays: template.defaultDurationDays,
  });
  if (reason) reportSyncFailure(`The activity template was NOT filed on the school's records: ${reason}.`);
  else reportSyncSaved(`“${template.title}” filed on the school's activity templates.`);
  return { ok: !reason, reason };
}

export async function removeActivityTemplateOnServer(id: string): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const response = await fetch("/api/activity-templates", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The activity template was NOT removed from the school's records: ${reason}.`);
      return { ok: false, reason };
    }
    reportSyncSaved("Activity template removed from the school's records.");
    return { ok: true, reason: null };
  } catch (error) {
    console.warn("API /api/activity-templates delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The activity template was NOT removed from the school's records: ${reason}.`);
    return { ok: false, reason };
  }
}

// ============================================================================
// 17. THE CA COMPONENT STRUCTURE, THE CARD THEME AND THE TERMINAL CIRCULAR
// ============================================================================
// Three lists the portal kept in one browser's localStorage. Two of them reach a
// family — the card's colours and the circular printed on its back — so the
// office machine was the only one whose printout carried the school's own words,
// and a card printed for Third Term carried the message written for First under
// a Third Term heading.
//
// What filing a CA structure does NOT do is change a computed mark: the
// gradebook and /api/ca add the five columns they were written with. These calls
// record what the school says its assessment is made of, and the screens that
// file it say that out loud.

export interface CAStructureFile {
  tierKey: CATierKey;
  components: CAComponentItem[];
  description: string;
  updatedBy: string;
  updatedAt: string | null;
}

interface CAStructureRow {
  tier_key: string;
  components: { key?: unknown; name?: unknown; max_score?: unknown; description?: unknown }[] | null;
  description: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

function toCAStructureFile(row: CAStructureRow): CAStructureFile {
  return {
    tierKey: row.tier_key as CATierKey,
    description: row.description ?? "",
    updatedBy: row.updated_by ?? "",
    updatedAt: row.updated_at,
    components: (row.components ?? []).flatMap((entry) => {
      const name = typeof entry?.name === "string" ? entry.name : "";
      if (!name) return [];
      return [
        {
          key: typeof entry?.key === "string" ? entry.key : name.toLowerCase().replace(/\W+/g, "_"),
          name,
          maxScore: Number(entry?.max_score) || 0,
          description: typeof entry?.description === "string" ? entry.description : "",
        },
      ];
    }),
  };
}

/** The structures the school has filed, keyed by tier. A tier with no row is absent. */
export async function fetchCAStructuresFromSupabase(): Promise<Record<string, CAStructureFile> | null> {
  const rows = await requestJson<CAStructureRow[]>("/api/ca-structures", "The CA component structures");
  if (!rows) return null;

  const byTier: Record<string, CAStructureFile> = {};
  for (const row of rows) {
    const file = toCAStructureFile(row);
    byTier[file.tierKey] = file;
  }
  return byTier;
}

/** What a screen sends to file a tier: the list itself and the school's note. */
export type CAStructureInput = Pick<CAStructureFile, "tierKey" | "components" | "description">;

/** Files one tier's component list, or the starting outline for all four, in one call. */
export async function saveCAStructuresOnServer(
  structures: CAStructureInput[]
): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet(
    "/api/ca-structures",
    structures.map((structure) => ({
      tierKey: structure.tierKey,
      description: structure.description,
      components: structure.components.map((component) => ({
        key: component.key,
        name: component.name,
        max_score: component.maxScore,
        description: component.description,
      })),
    }))
  );
  if (reason) reportSyncFailure(`The CA structure was NOT filed on the school's records: ${reason}.`);
  else {
    reportSyncSaved(
      structures.length === 1
        ? "CA structure filed on the school's records."
        : `${structures.length} tier structures filed on the school's records.`
    );
  }
  return { ok: !reason, reason };
}

interface ThemeRow {
  id: number;
  theme_key: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ReportThemeFile {
  theme: ReportTheme;
  updatedBy: string;
  updatedAt: string | null;
}

/** The card theme the school filed, or null when it never has. */
export async function fetchReportThemeFromSupabase(): Promise<ReportThemeFile | null> {
  const row = await requestJson<ThemeRow | null>("/api/report-theme", "The report card theme");
  if (!row || typeof row.theme_key !== "string") return null;
  return {
    theme: row.theme_key as ReportTheme,
    updatedBy: row.updated_by ?? "",
    updatedAt: row.updated_at,
  };
}

export async function saveReportThemeOnServer(theme: ReportTheme): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet("/api/report-theme", { theme });
  if (reason) reportSyncFailure(`The report card theme was NOT filed on the school's records: ${reason}.`);
  else reportSyncSaved("Report card theme filed on the school's records.");
  return { ok: !reason, reason };
}

interface NewsletterRow {
  id: string;
  session: string;
  term: string;
  title: string | null;
  principal_name: string | null;
  principal_message: string | null;
  next_term_resumption: string | null;
  events_and_highlights: unknown;
  fee_policy_and_deadlines: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  custom_notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

function toNewsletterRecord(row: NewsletterRow): NewsletterRecord {
  return {
    session: row.session,
    term: row.term as NewsletterRecord["term"],
    // Blank stays blank. The card has its own sentence for every field the
    // school left empty, and an invented resumption date or bank account is a
    // statement to a family that nobody made.
    title: row.title ?? "",
    principalName: row.principal_name ?? "",
    principalMessage: row.principal_message ?? "",
    nextTermResumption: row.next_term_resumption ?? "",
    eventsAndHighlights: Array.isArray(row.events_and_highlights)
      ? row.events_and_highlights.filter((line): line is string => typeof line === "string" && line.trim() !== "")
      : [],
    feePolicyAndDeadlines: row.fee_policy_and_deadlines ?? "",
    bankAccountDetails: {
      bankName: row.bank_name ?? "",
      accountName: row.account_name ?? "",
      accountNumber: row.account_number ?? "",
    },
    customNotes: row.custom_notes ?? "",
    updatedAt: row.updated_at ?? undefined,
    updatedBy: row.updated_by ?? "",
  };
}

/** Every circular the school has written, one per session and term. */
export async function fetchNewslettersFromSupabase(): Promise<NewsletterRecord[] | null> {
  const rows = await requestJson<NewsletterRow[]>("/api/newsletter", "The terminal newsletters");
  if (!rows) return null;
  return rows.map(toNewsletterRecord);
}

/** Files the circular for the session and term the record is labelled with. */
export async function saveNewsletterOnServer(
  newsletter: NewsletterRecord
): Promise<{ ok: boolean; reason: string | null }> {
  const reason = await postQuiet("/api/newsletter", newsletter);
  if (reason) reportSyncFailure(`The newsletter was NOT filed on the school's records: ${reason}.`);
  else reportSyncSaved(`${newsletter.term} of ${newsletter.session} circular filed on the school's records.`);
  return { ok: !reason, reason };
}

// ============================================================================
// 18. IDENTITY CARDS
// ============================================================================
// The photograph and what the office adds to it. Two reads, on purpose: the
// list comes from a view that leaves the photographs behind (three hundred of
// them is tens of megabytes), and a card comes whole only when the designer or a
// print run names the holders it wants.

interface IdCardRow {
  id: string;
  holder_type: string;
  holder_ref: string;
  holder_name: string | null;
  photo?: string | null;
  photo_zoom: number | string | null;
  photo_x: number | string | null;
  photo_y: number | string | null;
  layout: string | null;
  theme: string | null;
  card_no: string | null;
  blood_group: string | null;
  issued_on: string | null;
  expires_on: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  back_notes: string | null;
  show_back: boolean | null;
  updated_at: string | null;
  updated_by: string | null;
  has_photo?: boolean | null;
}

function toIdCardRecord(row: IdCardRow): IdCardRecord {
  const photo = row.photo ?? "";
  return {
    id: row.id,
    holderType: row.holder_type === "staff" ? "staff" : "student",
    holderRef: row.holder_ref,
    holderName: row.holder_name ?? "",
    photo,
    photoZoom: Number(row.photo_zoom) || 1,
    photoX: Number(row.photo_x) || 0,
    photoY: Number(row.photo_y) || 0,
    layout: (ID_CARD_LAYOUTS.some((option) => option.key === row.layout) ? row.layout : "portrait") as IdCardRecord["layout"],
    theme: (ID_CARD_THEMES.some((option) => option.key === row.theme) ? row.theme : "royal") as IdCardRecord["theme"],
    cardNo: row.card_no ?? "",
    bloodGroup: row.blood_group ?? "",
    issuedOn: row.issued_on ?? "",
    expiresOn: row.expires_on ?? "",
    emergencyName: row.emergency_name ?? "",
    emergencyPhone: row.emergency_phone ?? "",
    backNotes: row.back_notes ?? "",
    showBack: row.show_back !== false,
    hasPhoto: row.has_photo ?? photo !== "",
    updatedBy: row.updated_by ?? "",
    updatedAt: row.updated_at ?? null,
  };
}

/** Every card on file, without the photographs. */
export async function fetchIdCardIndexFromSupabase(): Promise<IdCardRecord[] | null> {
  const { rows, reason } = await readList<IdCardRow>("/api/id-cards");
  if (reason) {
    reportSyncFailure(`The identity cards could not be loaded: ${reason}.`);
    return null;
  }
  return (rows ?? []).map(toIdCardRecord);
}

/** The named cards, whole. A print run asks for exactly the holders it prints. */
export async function fetchIdCardsFromSupabase(
  holderType: IdCardHolderType,
  refs: string[]
): Promise<{ cards: IdCardRecord[]; reason: string | null }> {
  if (refs.length === 0) return { cards: [], reason: null };
  const params = new URLSearchParams({ holderType });
  for (const ref of refs) params.append("holderRef", ref);
  const { rows, reason } = await readList<IdCardRow>(`/api/id-cards?${params.toString()}`);
  if (reason) {
    reportSyncFailure(`The identity cards could not be loaded: ${reason}.`);
    return { cards: [], reason };
  }
  return { cards: (rows ?? []).map(toIdCardRecord), reason: null };
}

/**
 * Files one card and hands back the row the school's records now hold, so the
 * designer shows the server's own answer rather than the copy it sent.
 */
export async function saveIdCardOnServer(
  card: IdCardInput
): Promise<{ ok: boolean; reason: string | null; saved: IdCardRecord | null }> {
  let reason: string | null = null;
  let saved: IdCardRecord | null = null;
  try {
    const response = await fetch("/api/id-cards", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as { data?: IdCardRow[] } | null;
      const row = payload?.data?.[0];
      if (row) saved = toIdCardRecord({ ...row, photo: card.photo });
    } else {
      reason = await serverReason(response);
    }
  } catch (error) {
    console.warn("API /api/id-cards write failed", error);
    reason = "the portal server did not answer";
  }

  if (reason) {
    reportSyncFailure(`The identity card for ${card.holderName || card.holderRef} was NOT filed on the school's records: ${reason}.`);
    return { ok: false, reason, saved: null };
  }
  reportSyncSaved(`Identity card for ${card.holderName || card.holderRef} filed on the school's records.`);
  return { ok: true, reason: null, saved };
}

export async function removeIdCardsOnServer(
  refs: { holderType: IdCardHolderType; holderRef: string }[]
): Promise<{ ok: boolean; reason: string | null; removed: number }> {
  if (refs.length === 0) return { ok: true, reason: null, removed: 0 };
  try {
    const response = await fetch("/api/id-cards", {
      method: "DELETE",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refs }),
    });
    if (!response.ok) {
      const reason = await serverReason(response);
      reportSyncFailure(`The identity card was NOT withdrawn from the school's records: ${reason}.`);
      return { ok: false, reason, removed: 0 };
    }
    const payload = (await response.json().catch(() => null)) as { data?: { removed?: number } } | null;
    // The server counts the rows it actually deleted. A card that was only ever
    // designed on this machine has no row, and saying it was withdrawn would be
    // a claim about a record that never existed.
    const removed = payload?.data?.removed ?? 0;
    reportSyncSaved(
      removed === 0
        ? "No card for that holder was on the school's records, so nothing was withdrawn."
        : `${removed === 1 ? "Identity card" : `${removed} identity cards`} withdrawn from the school's records.`
    );
    return { ok: true, reason: null, removed };
  } catch (error) {
    console.warn("API /api/id-cards delete failed", error);
    const reason = "the portal server did not answer";
    reportSyncFailure(`The identity card was NOT withdrawn from the school's records: ${reason}.`);
    return { ok: false, reason, removed: 0 };
  }
}
