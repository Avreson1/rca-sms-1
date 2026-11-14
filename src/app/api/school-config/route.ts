import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Matches isActionAuthorized("EDIT_SETUP") in src/lib/rbac.ts: the office that
// sets the grading scales also says which term the portal is currently in.
const EDIT_SETUP = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

// Everything the screens may read. A parent needs the term printed on their
// child's card, and the card is rendered on their device.
const READ_ALL = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;

const TERMS = ["First Term", "Second Term", "Third Term"] as const;

/**
 * The one row that says what session and term the school is in, plus the
 * identity printed at the top of every report card.
 *
 * These values were a constant compiled into the code, so the End of Term
 * screen had nothing to advance and the Settings page discarded the name and
 * phone typed into it. That is why the portal is expected to hold them in the
 * database: machine A changes them, machine B shows the change.
 */
export async function GET() {
  const denied = await requireRole(READ_ALL);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("school_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error:
          "There is no school settings row yet. Run supabase/operations_state.sql in the Supabase SQL editor; it creates and seeds the row.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, data });
}

/**
 * Saves the school's identity, session and term.
 *
 * Nothing here is optional: a blank school name would print an empty header on
 * every card, and a term the portal does not know would make every "current
 * term" filter return no marks at all. Both are refused with the reason.
 */
export async function PUT(request: Request) {
  const access = await requireRoleSession(EDIT_SETUP);
  if (access.denied) return access.denied;
  const session = access.session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "Send the settings as an object." }, { status: 400 });
  }
  const sent = body as Record<string, unknown>;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // Load existing row so partial updates (e.g. from /setup/records-dossier) keep current values
  const { data: existingRow, error: fetchErr } = await supabase
    .from("school_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (fetchErr) {
    const setup = databaseSetupRequired(fetchErr, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 502 });
  }

  const textFields: Array<[string, string, number]> = [
    ["school_name", "school name", 255],
    ["short_name", "short name", 50],
    ["motto", "motto", 255],
    ["address", "address", 500],
    ["email", "email address", 255],
    ["phone", "phone number", 100],
    ["website", "website", 255],
    ["current_session", "academic session", 50],
    ["current_term", "current term", 50],
  ];

  const update: Record<string, unknown> = {};
  for (const [column, label, max] of textFields) {
    const raw = sent[column] ?? existingRow?.[column];
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json({ success: false, error: `The ${label} cannot be empty.` }, { status: 400 });
    }
    const value = raw.trim();
    if (value.length > max) {
      return NextResponse.json({ success: false, error: `The ${label} is longer than ${max} characters.` }, { status: 400 });
    }
    update[column] = value;
  }

  // Optional Additive Signatory & Authorization Fields (/setup/records-dossier)
  const optionalSignatoryFields: Array<[string, number]> = [
    ["primary_signatory_name", 255],
    ["primary_signatory_title", 255],
    ["primary_signature_url", 200000],
    ["secondary_signatory_name", 255],
    ["secondary_signatory_title", 255],
    ["secondary_signature_url", 200000],
    ["auth_footer_note", 1000],
  ];

  for (const [col, maxLen] of optionalSignatoryFields) {
    if (sent[col] !== undefined) {
      const val = typeof sent[col] === "string" ? (sent[col] as string).trim() : "";
      update[col] = val.slice(0, maxLen);
    }
  }

  const currentTerm = update.current_term as string;
  if (!(TERMS as readonly string[]).includes(currentTerm)) {
    return NextResponse.json(
      { success: false, error: `The current term must be one of: ${TERMS.join(", ")}.` },
      { status: 400 }
    );
  }

  const currentSession = update.current_session as string;
  if (!/^\d{4}[\/\s-]+\d{4}$/.test(currentSession)) {
    return NextResponse.json(
      { success: false, error: `The academic session must look like 2025/2026, not "${currentSession}".` },
      { status: 400 }
    );
  }

  let { error } = await supabase
    .from("school_config")
    .update({ ...update, updated_by: session.username, updated_at: new Date().toISOString() })
    .eq("id", 1);

  // If new columns are not yet in remote DB, fallback safely
  if (error && /primary_signatory|secondary_signatory|auth_footer/i.test(error.message)) {
    const fallbackUpdate = { ...update };
    for (const [col] of optionalSignatoryFields) {
      delete fallbackUpdate[col];
    }
    const retry = await supabase
      .from("school_config")
      .update({ ...fallbackUpdate, updated_by: session.username, updated_at: new Date().toISOString() })
      .eq("id", 1);
    error = retry.error;
  }

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: update });
}
