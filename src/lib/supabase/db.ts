import { getSupabaseBrowserClient } from "./client";
import {
  StudentRecord,
  StaffRecord,
  InvoiceRecord,
  TierGradingConfig,
  GradeBracket,
} from "../realtime-store";

// All reads and writes go through the authenticated API routes. The browser no
// longer touches student/staff/invoice tables directly, so the anon key cannot
// be used to read or modify personal data.

interface CaScoresRow {
  test1: number | null;
  test2: number | null;
  project: number | null;
  mid_term: number | null;
  exam: number | null;
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
  ca_scores?: CaScoresRow[] | null;
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
}

interface GradingTierRow {
  id: string;
  tier_title: string;
  applicable_classes: string[] | null;
  description: string | null;
  brackets: GradeBracket[] | null;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });

    if (!response.ok) {
      console.warn(`API ${path} responded with ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as { data?: T };
    return payload?.data ?? null;
  } catch (error) {
    console.warn(`API ${path} request failed`, error);
    return null;
  }
}

async function requestOk(path: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch (error) {
    console.warn(`API ${path} write failed`, error);
    return false;
  }
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
  const rows = await requestJson<StudentRow[]>("/api/students");
  if (!rows) return null;

  return rows.map((item) => {
    const ca =
      Array.isArray(item.ca_scores) && item.ca_scores.length > 0
        ? item.ca_scores[0]
        : { test1: 0, test2: 0, project: 0, mid_term: 0, exam: 0 };

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
      caScores: {
        test1: Number(ca.test1) || 0,
        test2: Number(ca.test2) || 0,
        project: Number(ca.project) || 0,
        midTerm: Number(ca.mid_term) || 0,
        exam: Number(ca.exam) || 0,
      },
    };
  });
}

export async function insertStudentToSupabase(student: StudentRecord): Promise<boolean> {
  return requestOk("/api/students", toStudentRow(student));
}

export async function bulkInsertStudentsToSupabase(students: StudentRecord[]): Promise<boolean> {
  if (students.length === 0) return false;
  return requestOk("/api/students", students.map(toStudentRow));
}

// ============================================================================
// 2. STAFF SERVICE
// ============================================================================
export async function fetchStaffFromSupabase(): Promise<StaffRecord[] | null> {
  const rows = await requestJson<StaffRow[]>("/api/staff");
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

export async function insertStaffToSupabase(staff: StaffRecord): Promise<boolean> {
  return requestOk("/api/staff", {
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
  });
}

// ============================================================================
// 3. INVOICES SERVICE
// ============================================================================
export async function fetchInvoicesFromSupabase(): Promise<InvoiceRecord[] | null> {
  const rows = await requestJson<InvoiceRow[]>("/api/invoices");
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
  }));
}

// ============================================================================
// 4. GRADING TIERS SERVICE (reference data — public read allowed by RLS)
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
