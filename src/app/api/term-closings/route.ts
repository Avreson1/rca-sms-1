import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The office that approves a result release is the office that signs a term off.
const EDIT_SETUP = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;
const READ_ALL = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;

const TERMS = ["First Term", "Second Term", "Third Term"] as const;

function scopeProblem(session: unknown, term: unknown): string | null {
  if (typeof session !== "string" || !/^\d{4}[\/\s-]+\d{4}$/.test(session.trim())) {
    return `The academic session must look like 2025/2026, not "${String(session ?? "")}".`;
  }
  if (typeof term !== "string" || !(TERMS as readonly string[]).includes(term.trim())) {
    return `The term must be one of: ${TERMS.join(", ")}.`;
  }
  return null;
}

/**
 * Which terms the school has signed off. Every screen that writes a mark asks
 * this before it writes, so a closed term cannot be edited — the reason closing
 * a term is worth doing at all.
 */
export async function GET() {
  const denied = await requireRole(READ_ALL);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("closed_terms")
    .select("session, term, closed_by, closed_at")
    .order("session", { ascending: false })
    .order("closed_at", { ascending: false });

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

/**
 * Signs one session/term off. Nothing is deleted and nothing is copied: the
 * marks stay where they are so last term's cards still print, and the only
 * change is that they can no longer be altered.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(EDIT_SETUP);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "Send { session, term }." }, { status: 400 });
  }
  const sent = body as Record<string, unknown>;

  const problem = scopeProblem(sent.session, sent.term);
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

  const session = (sent.session as string).trim();
  const term = (sent.term as string).trim();

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { error } = await supabase
    .from("closed_terms")
    .upsert(
      { session, term, closed_by: access.session.username, closed_at: new Date().toISOString() },
      { onConflict: "session,term" }
    );

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { session, term, closedBy: access.session.username } });
}

/**
 * Opens a closed term again. Without this, one mistyped click would lock the
 * office out of a term's marks for good, and the only repair would be a member
 * of staff with SQL access.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(EDIT_SETUP);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "Send { session, term }." }, { status: 400 });
  }
  const sent = body as Record<string, unknown>;

  const problem = scopeProblem(sent.session, sent.term);
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

  const session = (sent.session as string).trim();
  const term = (sent.term as string).trim();

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("closed_terms")
    .delete()
    .match({ session, term })
    .select("session, term");

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: `${term} of ${session} is not closed, so there is nothing to re-open.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { session, term, reopenedBy: access.session.username } });
}
