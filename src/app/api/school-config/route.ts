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

  const update: Record<string, string> = {};
  for (const [column, label, max] of textFields) {
    const raw = sent[column];
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json({ success: false, error: `The ${label} cannot be empty.` }, { status: 400 });
    }
    const value = raw.trim();
    if (value.length > max) {
      return NextResponse.json({ success: false, error: `The ${label} is longer than ${max} characters.` }, { status: 400 });
    }
    update[column] = value;
  }

  if (!(TERMS as readonly string[]).includes(update.current_term)) {
    return NextResponse.json(
      { success: false, error: `The current term must be one of: ${TERMS.join(", ")}.` },
      { status: 400 }
    );
  }
  // "2025/2026", or the local habit "2025 - 2026". A session typed as free text
  // would never match the session on any filed mark, and every screen would show
  // an empty result book.
  if (!/^\d{4}[\/\s-]+\d{4}$/.test(update.current_session)) {
    return NextResponse.json(
      { success: false, error: `The academic session must look like 2025/2026, not "${update.current_session}".` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { error } = await supabase
    .from("school_config")
    .update({ ...update, updated_by: session.username, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: update });
}
