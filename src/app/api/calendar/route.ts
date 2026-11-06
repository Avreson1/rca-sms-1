import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { validateScope } from "@/lib/supabase/term-scope";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/calendar.sql";

// Only two roles may open the calendar screen at all — the setup prefix is
// denied to teachers, bursars and families — so this route serves those two and
// the QA login, rather than leaving a whole-school list wide open because the
// dates themselves are not secret. When a family-facing calendar is built, the
// read list is the line that widens.
//
// Fixing a term's dates is the office's act, and it is the same two roles that
// file the class arms and the papers.
const READ_CALENDAR = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;
const WRITE_CALENDAR = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The first four are what the Add Milestone form offers. The rest only reach the
// calendar when a Sports, Cultural, Excursion or Club activity template is
// scheduled into a term — and a sports day filed as "Academic" is what the
// printed circular would then get wrong.
const CATEGORIES = [
  "Academic",
  "Examination",
  "Holiday",
  "Administrative",
  "Sports",
  "Cultural",
  "Excursion",
  "Club",
] as const;

const STATUSES = ["Upcoming", "Current", "Completed"] as const;

const TITLE_MAX = 255;
const DATE_MAX = 120;
const DESCRIPTION_MAX = 4000;

type EventPayload = {
  id?: unknown;
  session?: unknown;
  term?: unknown;
  title?: unknown;
  dateRange?: unknown;
  date_range?: unknown;
  description?: unknown;
  category?: unknown;
  status?: unknown;
};

type EventRow = {
  id: string;
  session: string;
  term: string;
  title: string;
  date_range: string;
  description: string;
  category: string;
  status: string;
  updated_at: string | null;
};

/**
 * The milestones on the school's records.
 *
 * `?session=` and `?term=` narrow the list; sent without them the whole calendar
 * comes back, which is what the calendar screen wants — it has to be able to say
 * how many milestones belong to a session other than the one the school is in.
 */
export async function GET(request: Request) {
  const denied = await requireRole(READ_CALENDAR);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  const session = params.get("session")?.trim() ?? "";
  const term = params.get("term")?.trim() ?? "";

  let query = supabase.from("school_calendar_events").select("*");
  if (session) query = query.eq("session", session);
  if (term) query = query.eq("term", term);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data ?? []) as EventRow[] });
}

/**
 * Files one milestone, or the starting outline the screen offers, on the school's
 * records.
 *
 * A row is corrected only when the request names the row the server gave it. A
 * milestone with a browser-invented id is filed as a new row, and if that title
 * already stands in the session and term the request refuses rather than
 * overwriting what a colleague corrected — the clerk is told to reload and edit
 * the row that is there.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_CALENDAR);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No calendar milestone was sent." }, { status: 400 });
  }
  if (list.length > 100) {
    return NextResponse.json(
      { success: false, error: "Too many milestones in one submission (max 100)." },
      { status: 400 }
    );
  }

  const rows: Omit<EventRow, "id" | "updated_at">[] = [];
  const ids: string[] = [];

  for (const [index, item] of (list as EventPayload[]).entries()) {
    const where = list.length > 1 ? `Milestone ${index + 1}` : "This milestone";

    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (title.length < 3) {
      return NextResponse.json(
        { success: false, error: `${where} needs a title a parent would recognise on the circular (at least three characters).` },
        { status: 400 }
      );
    }

    const session = typeof item?.session === "string" ? item.session.trim() : "";
    const term = typeof item?.term === "string" ? item.term.trim() : "";
    // No silent default: a milestone filed into the term the request forgot to
    // name is a date the office never set, in a term that may have closed.
    const scopeProblem = validateScope(session, term);
    if (scopeProblem) return scopeProblem;

    const category = typeof item?.category === "string" ? item.category.trim() : "Academic";
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { success: false, error: `“${title.slice(0, 40)}” has a category the calendar does not use: ${category || "(none)"}.` },
        { status: 400 }
      );
    }

    const status = typeof item?.status === "string" ? item.status.trim() : "Upcoming";
    if (!(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { success: false, error: `“${title.slice(0, 40)}” has a status no calendar row carries: ${status || "(none)"}. Use ${STATUSES.join(", ")}.` },
        { status: 400 }
      );
    }

    const dateRange =
      typeof item?.dateRange === "string"
        ? item.dateRange.trim()
        : typeof item?.date_range === "string"
          ? item.date_range.trim()
          : "";

    const sentId = typeof item?.id === "string" ? item.id.trim() : "";
    const id = UUID_PATTERN.test(sentId) ? sentId : "";
    // A browser id (`cal-1730…`) is not a row id, so it is dropped and this
    // milestone is filed as a new row. The unique title then decides whether the
    // school already has it; editing a row needs the id this route handed out.
    ids.push(id);

    rows.push({
      session,
      term,
      title: title.slice(0, TITLE_MAX),
      // Blank stays blank. "TBD" used to be typed here by the portal, which made
      // an undecided date look like a decision somebody had recorded.
      date_range: dateRange.slice(0, DATE_MAX),
      description:
        typeof item?.description === "string" ? item.description.trim().slice(0, DESCRIPTION_MAX) : "",
      category,
      status,
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: EventRow[] = [];
  for (const [index, columns] of rows.entries()) {
    const at = new Date().toISOString();
    const who = access.session.username;
    const stamped = { ...columns, updated_at: at, updated_by: who };
    const id = ids[index];
    const query = id
      ? supabase.from("school_calendar_events").update(stamped).eq("id", id)
      : supabase
          .from("school_calendar_events")
          .insert({ ...stamped, created_at: at, created_by: who });

    const { data, error } = await query.select("*");
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return NextResponse.json(
          {
            success: false,
            error: `The school already has a milestone called “${columns.title.slice(0, 40)}” in ${columns.term} of ${columns.session}. Correct that one instead of filing a second.`,
          },
          { status: 409 }
        );
      }
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as EventRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Moves one milestone between Upcoming, Active and Completed.
 *
 * This is the only edit the calendar screen makes in place, and it is the one
 * that has to reach the school's records rather than the browser: "Active Now"
 * is what a colleague reads as the term's current stage.
 */
export async function PATCH(request: Request) {
  const access = await requireRoleSession(WRITE_CALENDAR);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { id?: unknown; status?: unknown };
  const id = typeof sent.id === "string" ? sent.id.trim() : "";
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { success: false, error: "That milestone has no record on the school's calendar — it was added on this browser before the calendar moved here. Reload the page and set the status again." },
      { status: 400 }
    );
  }

  const status = typeof sent.status === "string" ? sent.status.trim() : "";
  if (!(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { success: false, error: `A calendar row is ${STATUSES.join(", ")}, or it is not a row. "${status || "(none)"}" is none of those.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("school_calendar_events")
    .update({ status, updated_at: new Date().toISOString(), updated_by: access.session.username })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "No milestone with that record on the school's calendar, so nothing was changed." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

/**
 * Removes milestones from the school's calendar.
 *
 * Taking one away is a real loss — the date a school published and then deleted
 * cannot be recovered from here — so this does no archiving and the screen says
 * so before it asks.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_CALENDAR);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { ids?: unknown };
  const ids = Array.isArray(sent.ids)
    ? sent.ids.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id.trim())).map((id) => id.trim())
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "No milestone on this device has a record on the school's calendar, so nothing was removed. Reload the page." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("school_calendar_events")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { removed: removed?.length ?? 0 } });
}
