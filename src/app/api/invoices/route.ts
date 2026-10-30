import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoicePayload = {
  id?: string;
  invoice_no?: string;
  student_id?: string;
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
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined,
    invoice_no: invoiceNo,
    student_id: typeof raw.student_id === "string" && raw.student_id ? raw.student_id : null,
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
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const row = sanitizeInvoice(body as InvoicePayload);
  if (!row) {
    return NextResponse.json({ success: false, error: "Provide an invoice with invoice_no, admission_no and student_name." }, { status: 400 });
  }

  const { error } = await supabase.from("invoices").upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true });
}
