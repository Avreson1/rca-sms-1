import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { databaseSetupRequired, databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDutyTimeWindow, isValidDutyDate, schoolToday, DUTY_TIME_WINDOWS } from "@/lib/duties/roster";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/staff_duties.sql";

/**
 * The columns this migration owns, including the two added to somebody else's
 * table. Without them a Postgres "column does not exist" is passed through as a
 * 502, which reads like a fault in the portal to the one person who can fix it by
 * running the file.
 */
const ROSTER_OWNED = /staff_duties|designation|standing_duties/i;

/**
 * The two roles that may say who is on duty. Assigning a duty is an act of the
 * office, the same pair that files the timetable — and it is deliberately not
 * open to a teacher, because "who covers the gate" is a decision that has to be
 * visible to the person it lands on, not something a colleague can move.
 */
const ASSIGN_DUTIES = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

/**
 * The staff roles may read a roster, but not all of it: a teacher or bursar sees
 * their own rows, and only the office roles see the school's.
 *
 * A parent login is not here. It holds no staff record, so the honest answer it
 * would get is "you have no duties" — a sentence a guardian has no reason to be
 * shown, and no way to interpret.
 */
const READ_DUTIES = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "TESTERS"] as const;

/**
 * The roles that read the school's whole roster rather than their own rows.
 *
 * QA testers are here and not in ASSIGN_DUTIES: a tester has to be able to see
 * what the office filed in order to check it, and their own login holds no staff
 * record, so scoping them to "their duties" would show them an empty panel and
 * hide the very thing under test.
 */
const SCHOOL_WIDE_READ = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;

const MAX_RANGE_DAYS = 31;

const COLUMNS =
  "id, duty_date, staff_id, staff_name, designation, duty, time_window, location, notes, assigned_by, created_at, updated_at";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

interface DutyRow {
  id: string;
  duty_date: string;
  staff_id: string;
  staff_name: string;
  designation: string;
  duty: string;
  time_window: string;
  location: string;
  notes: string;
  assigned_by: string;
}

interface StaffRow {
  staff_id: string;
  full_name: string;
  designation: string;
  status: string;
}

/** The date window a read was asked for, or the refusal that explains why not. */
function readRange(params: URLSearchParams): { from: string; to: string } | NextResponse {
  const requestedFrom = text(params.get("from"), 10);
  const requestedTo = text(params.get("to"), 10);
  const single = text(params.get("date"), 10);

  const from = requestedFrom || single || schoolToday();
  const to = requestedTo || single || from;

  for (const [label, value] of [["from", from], ["to", to]] as const) {
    if (!isValidDutyDate(value)) {
      return NextResponse.json(
        {
          success: false,
          error: `Say which date to read the roster for, written as YYYY-MM-DD. The ${label} date "${value}" is not one — and a duty filed against a date the school cannot read is a duty nobody turns up to.`,
        },
        { status: 400 }
      );
    }
  }

  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (span < 0) {
    return NextResponse.json(
      { success: false, error: `The roster cannot be read backwards: ${to} comes before ${from}.` },
      { status: 400 }
    );
  }
  if (span + 1 > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { success: false, error: `A roster is read a stretch at a time — ${Math.round(span) + 1} days is more than the ${MAX_RANGE_DAYS} this portal prints.` },
      { status: 400 }
    );
  }

  return { from, to };
}

/**
 * Which staff number belongs to the person holding this session.
 *
 * The number comes from the signed cookie. A duty read that took it from the
 * request body would let any browser ask for anyone's roster by naming them,
 * which is the same one-way door the presence heartbeat used to have.
 */
async function callerStaffId(
  supabase: SupabaseClient,
  session: { staffId: string; username: string }
): Promise<{ staffId: string; staff: StaffRow | null } | { error: string }> {
  const fromSession = text(session.staffId, 50);
  if (fromSession) {
    const { data, error } = await supabase
      .from("staff")
      .select("staff_id, full_name, designation, status")
      .eq("staff_id", fromSession)
      .maybeSingle<StaffRow>();
    // A register that could not be read is not a register that does not hold this
    // person. Swallowing the error here would answer "no staff record is linked to
    // this login" — a sentence that sends a teacher to the office for a network blip.
    if (error) return { error: error.message };
    return { staffId: fromSession, staff: data };
  }

  // Logins created before the staff number was stored on them, and the school's
  // own admin login, are found by the username the register already holds.
  const { data, error } = await supabase
    .from("staff")
    .select("staff_id, full_name, designation, status")
    .ilike("username", session.username)
    .maybeSingle<StaffRow>();

  if (error) return { error: error.message };
  if (!data) return { staffId: "", staff: null };
  return { staffId: data.staff_id, staff: data };
}

/**
 * The roster, for one date or a stretch of them.
 *
 * Office roles get the whole school; everyone else gets their own rows and is
 * told in the response that this is what they got. An empty list is printed as
 * "nothing is filed", never as a duty nobody assigned.
 */
export async function GET(request: Request) {
  const access = await requireRoleSession(READ_DUTIES);
  if (access.denied) return access.denied;
  const session = access.session;

  const range = readRange(new URL(request.url).searchParams);
  if (range instanceof NextResponse) return range;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const schoolWide = (SCHOOL_WIDE_READ as readonly string[]).includes(session.role);
  let person: { staffId: string; staff: StaffRow | null } | { error: string } | null = null;
  if (!schoolWide) {
    person = await callerStaffId(supabase, session);
    if ("error" in person) {
      return databaseSetupRequired({ message: person.error }, SQL_FILE, ROSTER_OWNED)
        ?? NextResponse.json({ success: false, error: person.error }, { status: 502 });
    }
  }

  let query = supabase
    .from("staff_duties")
    .select(COLUMNS)
    .gte("duty_date", range.from)
    .lte("duty_date", range.to)
    .order("duty_date", { ascending: true })
    .order("time_window", { ascending: true })
    .order("staff_name", { ascending: true })
    .limit(2000);

  if (!schoolWide) {
    if (!person || "error" in person || !person.staffId) {
      return NextResponse.json({
        success: true,
        data: {
          scope: "self",
          from: range.from,
          to: range.to,
          today: schoolToday(),
          duties: [],
          staffRecordLinked: false,
          note: "No staff record on the register is linked to this login, so there is no duty roster for it to read. Duties are filed against a staff number.",
        },
      });
    }
    query = query.eq("staff_id", person.staffId);
  }

  const { data, error } = await query;
  if (error) {
    return databaseSetupRequired(error, SQL_FILE, ROSTER_OWNED)
      ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: {
      scope: schoolWide ? "school" : "self",
      from: range.from,
      to: range.to,
      today: schoolToday(),
      duties: (data as DutyRow[]) ?? [],
      staffRecordLinked: true,
      windows: DUTY_TIME_WINDOWS,
    },
  });
}

/**
 * Files one duty against one real staff record, for one named date.
 *
 * The person has to be on the register first: a duty filed against a typed name
 * is how two spellings of one teacher end up both rostered for the gate, and how
 * a member who left last term keeps being shown a duty they will never see. The
 * name and designation printed on the row are copied from the register at the
 * moment of filing, so the roster still says who it meant after that record is
 * corrected or removed.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(ASSIGN_DUTIES);
  if (access.denied) return access.denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const date = text(body.date ?? body.duty_date, 10);
  if (!isValidDutyDate(date)) {
    return NextResponse.json(
      {
        success: false,
        error: `A duty is filed against a date the school can read, written as YYYY-MM-DD. "${date || "Nothing was given"}" is not one, and nobody could check whether they turned up for it.`,
      },
      { status: 400 }
    );
  }

  const staffId = text(body.staffId ?? body.staff_id, 50);
  if (!staffId) {
    return NextResponse.json(
      { success: false, error: "Say which member of staff this duty falls to — pick them from the register." },
      { status: 400 }
    );
  }

  const duty = text(body.duty, 120);
  if (duty.length < 2) {
    return NextResponse.json(
      { success: false, error: "Write the duty out, e.g. \"Gate Duty\". A duty of one or two letters is not something a colleague can act on." },
      { status: 400 }
    );
  }

  const timeWindow = text(body.timeWindow ?? body.time_window, 40);
  if (!isDutyTimeWindow(timeWindow)) {
    return NextResponse.json(
      {
        success: false,
        error: `"${timeWindow || "No time of day"}" is not one of the parts of the school day a duty is filed against (${DUTY_TIME_WINDOWS.join(", ")}). A duty with no time of day is a duty nobody knows when to keep.`,
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: member, error: lookupError } = await supabase
    .from("staff")
    .select("staff_id, full_name, designation, status")
    .eq("staff_id", staffId)
    .maybeSingle<StaffRow>();

  if (lookupError) {
    return databaseSetupRequired(lookupError, SQL_FILE, ROSTER_OWNED)
      ?? NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  }

  if (!member) {
    return NextResponse.json(
      {
        success: false,
        error: `No staff record on the register with ID ${staffId}. Register the person in Operations → Staff first; a duty cannot be filed against a name the school does not hold.`,
      },
      { status: 404 }
    );
  }

  if (member.status === "Suspended") {
    return NextResponse.json(
      {
        success: false,
        error: `${member.full_name} is marked Suspended on the register, and their login is closed — a duty filed here would never reach them. Reinstate the record or roster someone else.`,
      },
      { status: 409 }
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("staff_duties")
    .select("id, duty")
    .eq("duty_date", date)
    .eq("staff_id", member.staff_id)
    .eq("time_window", timeWindow)
    .maybeSingle<{ id: string; duty: string }>();

  if (existingError) {
    return databaseSetupRequired(existingError, SQL_FILE, ROSTER_OWNED)
      ?? NextResponse.json({ success: false, error: existingError.message }, { status: 502 });
  }

  const { data: saved, error: saveError } = await supabase
    .from("staff_duties")
    .upsert(
      {
        duty_date: date,
        staff_id: member.staff_id,
        staff_name: member.full_name,
        designation: member.designation || "",
        duty,
        time_window: timeWindow,
        location: text(body.location, 120),
        notes: text(body.notes, 500),
        // Whose login filed it, from the signed session and never from the body.
        assigned_by: access.session.username,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "duty_date,staff_id,time_window", ignoreDuplicates: false }
    )
    .select(COLUMNS)
    .single<DutyRow>();

  if (saveError) {
    return databaseSetupRequired(saveError, SQL_FILE, ROSTER_OWNED)
      ?? NextResponse.json({ success: false, error: saveError.message }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    data: {
      duty: saved,
      filedBy: access.session.username,
      replaced: existing ? existing.duty : null,
      // The register's own status travels with the answer, so a duty filed for a
      // member marked On Leave is shown as such instead of surprising the office
      // later when nobody appears at the gate.
      staffStatus: member.status,
      staffDesignation: member.designation || "",
    },
  });
}

/**
 * Takes one duty off the roster.
 *
 * By id, and only by id: an office that meant to move a duty must not be able to
 * clear a whole day with a half-filled form.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(ASSIGN_DUTIES);
  if (access.denied) return access.denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = text(body.id, 60);
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Say which duty to take off the roster. Nothing was removed." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("staff_duties")
    .delete()
    .eq("id", id)
    .select("id, duty_date, staff_name, duty, time_window");

  if (error) {
    return databaseSetupRequired(error, SQL_FILE, ROSTER_OWNED)
      ?? NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  if (!removed || removed.length === 0) {
    return NextResponse.json(
      { success: false, error: "That duty was not on the roster, so nothing was removed. It may have been taken off by another machine — refresh the week." },
      { status: 404 }
    );
  }

  const row = removed[0];
  return NextResponse.json({
    success: true,
    data: {
      removed: removed.length,
      duty: row.duty,
      dutyDate: row.duty_date,
      staffName: row.staff_name,
      timeWindow: row.time_window,
      removedBy: access.session.username,
    },
  });
}
