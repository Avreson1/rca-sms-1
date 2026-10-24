import { getSupabaseBrowserClient } from "./client";
import {
  StudentRecord,
  StaffRecord,
  InvoiceRecord,
  CBTQuestionRecord,
  TierGradingConfig,
} from "../realtime-store";

// ============================================================================
// 1. STUDENTS SERVICE
// ============================================================================
export async function fetchStudentsFromSupabase(): Promise<StudentRecord[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      admission_no,
      full_name,
      gender,
      class_name,
      house,
      guardian_name,
      guardian_phone,
      fee_status,
      ca_scores (
        test1,
        test2,
        project,
        mid_term,
        exam
      )
    `)
    .order("admission_no", { ascending: true });

  if (error || !data) {
    console.warn("Supabase fetchStudents warning:", error?.message);
    return null;
  }

  return data.map((item: any) => {
    const ca = Array.isArray(item.ca_scores) && item.ca_scores.length > 0
      ? item.ca_scores[0]
      : { test1: 0, test2: 0, project: 0, mid_term: 0, exam: 0 };

    return {
      id: item.id,
      admissionNo: item.admission_no,
      fullName: item.full_name,
      gender: item.gender || "Male",
      className: item.class_name,
      house: item.house || "Sapphire (Blue)",
      guardianName: item.guardian_name || undefined,
      guardianPhone: item.guardian_phone || undefined,
      feeStatus: item.fee_status || "Outstanding",
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
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase.from("students").insert({
    admission_no: student.admissionNo,
    full_name: student.fullName,
    gender: student.gender,
    class_name: student.className,
    house: student.house,
    guardian_name: student.guardianName || null,
    guardian_phone: student.guardianPhone || null,
    fee_status: student.feeStatus,
  });

  return !error;
}

export async function bulkInsertStudentsToSupabase(students: StudentRecord[]): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || students.length === 0) return false;

  const rows = students.map((s) => ({
    admission_no: s.admissionNo,
    full_name: s.fullName,
    gender: s.gender,
    class_name: s.className,
    house: s.house,
    guardian_name: s.guardianName || null,
    guardian_phone: s.guardianPhone || null,
    fee_status: s.feeStatus,
  }));

  const { error } = await supabase.from("students").upsert(rows, { onConflict: "admission_no" });
  return !error;
}

// ============================================================================
// 2. STAFF SERVICE
// ============================================================================
export async function fetchStaffFromSupabase(): Promise<StaffRecord[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .order("staff_id", { ascending: true });

  if (error || !data) {
    console.warn("Supabase fetchStaff warning:", error?.message);
    return null;
  }

  return data.map((item: any) => ({
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
  }));
}

export async function insertStaffToSupabase(staff: StaffRecord): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase.from("staff").insert({
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

  return !error;
}

// ============================================================================
// 3. INVOICES SERVICE
// ============================================================================
export async function fetchInvoicesFromSupabase(): Promise<InvoiceRecord[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return null;

  return data.map((inv: any) => ({
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
// 4. GRADING TIERS SERVICE
// ============================================================================
export async function fetchGradingTiersFromSupabase(): Promise<Record<string, TierGradingConfig> | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("grading_tiers").select("*");
  if (error || !data || data.length === 0) return null;

  const map: Record<string, TierGradingConfig> = {};
  data.forEach((row: any) => {
    map[row.id] = {
      tierKey: row.id,
      tierTitle: row.tier_title,
      applicableClasses: row.applicable_classes || [],
      description: row.description || "",
      brackets: row.brackets || [],
    };
  });

  return map;
}
