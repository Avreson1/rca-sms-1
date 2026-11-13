import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import {
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  normalizeTransactionId,
  calculatePaymentBalance,
  type PaymentInput,
} from "@/lib/payment-verification";

export const dynamic = "force-dynamic";

const BURSARY_ROLES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session")?.trim();
  const term = url.searchParams.get("term")?.trim();
  const studentId = url.searchParams.get("studentId")?.trim();

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let query = supabase
    .from("payment_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (session) query = query.eq("session", session);
  if (term) query = query.eq("term", term);
  if (studentId) query = query.eq("student_id", studentId);

  const { data, error } = await query.limit(100);
  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ success: true, data: [] });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const access = await requireRoleSession(BURSARY_ROLES);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body || {}) as PaymentInput;

  const rawTxId = input.transactionId?.trim();
  const normalizedTxId = normalizeTransactionId(rawTxId);
  const amountPaid = Number(input.amountPaid) || 0;
  const totalFeeExpected = Number(input.totalFeeExpected) || 0;
  const previouslyPaid = Number(input.previouslyPaid) || 0;
  const payeeName = input.payeeName?.trim();

  if (!rawTxId || normalizedTxId.length < 3) {
    return NextResponse.json(
      { success: false, error: "A valid transaction ID or bank reference (at least 3 characters) is required." },
      { status: 400 }
    );
  }

  if (amountPaid <= 0) {
    return NextResponse.json(
      { success: false, error: "Amount paid must be greater than zero." },
      { status: 400 }
    );
  }

  if (!payeeName) {
    return NextResponse.json(
      { success: false, error: "Payee / Depositor name is required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // 1. Enforce Uniqueness & Prevent Race Condition Duplicates
  const { data: existingTx } = await supabase
    .from("payment_records")
    .select("transaction_id, student_name, class_name, amount_paid, payee_name, payment_date")
    .eq("normalized_transaction_id", normalizedTxId)
    .maybeSingle();

  if (existingTx) {
    return NextResponse.json(
      {
        success: false,
        error: `Duplicate Transaction ID! Already logged on ${existingTx.payment_date} for ${existingTx.student_name} (${existingTx.class_name}) by ${existingTx.payee_name} (₦${Number(existingTx.amount_paid).toLocaleString()}).`,
        isDuplicate: true,
        match: existingTx,
      },
      { status: 409 }
    );
  }

  // 2. Compute Balance & Payment Type
  const { balanceRemaining, paymentType } = calculatePaymentBalance(
    totalFeeExpected,
    previouslyPaid,
    amountPaid
  );

  const paymentRecord = {
    student_id: input.studentId,
    student_name: input.studentName,
    admission_no: input.admissionNo,
    class_name: input.className,
    session: input.session || "2025/2026",
    term: input.term || "First Term",
    transaction_id: rawTxId,
    payment_type: paymentType,
    amount_paid: amountPaid,
    balance_remaining: balanceRemaining,
    total_fee_expected: totalFeeExpected,
    payee_name: payeeName,
    narration: input.narration?.trim() || "",
    payment_method: input.paymentMethod || "Bank Transfer",
    payment_date: input.paymentDate || new Date().toISOString().split("T")[0],
    recorded_by: access.session.username,
    verification_status: "VERIFIED",
  };

  // 3. Insert into payment_records
  const { data: insertedRecord, error: insertError } = await supabase
    .from("payment_records")
    .insert([paymentRecord])
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Transaction ID already exists in the database.", isDuplicate: true },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: insertError.message }, { status: 502 });
  }

  // 4. Update legacy transactions and invoices for backward compatibility
  const refCode = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  await supabase.from("transactions").insert([
    {
      ref: refCode,
      student_name: input.studentName,
      admission_no: input.admissionNo,
      fee_type: "School Fees",
      amount: amountPaid,
      payment_channel: input.paymentMethod || "Bank Transfer",
      status: "Confirmed",
      bank_reference: rawTxId,
      normalized_transaction_id: normalizedTxId,
      payee_name: payeeName,
      narration: input.narration || "",
      received_by: access.session.username,
      session: input.session || "2025/2026",
      term: input.term || "First Term",
    },
  ]);

  return NextResponse.json({
    success: true,
    data: insertedRecord,
    receipt: {
      ref: refCode,
      transactionId: rawTxId,
      amountPaid,
      balanceRemaining,
      paymentType,
    },
  });
}
