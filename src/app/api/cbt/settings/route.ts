import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/cbt.sql";

// Every signed-in role reads the switch, including the family login. It is the
// one CBT value a candidate has to be told the truth about: if the school shut
// the module, the machine sitting in front of a pupil must say so.
const READ_SWITCH = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
// Moving it is the office's decision, the same two roles that set the papers.
const WRITE_SWITCH = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const MODE_MAX = 60;
const WINDOW_MAX = 200;
const MESSAGE_MAX = 1000;

/**
 * The one row that says whether the CBT module is open, what it is being used
 * for, and what a candidate is told when it is shut.
 *
 * Until now this lived in one browser's localStorage under the name "the
 * school's CBT configuration". Flipping it in Settings changed nothing on any
 * other machine, so a term could be examined while the office believed the
 * module was closed — or the reverse. The row is the answer now.
 */
export async function GET() {
  const denied = await requireRole(READ_SWITCH);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("cbt_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error:
          "There is no CBT settings row yet. Run supabase/cbt.sql in the Supabase SQL editor; it creates the row and starts the module closed.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, data });
}

/**
 * Opens or shuts the module, and says why.
 *
 * The name of whoever moved it comes from the signed session, never from the
 * request body, because the screen prints it as the person a school can ask.
 */
export async function PUT(request: Request) {
  const access = await requireRoleSession(WRITE_SWITCH);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as {
    is_open?: unknown;
    active_exam_mode?: unknown;
    scheduled_window?: unknown;
    offline_message?: unknown;
  };

  if (typeof sent.is_open !== "boolean") {
    return NextResponse.json(
      { success: false, error: "The switch has to be answered as open or closed — a saved setting cannot be \"maybe\"." },
      { status: 400 }
    );
  }

  const mode = typeof sent.active_exam_mode === "string" ? sent.active_exam_mode.trim() : "";
  const window = typeof sent.scheduled_window === "string" ? sent.scheduled_window.trim() : "";
  const message = typeof sent.offline_message === "string" ? sent.offline_message.trim() : "";

  if (mode.length > MODE_MAX) {
    return NextResponse.json(
      { success: false, error: `The exam mode name is longer than ${MODE_MAX} characters; a candidate reads it off a screen, not a form.` },
      { status: 400 }
    );
  }

  // Opening the module without saying what it is for is the state that gets a
  // school into trouble: papers start being sat with no announced purpose.
  if (sent.is_open && mode.length === 0) {
    return NextResponse.json(
      { success: false, error: "The module cannot be opened without naming what it is being used for — Terminal Examination, CAT, mock practice. Candidates are shown this." },
      { status: 400 }
    );
  }
  if (sent.is_open && window.length === 0) {
    return NextResponse.json(
      { success: false, error: "An open exam module needs the hours it runs in, so a family can tell whether a sitting should have been available. \"Monday - Friday (8:00 AM - 2:00 PM)\"." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const row = {
    id: true,
    is_open: sent.is_open,
    active_exam_mode: mode.slice(0, MODE_MAX),
    scheduled_window: window.slice(0, WINDOW_MAX),
    offline_message: message.slice(0, MESSAGE_MAX),
    updated_by: access.session.fullName || access.session.username,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("cbt_settings").upsert(row, { onConflict: "id" }).select("*").maybeSingle();
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json(
      { success: false, error: "The switch was not saved: the school's CBT settings row could not be written back to." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, data });
}
