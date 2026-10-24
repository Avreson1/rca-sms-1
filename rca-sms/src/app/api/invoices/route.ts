import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

const INVOICE_FIELDS = ["invoice_no", "student_id", "student_name", "admission_no", "class_name", "session", "term", "amount_billed", "amount_paid", "payment_status", "last_payment_date"] as const;

export async function GET() {
  const auth = await requireRole(["SUPER_ADMIN", "ACCOUNTANT", "STUDENT_PARENT"]);
  if ("error" in auth) return auth.error;

  // RLS limits STUDENT_PARENT accounts to their own invoices.
  const { data, error } = await auth.supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: data.length, data });
}

export async function POST(request: Request) {
  const auth = await requireRole(["SUPER_ADMIN", "ACCOUNTANT"]);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid invoice payload" }, { status: 400 });
  }
  const record = Object.fromEntries(INVOICE_FIELDS.filter((k) => k in body).map((k) => [k, body[k]]));

  const { data, error } = await auth.supabase.from("invoices").insert(record).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: "Invoice created", data }, { status: 201 });
}
