import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Matches isActionAuthorized("PUBLISH_RESULTS") in src/lib/rbac.ts.
const PUBLISH_RESULTS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;
// Read is for the screens that gate a card on a release row: the score card
// (teacher, parent, office) and the two office screens. A bursar opens neither —
// /accounts, /setup/fees and the ledger are all the money screens — so the money
// role is not on this list.
const READ_ALL = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "STUDENT_PARENT", "TESTERS"] as const;

const TERMS = ["First Term", "Second Term", "Third Term"] as const;

interface PublicationRow {
  session: string;
  term: string;
  class_name: string;
  published_by: string;
  published_at: string;
}

/**
 * Which classes have had their results released for a session and term.
 *
 * A parent's report card is gated on a row from this table: the family sees the
 * card when the exam office has published it, not when the office's own browser
 * remembers pressing a button. That distinction is the whole point of the
 * screen — until now "Publish All Class Results" wrote to localStorage in the
 * headteacher's tab and nothing on any other device changed.
 */
export async function GET(request: Request) {
  const denied = await requireRole(READ_ALL);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const session = params.get("session")?.trim();
  const term = params.get("term")?.trim();
  if (!session || !term) {
    return NextResponse.json(
      { success: false, error: "Ask for one session and one term, for example ?session=2025/2026&term=First Term." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let query = supabase
    .from("result_publications")
    .select("session, term, class_name, published_by, published_at")
    .eq("session", session)
    .eq("term", term);

  const className = params.get("class_name")?.trim();
  if (className) query = query.eq("class_name", className);

  const { data, error } = await query.order("class_name");
  if (error) {
    const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data as PublicationRow[]) ?? [] });
}

/**
 * Releases or withdraws the results of one or more classes for a session/term.
 *
 * Withdrawing deletes the row rather than storing `published: false`, so "not
 * released" is the absence of a record instead of a flag that some screen could
 * read and ignore.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(PUBLISH_RESULTS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "Send { session, term, classes, published }." }, { status: 400 });
  }
  const sent = body as Record<string, unknown>;

  const session = typeof sent.session === "string" ? sent.session.trim() : "";
  const term = typeof sent.term === "string" ? sent.term.trim() : "";
  if (!/^\d{4}[\/\s-]+\d{4}$/.test(session)) {
    return NextResponse.json({ success: false, error: `The academic session must look like 2025/2026, not "${session}".` }, { status: 400 });
  }
  if (!(TERMS as readonly string[]).includes(term)) {
    return NextResponse.json({ success: false, error: `The term must be one of: ${TERMS.join(", ")}.` }, { status: 400 });
  }
  if (typeof sent.published !== "boolean") {
    return NextResponse.json({ success: false, error: "Say whether the results are being published (true) or withdrawn (false)." }, { status: 400 });
  }
  const published = sent.published;

  if (!Array.isArray(sent.classes) || sent.classes.length === 0) {
    return NextResponse.json({ success: false, error: "Name at least one class, as { classes: [\"Primary 1\"] }." }, { status: 400 });
  }
  const classes: string[] = [];
  for (const item of sent.classes) {
    if (typeof item !== "string" || !item.trim()) {
      return NextResponse.json({ success: false, error: "Every class name must be written text." }, { status: 400 });
    }
    const name = item.trim();
    if (name.length > 100) {
      return NextResponse.json({ success: false, error: `"${name}" is longer than a class name can be.` }, { status: 400 });
    }
    if (!classes.includes(name)) classes.push(name);
  }
  if (classes.length > 200) {
    return NextResponse.json({ success: false, error: "That is more classes than this portal knows how to publish at once." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  if (published) {
    const now = new Date().toISOString();
    const rows = classes.map((class_name) => ({
      session,
      term,
      class_name,
      published_by: access.session.username,
      published_at: now,
    }));
    const { error } = await supabase.from("result_publications").upsert(rows, { onConflict: "session,term,class_name" });
    if (error) {
      const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
  } else {
    const { error } = await supabase
      .from("result_publications")
      .delete()
      .eq("session", session)
      .eq("term", term)
      .in("class_name", classes);
    if (error) {
      const setup = databaseSetupRequired(error, "supabase/operations_state.sql");
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true, data: { session, term, classes, published } });
}
