import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import {
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  normalizeTransactionId,
  type ExistingTransactionMatch,
} from "@/lib/payment-verification";

export const dynamic = "force-dynamic";

const BURSARY_ROLES = ["SUPER_ADMIN", "ACCOUNTANT", "EXAM_OFFICER", "TESTERS"] as const;

/**
 * Real-time transaction ID cross-check API.
 * Quickly determines whether a given bank transaction ID or teller reference
 * has already been logged on the school's payment records.
 */
export async function GET(request: Request) {
  const denied = await requireRole(BURSARY_ROLES);
  if (denied) return denied;

  const url = new URL(request.url);
  const rawId = url.searchParams.get("transactionId") || "";
  const normalizedId = normalizeTransactionId(rawId);

  if (!normalizedId) {
    return NextResponse.json(
      { success: false, error: "transactionId query parameter is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // 1. Check primary payment_records table
  const { data: recordData, error: recordError } = await supabase
    .from("payment_records")
    .select("transaction_id, student_name, class_name, admission_no, amount_paid, payee_name, narration, payment_date, recorded_by, payment_method")
    .eq("normalized_transaction_id", normalizedId)
    .maybeSingle();

  if (recordError && recordError.code !== "42P01") {
    // 42P01 is table_not_found; ignore if table is pending migration and check transactions table
    return NextResponse.json({ success: false, error: recordError.message }, { status: 502 });
  }

  if (recordData) {
    const match: ExistingTransactionMatch = {
      transactionId: recordData.transaction_id,
      studentName: recordData.student_name,
      className: recordData.class_name,
      admissionNo: recordData.admission_no,
      amountPaid: Number(recordData.amount_paid) || 0,
      payeeName: recordData.payee_name,
      narration: recordData.narration,
      paymentDate: recordData.payment_date,
      recordedBy: recordData.recorded_by,
      paymentMethod: recordData.payment_method,
    };
    return NextResponse.json({ success: true, exists: true, match, normalizedId });
  }

  // 2. Cross-check existing transactions table (fallback & compatibility)
  const { data: txData, error: txError } = await supabase
    .from("transactions")
    .select("ref, student_name, admission_no, amount, payment_channel, created_at, received_by, bank_reference")
    .or(`bank_reference.ilike.${normalizedId},ref.ilike.${normalizedId}`)
    .maybeSingle();

  if (txError) {
    return NextResponse.json({ success: false, error: txError.message }, { status: 502 });
  }

  if (txData) {
    const match: ExistingTransactionMatch = {
      transactionId: txData.bank_reference || txData.ref,
      studentName: txData.student_name,
      className: "Filed Record",
      admissionNo: txData.admission_no,
      amountPaid: Number(txData.amount) || 0,
      payeeName: txData.student_name,
      narration: `Legacy Transaction Record (${txData.payment_channel})`,
      paymentDate: txData.created_at ? txData.created_at.split("T")[0] : "",
      recordedBy: txData.received_by || "Bursary Staff",
      paymentMethod: txData.payment_channel,
    };
    return NextResponse.json({ success: true, exists: true, match, normalizedId });
  }

  return NextResponse.json({
    success: true,
    exists: false,
    normalizedId,
  });
}
