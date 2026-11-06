import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { validateScope } from "@/lib/supabase/term-scope";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/ca_structure_and_bulletin.sql";

// The circular is the page that goes home with the child: it is printed on the
// back of every card on the score-card screen, which parents, teachers and the
// bursary all open. So every signed-in role reads it. Writing it is the office's
// act, and it is the same two roles that set up the card.
const READ_NEWSLETTER = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
const WRITE_NEWSLETTER = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

// The column, the field the screen sends, what the school calls it on the form,
// and the most it holds — so a refusal names the box in the words above it.
const FIELDS = [
  { column: "title", sent: "title", max: 160, label: "Bulletin title" },
  { column: "principal_name", sent: "principalName", max: 160, label: "Principal / signatory name" },
  { column: "principal_message", sent: "principalMessage", max: 4000, label: "Principal's address" },
  { column: "next_term_resumption", sent: "nextTermResumption", max: 160, label: "Next term resumption" },
  { column: "fee_policy_and_deadlines", sent: "feePolicyAndDeadlines", max: 4000, label: "Fee policy and deadlines" },
  { column: "bank_name", sent: "bankName", max: 120, label: "Bank name" },
  { column: "account_name", sent: "accountName", max: 160, label: "Account name" },
  { column: "account_number", sent: "accountNumber", max: 60, label: "Account number" },
  { column: "custom_notes", sent: "customNotes", max: 4000, label: "Special advisory" },
] as const;

type Column = (typeof FIELDS)[number]["column"];

const EVENT_MAX = 240;
const EVENTS_MAX = 40;

type BulletinRow = {
  id: string;
  session: string;
  term: string;
  title: string;
  principal_name: string;
  principal_message: string;
  next_term_resumption: string;
  events_and_highlights: string[];
  fee_policy_and_deadlines: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  custom_notes: string;
  updated_at: string | null;
  updated_by: string;
};

/**
 * The circulars the school has written, newest term first.
 *
 * `?session=` and `?term=` narrow it to the one a card is being printed for.
 * Sent without them the whole list comes back, which is what the editor needs so
 * it can show whether the term it is about to overwrite already has words.
 */
export async function GET(request: Request) {
  const denied = await requireRole(READ_NEWSLETTER);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  const session = params.get("session")?.trim() ?? "";
  const term = params.get("term")?.trim() ?? "";

  let query = supabase.from("terminal_newsletters").select("*");
  if (session) query = query.eq("session", session);
  if (term) query = query.eq("term", term);

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data ?? []) as BulletinRow[] });
}

/**
 * Files the circular for one session and term.
 *
 * Saving means "these are the words that go home at the end of this term", so a
 * second save by the office replaces the first — the record names who wrote it
 * and when, and the screen shows that before the form is opened. What it does not
 * do is fall back to another term's message: a card printed for Third Term reads
 * the row labelled Third Term, and if that row does not exist the card prints
 * "No newsletter has been filed for this term".
 *
 * Every field may arrive empty and empty is stored. A resumption date, a fee
 * deadline or a bank account that the school did not type is not a blank to be
 * filled in for them — families pay printed account numbers.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_NEWSLETTER);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as Record<string, unknown>;
  const bank = (sent.bankAccountDetails ?? {}) as Record<string, unknown>;

  const session = typeof sent.session === "string" ? sent.session.trim() : "";
  const term = typeof sent.term === "string" ? sent.term.trim() : "";
  const scopeProblem = validateScope(session, term);
  if (scopeProblem) return scopeProblem;

  const columns = {} as Record<Column, string>;
  for (const field of FIELDS) {
    const value = typeof sent[field.sent] === "string" ? (sent[field.sent] as string).trim() : "";
    if (value.length > field.max) {
      return NextResponse.json(
        {
          success: false,
          error: `${field.label} is ${value.length} characters and the school's records hold ${field.max}. Shorten it to what the circular actually says.`,
        },
        { status: 400 }
      );
    }
    columns[field.column] = value;
  }

  if (!Array.isArray(sent.eventsAndHighlights)) {
    return NextResponse.json(
      { success: false, error: "The key events must be sent as a list of lines, one event per line." },
      { status: 400 }
    );
  }
  if (sent.eventsAndHighlights.length > EVENTS_MAX) {
    return NextResponse.json(
      { success: false, error: `${sent.eventsAndHighlights.length} events were sent and a circular lists ${EVENTS_MAX}.` },
      { status: 400 }
    );
  }
  const highlights: string[] = [];
  for (const [index, event] of (sent.eventsAndHighlights as unknown[]).entries()) {
    if (typeof event !== "string") {
      return NextResponse.json(
        { success: false, error: `Event ${index + 1} is not a line of text, so it cannot be printed on the circular.` },
        { status: 400 }
      );
    }
    const line = event.trim();
    if (!line) continue;
    if (line.length > EVENT_MAX) {
      return NextResponse.json(
        { success: false, error: `Event ${index + 1} is ${line.length} characters long and one line of the circular holds ${EVENT_MAX}.` },
        { status: 400 }
      );
    }
    highlights.push(line);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const at = new Date().toISOString();
  const who = access.session.username;

  // `created_by` belongs to whoever wrote the term's circular first, so correcting
  // it later does not hand the authorship to the person who fixed a typo.
  const { data: existing, error: readError } = await supabase
    .from("terminal_newsletters")
    .select("id")
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();
  if (readError) {
    const setup = databaseSetupRequired(readError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }

  const payload = existing
    ? { ...columns, events_and_highlights: highlights, updated_at: at, updated_by: who }
    : {
        ...columns,
        session,
        term,
        events_and_highlights: highlights,
        created_at: at,
        created_by: who,
        updated_at: at,
        updated_by: who,
      };

  const { data, error } = await supabase
    .from("terminal_newsletters")
    .upsert(payload, { onConflict: "session,term" })
    .select("*");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data ?? []) as BulletinRow[] });
}
