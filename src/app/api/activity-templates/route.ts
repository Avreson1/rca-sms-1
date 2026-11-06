import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/calendar.sql";

// A blueprint names a budget and a coordinator, and only the calendar screen
// uses it — a screen the setup prefix already denies to teachers, bursars and
// families. So this serves the two roles that may open it, plus the QA login.
const READ_TEMPLATES = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;
const WRITE_TEMPLATES = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORIES = ["Academic", "Sports", "Cultural", "Excursion", "Administrative", "Club"] as const;

// The column, the max it holds, and how the screen labels it, so a field that
// does not fit is named in the words the person typed it in. The title is
// checked on its own above them because it is the one field a blueprint cannot
// be filed without.
const FIELDS = [
  { column: "target_section", sent: "targetSection", max: 160, label: "Target section" },
  { column: "coordinator", sent: "coordinator", max: 255, label: "Coordinator" },
  { column: "venue", sent: "venue", max: 255, label: "Venue" },
  { column: "budget", sent: "budget", max: 60, label: "Budget" },
  { column: "objectives", sent: "objectives", max: 4000, label: "Objectives" },
] as const;

type Column = (typeof FIELDS)[number]["column"];

type TemplatePayload = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  defaultDurationDays?: unknown;
  duration_days?: unknown;
};

type TemplateRow = {
  id: string;
  title: string;
  category: string;
  target_section: string;
  coordinator: string;
  venue: string;
  budget: string;
  objectives: string;
  duration_days: number;
  updated_at: string | null;
};

/** The blueprints the school wrote for itself, newest first. */
export async function GET() {
  const denied = await requireRole(READ_TEMPLATES);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("activity_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data ?? []) as TemplateRow[] });
}

/**
 * Files an activity blueprint on the school's records.
 *
 * Every field except the title is allowed to arrive empty, and empty is kept
 * empty. The screen used to fill a gap with "Unassigned", "Main Campus Hall" or
 * "₦0", which turned a blank into a decision the school never made — and a
 * budget of ₦0 reads as an approved free event.
 *
 * A title already on the list is refused rather than written over: this screen
 * corrects a blueprint by removing it and filing it again, so a request cannot
 * quietly replace what a colleague is looking at.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_TEMPLATES);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No activity template was sent." }, { status: 400 });
  }
  if (list.length > 100) {
    return NextResponse.json(
      { success: false, error: "Too many activity templates in one submission (max 100)." },
      { status: 400 }
    );
  }

  const rows: (Omit<TemplateRow, "id" | "updated_at"> & { id: string })[] = [];

  for (const [index, item] of (list as TemplatePayload[]).entries()) {
    const where = list.length > 1 ? `Template ${index + 1}` : "This template";
    const sent = item as Record<string, unknown>;

    const title = typeof sent.title === "string" ? sent.title.trim() : "";
    if (title.length < 3) {
      return NextResponse.json(
        { success: false, error: `${where} needs a title — an event name the office would recognise on a plan.` },
        { status: 400 }
      );
    }
    if (title.length > 255) {
      return NextResponse.json(
        { success: false, error: `${where}: the title is ${title.length} characters and the school's records hold 255. Shorten it to the name of the event.` },
        { status: 400 }
      );
    }

    const columns = {} as Record<Column, string>;
    for (const field of FIELDS) {
      const value = typeof sent[field.sent] === "string" ? (sent[field.sent] as string).trim() : "";
      if (value.length > field.max) {
        return NextResponse.json(
          {
            success: false,
            error: `“${title.slice(0, 40)}”: ${field.label} is ${value.length} characters and the school's records hold ${field.max}. Shorten it to what the plan actually says.`,
          },
          { status: 400 }
        );
      }
      columns[field.column] = value;
    }

    const category = typeof item?.category === "string" ? item.category.trim() : "";
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `“${title.slice(0, 40)}” has a category the template list does not use: ${category || "(none)"}. Use ${CATEGORIES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const days = Number(item?.defaultDurationDays ?? item?.duration_days);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return NextResponse.json(
        {
          success: false,
          error: `“${title.slice(0, 40)}” is planned to run ${item?.defaultDurationDays ?? item?.duration_days ?? "(nothing)"} days. A blueprint lasts between 1 and 30.`,
        },
        { status: 400 }
      );
    }

    const sentId = typeof item?.id === "string" ? item.id.trim() : "";
    rows.push({
      // A browser id (`act-1730…`) is not a row id, so it is dropped and the
      // title decides which blueprint on the school's list this one belongs to.
      id: UUID_PATTERN.test(sentId) ? sentId : "",
      title,
      category,
      target_section: columns.target_section,
      coordinator: columns.coordinator,
      venue: columns.venue,
      budget: columns.budget,
      objectives: columns.objectives,
      duration_days: days,
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: TemplateRow[] = [];
  for (const row of rows) {
    const { id, ...columns } = row;
    const at = new Date().toISOString();
    const who = access.session.username;
    const stamped = { ...columns, updated_at: at, updated_by: who };
    const query = id
      ? supabase.from("activity_templates").update(stamped).eq("id", id)
      : supabase
          .from("activity_templates")
          .insert({ ...stamped, created_at: at, created_by: who });

    const { data, error } = await query.select("*");
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        return NextResponse.json(
          {
            success: false,
            error: `A blueprint called “${columns.title.slice(0, 40)}” is already on the school's list. Correct that one instead of filing a second.`,
          },
          { status: 409 }
        );
      }
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as TemplateRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Removes blueprints from the school's list.
 *
 * A milestone already scheduled from one of these keeps its own words — the
 * template is copied into the calendar, not pointed at — so this does not reach
 * into the calendar and cannot orphan a published date.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_TEMPLATES);
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
      {
        success: false,
        error: "No template on this device has a record on the school's list, so nothing was removed. Reload the page.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("activity_templates")
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
