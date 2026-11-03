import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Invoices carry every family's balances, so a parent is not on this list: the
// route has no per-child filter yet. Giving STUDENT_PARENT access here would
// expose the whole school's finances.
const READ_INVOICES = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS"] as const;
const WRITE_INVOICES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

type InvoicePayload = {
  invoice_no?: string;
  admission_no?: string;
  student_name?: string;
  class_name?: string;
  session?: string;
  term?: string;
  amount_billed?: number;
  amount_paid?: number;
  payment_status?: string;
  last_payment_date?: string;
};

function sanitizeInvoice(raw: InvoicePayload) {
  if (!raw || typeof raw !== "object") return null;
  const invoiceNo = typeof raw.invoice_no === "string" ? raw.invoice_no.trim() : "";
  const studentName = typeof raw.student_name === "string" ? raw.student_name.trim() : "";
  const admissionNo = typeof raw.admission_no === "string" ? raw.admission_no.trim() : "";
  if (!invoiceNo || !studentName || !admissionNo) return null;
  const amount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    invoice_no: invoiceNo,
    admission_no: admissionNo,
    student_name: studentName,
    class_name: typeof raw.class_name === "string" ? raw.class_name : "",
    session: typeof raw.session === "string" && raw.session ? raw.session : "2025/2026",
    term: typeof raw.term === "string" && raw.term ? raw.term : "First Term",
    amount_billed: amount(raw.amount_billed),
    amount_paid: amount(raw.amount_paid),
    payment_status: typeof raw.payment_status === "string" && raw.payment_status ? raw.payment_status : "Unpaid",
    last_payment_date: typeof raw.last_payment_date === "string" && raw.last_payment_date ? raw.last_payment_date : null,
  };
}

export async function GET() {
  const denied = await requireRole(READ_INVOICES);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const denied = await requireRole(WRITE_INVOICES);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length > 500) {
    return NextResponse.json({ success: false, error: "Too many invoices in one submission (max 500)." }, { status: 400 });
  }

  const invoices = list.map((item) => sanitizeInvoice(item as InvoicePayload));
  if (invoices.some((invoice) => invoice === null)) {
    return NextResponse.json({ success: false, error: "Every invoice needs invoice_no, admission_no and student_name." }, { status: 400 });
  }
  const rows = invoices as NonNullable<ReturnType<typeof sanitizeInvoice>>[];

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // invoices.student_id is NOT NULL, and the browser only knows admission
  // numbers, so the id is resolved here rather than trusted from the client.
  const admissionNumbers = Array.from(new Set(rows.map((row) => row.admission_no)));
  const { data: students, error: lookupError } = await supabase
    .from("students")
    .select("id, admission_no")
    .in("admission_no", admissionNumbers);

  if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });

  const idByAdmission = new Map((students ?? []).map((student) => [String(student.admission_no).toUpperCase(), String(student.id)]));
  const unknown = admissionNumbers.filter((number) => !idByAdmission.has(number.toUpperCase()));
  if (unknown.length > 0) {
    return NextResponse.json(
      { success: false, error: `No student on file for ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? `, +${unknown.length - 5} more` : ""}. Enrol the student before invoicing.` },
      { status: 404 }
    );
  }

  // invoice_no is UNIQUE. A submission that reuses a number already filed for a
  // different pupil would silently rewrite that family's balance, so a number
  // may only move to another student if nothing is on file for it yet.
  const { data: onFile, error: onFileError } = await supabase
    .from("invoices")
    .select("invoice_no, admission_no")
    .in("invoice_no", Array.from(new Set(rows.map((row) => row.invoice_no))));
  if (onFileError) return NextResponse.json({ success: false, error: onFileError.message }, { status: 502 });

  const ownerByInvoiceNo = new Map(
    (onFile ?? []).map((invoice) => [String(invoice.invoice_no).toUpperCase(), String(invoice.admission_no).toUpperCase()])
  );
  const reassigned = rows.filter((row) => {
    const owner = ownerByInvoiceNo.get(row.invoice_no.toUpperCase());
    return owner !== undefined && owner !== row.admission_no.toUpperCase();
  });
  if (reassigned.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Invoice number ${reassigned.slice(0, 3).map((row) => row.invoice_no).join(", ")} is already filed for another student. Generate a new invoice number.`,
      },
      { status: 409 }
    );
  }

  const { error: saveError } = await supabase
    .from("invoices")
    .upsert(
      rows.map((row) => ({ ...row, student_id: idByAdmission.get(row.admission_no.toUpperCase()) })),
      { onConflict: "invoice_no" }
    );
  if (saveError) return NextResponse.json({ success: false, error: saveError.message }, { status: 502 });

  return NextResponse.json({ success: true, data: { saved: rows.length } });
}
