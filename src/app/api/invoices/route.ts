import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { guardianScope } from "@/lib/auth/guardian-links";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Invoices carry every family's balances, so a parent reaching this route is
// served only the invoices of the pupils linked to their login. Recording a
// payment stays with the bursary.
const READ_INVOICES = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS", "STUDENT_PARENT"] as const;
const WRITE_INVOICES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

type InvoicePayload = {
  invoice_no?: string;
  admission_no?: string;
  student_name?: string;
  class_name?: string;
  session?: string | null;
  term?: string | null;
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
    // Empty means "this device does not know which term it is billing"; the
    // school's own settings answer that below. It used to be a session string
    // compiled into the code, so a bill raised after the school moved on to the
    // next year was filed under 2025/2026 forever.
    session: typeof raw.session === "string" ? raw.session.trim() : "",
    term: typeof raw.term === "string" ? raw.term.trim() : "",
    amount_billed: amount(raw.amount_billed),
    amount_paid: amount(raw.amount_paid),
    payment_status: typeof raw.payment_status === "string" && raw.payment_status ? raw.payment_status : "Unpaid",
    last_payment_date: typeof raw.last_payment_date === "string" && raw.last_payment_date ? raw.last_payment_date : null,
  };
}

export async function GET() {
  const access = await requireRoleSession(READ_INVOICES);
  if (access.denied) return access.denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const scope = await guardianScope(access.session);
  if (scope.error) {
    return NextResponse.json(
      {
        success: false,
        error: `The guardian link table could not be read: ${scope.error}.`,
        reason: scope.error,
      },
      { status: 502 }
    );
  }
  if (scope.admissionNos !== null && scope.admissionNos.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No pupil is linked to this login yet, so there are no invoices to show. The school office links a parent login to its children in Settings → User Access.",
      },
      { status: 403 }
    );
  }

  let query = supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (scope.admissionNos) query = query.in("admission_no", scope.admissionNos);

  const { data, error } = await query;
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

  // An invoice with no session and term on it is a device that could not read
  // the school's settings. Filing it under the term the school itself declares
  // keeps the bills of a new term from being stamped with an old one.
  if (rows.some((row) => !row.session || !row.term)) {
    const { data: config, error: configError } = await supabase
      .from("school_config")
      .select("current_session, current_term")
      .eq("id", 1)
      .maybeSingle();
    if (configError) {
      const setup = databaseSetupRequired(configError, "supabase/operations_state.sql");
      if (setup) return setup;
      return NextResponse.json({ success: false, error: configError.message }, { status: 502 });
    }
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error:
            "These invoices have no session and term, and the portal cannot read the school's current ones. Run supabase/operations_state.sql, then set the session and term in Settings.",
        },
        { status: 503 }
      );
    }
    for (const row of rows) {
      row.session = row.session || config.current_session;
      row.term = row.term || config.current_term;
    }
  }

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
