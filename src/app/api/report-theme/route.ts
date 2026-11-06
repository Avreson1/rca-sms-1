import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/ca_structure_and_bulletin.sql";

// The theme is on the face of the card, and a family opens that card on the
// score-card screen, so every signed-in role reads it. Only the two roles that
// may open Setup → Report & Newsletter Templates change it.
const READ_THEME = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
const WRITE_THEME = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const THEMES = ["royal", "scheme2", "emerald", "burgundy", "gold", "slate"] as const;

type ThemeRow = {
  id: number;
  theme_key: string;
  updated_at: string | null;
  updated_by: string;
};

/** What the one write may contain: the scheme, and who and when filed it. */
type ThemeWrite = {
  id?: number;
  theme_key: string;
  created_at?: string;
  created_by?: string;
  updated_at: string;
  updated_by: string;
};

/** The school's card theme, or `data: null` when nobody has filed one yet. */
export async function GET() {
  const denied = await requireRole(READ_THEME);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("report_card_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: (data ?? null) as ThemeRow | null });
}

/**
 * Files the report card theme.
 *
 * One row per school, overwritten in full: a theme is not a list anybody
 * appends to, and there is no second answer to "what do our cards look like".
 * Choosing a scheme on the score-card screen for a print run does not come
 * through here — that is a choice about the sheets in the printer, and it leaves
 * the school's standing answer untouched.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_THEME);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { theme?: unknown; themeKey?: unknown; theme_key?: unknown };
  const theme = String(sent.theme ?? sent.themeKey ?? sent.theme_key ?? "").trim();
  if (!(THEMES as readonly string[]).includes(theme)) {
    return NextResponse.json(
      {
        success: false,
        error: `“${theme || "(none)"}” is not a scheme the school offers. Use ${THEMES.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const at = new Date().toISOString();
  const who = access.session.username;

  // The first write owns the row, so `created_by` names the person who chose the
  // school's theme rather than whoever last clicked Save.
  const { data: existing, error: readError } = await supabase
    .from("report_card_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();
  if (readError) {
    const setup = databaseSetupRequired(readError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: readError.message }, { status: 502 });
  }

  const payload: ThemeWrite = existing
    ? { theme_key: theme, updated_at: at, updated_by: who }
    : { id: 1, theme_key: theme, created_at: at, created_by: who, updated_at: at, updated_by: who };

  const { data, error } = await supabase
    .from("report_card_settings")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data });
}
