import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { guardianScope } from "@/lib/auth/guardian-links";
import { PAYMENT_CHANNELS } from "@/lib/fee-billing";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Same two roles that may change the fee schedule at all
// (isActionAuthorized("EDIT_FEES")) — the bursary, and the principal.
const TAKE_PAYMENT = ["SUPER_ADMIN", "ACCOUNTANT"] as const;
const READ_RECEIPTS = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS", "STUDENT_PARENT"] as const;
// Only staff may ask for everybody's receipts at once. A parent can still read
// the receipts of the pupils linked to their own login, one pupil at a time.
const READ_WHOLE_LEDGER = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS"] as const;

const SQL_FILE = "supabase/operations_state.sql";

const RECEIPT_SELECT =
  "ref, amount, payment_channel, fee_type, bank_reference, received_by, created_at, status, session, term, admission_no, student_name, invoices!invoice_id(invoice_no, class_name, amount_billed, amount_paid, payment_status)";

/**
 * Receipts already filed — one pupil's, or the whole bursary ledger.
 *
 * A family that lost its slip, and a bursary checking what it handed out, both
 * need the receipt number the server issued — not a fresh figure made up on the
 * screen. The Transactions screen used to build its "verified ledger" out of the
 * invoice list, inventing a reference, a channel and a Confirmed stamp for every
 * bill; this returns the rows that were actually written when money was received.
 * A parent is limited to the pupils linked to their own login.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const admissionNo = params.get("admission_no")?.trim() ?? "";

  const access = await requireRoleSession(admissionNo ? READ_RECEIPTS : READ_WHOLE_LEDGER);
  if (access.denied) return access.denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let query = supabase
    .from("transactions")
    .select(RECEIPT_SELECT)
    .order("created_at", { ascending: false })
    .limit(admissionNo ? 50 : 300);

  if (admissionNo) {
    const scope = await guardianScope(access.session);
    if (scope.error) {
      return NextResponse.json({ success: false, error: `The pupil links could not be read: ${scope.error}.` }, { status: 502 });
    }
    const admissionKey = admissionNo.toUpperCase();
    if (scope.admissionNos !== null && !scope.admissionNos.some((no) => no.toUpperCase() === admissionKey)) {
      return NextResponse.json(
        { success: false, error: "No pupil linked to this login is billed under that admission number." },
        { status: 403 }
      );
    }
    query = query.eq("admission_no", admissionNo);
  } else {
    // The ledger is read a session and term at a time; mixing terms in one total
    // is how a "this term collected" figure ends up counting last year's money.
    const session = params.get("session")?.trim();
    const term = params.get("term")?.trim();
    if (session) query = query.eq("session", session);
    if (term) query = query.eq("term", term);
  }

  const { data, error } = await query;

  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

type InvoiceRecord = {
  id: string;
  student_name: string;
  admission_no: string;
  class_name: string;
  session: string;
  term: string;
  amount_billed: number;
  amount_paid: number;
};

/**
 * Takes one fee payment against one invoice.
 *
 * A payment used to be a single number changed on the invoice plus a green
 * message on the screen: who received it, how, and against which bank teller
 * went nowhere, so the money counted as collected could not be traced back to a
 * person. Every accepted payment now files a receipt row next to the balance it
 * changed, and the receipt number is what the family is given.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(TAKE_PAYMENT);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as {
    invoice_no?: unknown;
    amount?: unknown;
    payment_channel?: unknown;
    bank_reference?: unknown;
    fee_type?: unknown;
  };

  const invoiceNo = typeof sent.invoice_no === "string" ? sent.invoice_no.trim() : "";
  if (!invoiceNo) {
    return NextResponse.json({ success: false, error: "Say which invoice the money was paid against." }, { status: 400 });
  }

  const amount = typeof sent.amount === "number" && Number.isFinite(sent.amount) ? Math.round(sent.amount) : NaN;
  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: "The amount received must be a number above zero." }, { status: 400 });
  }

  const channel = typeof sent.payment_channel === "string" ? sent.payment_channel.trim() : "";
  if (!(PAYMENT_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json(
      { success: false, error: `The payment method must be one of: ${PAYMENT_CHANNELS.join(", ")}.` },
      { status: 400 }
    );
  }

  const bankReference =
    typeof sent.bank_reference === "string" ? sent.bank_reference.trim().slice(0, 150) : "";
  const feeType =
    typeof sent.fee_type === "string" && sent.fee_type.trim() ? sent.fee_type.trim().slice(0, 100) : "Tuition Fee";

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: found, error: readError } = await supabase
    .from("invoices")
    .select("id, student_name, admission_no, class_name, session, term, amount_billed, amount_paid")
    .eq("invoice_no", invoiceNo)
    .maybeSingle();

  if (readError) {
    const setup = databaseSetupRequired(readError, "supabase/schema.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }
  if (!found) {
    return NextResponse.json(
      { success: false, error: `No invoice numbered ${invoiceNo} is on the school's records, so the money has nowhere to be credited.` },
      { status: 404 }
    );
  }

  const invoice = {
    ...found,
    amount_billed: Number(found.amount_billed) || 0,
    amount_paid: Number(found.amount_paid) || 0,
  } as InvoiceRecord;

  const outstanding = invoice.amount_billed - invoice.amount_paid;
  if (outstanding <= 0) {
    return NextResponse.json(
      { success: false, error: `${invoice.student_name}'s invoice is already fully cleared — nothing more is owed on it.` },
      { status: 409 }
    );
  }
  if (amount > outstanding) {
    return NextResponse.json(
      { success: false, error: `₦${amount.toLocaleString()} is more than the ₦${outstanding.toLocaleString()} still owed by ${invoice.student_name}.` },
      { status: 400 }
    );
  }

  const newPaid = invoice.amount_paid + amount;
  const paymentDate = new Date().toISOString().slice(0, 10);
  const status = newPaid >= invoice.amount_billed ? "Paid" : "Partial";

  // The receipt is filed first. If the balance cannot then be moved, the receipt
  // is taken back out, so the school is never left with a paper payment against
  // an unchanged debt — or a reduced debt with no receipt behind it.
  const receiptNumber = `RCA-PAY-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: receipt, error: receiptError } = await supabase
    .from("transactions")
    .insert({
      ref: receiptNumber,
      invoice_id: invoice.id,
      student_name: invoice.student_name,
      admission_no: invoice.admission_no,
      fee_type: feeType,
      amount,
      payment_channel: channel,
      status: "Confirmed",
      bank_reference: bankReference,
      received_by: access.session.username,
      session: invoice.session,
      term: invoice.term,
    })
    .select("ref, amount, payment_channel, fee_type, bank_reference, received_by, created_at")
    .maybeSingle();

  if (receiptError) {
    const setup = databaseSetupRequired(receiptError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: receiptError.message }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: newPaid,
      payment_status: status,
      last_payment_date: paymentDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  if (updateError) {
    if (receipt) {
      await supabase.from("transactions").delete().eq("ref", receiptNumber);
    }
    const setup = databaseSetupRequired(updateError, "supabase/schema.sql");
    if (setup) return setup;
    return NextResponse.json(
      {
        success: false,
        error: `The balance on ${invoiceNo} could not be updated (${updateError.message}), so the receipt was withdrawn. No payment was recorded.`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      receipt,
      invoice: {
        id: invoice.id,
        invoice_no: invoiceNo,
        amount_paid: newPaid,
        amount_billed: invoice.amount_billed,
        payment_status: status,
        last_payment_date: paymentDate,
      },
    },
  });
}
