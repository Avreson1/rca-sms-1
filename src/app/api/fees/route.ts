import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Matches isActionAuthorized("EDIT_FEES") in src/lib/rbac.ts — the same two
// roles the staff register's "Manage Fees & Invoices" permission stands for.
const WRITE_FEES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;
const READ_FEES = ["SUPER_ADMIN", "ACCOUNTANT", "TESTERS"] as const;

const SQL_FILE = "supabase/operations_state.sql";

const CATEGORIES = ["Tuition", "Levy", "Examination", "Laboratory", "Extracurricular"] as const;

interface FeePayload {
  name?: unknown;
  category?: unknown;
  applicable_class?: unknown;
  amount?: unknown;
  is_mandatory?: unknown;
}

type FeeRow = Record<string, string | number | boolean | null>;

/**
 * The school's fee schedule.
 *
 * Until now this list only existed inside the browser that typed it, but its
 * amounts are added together and written into the invoices table — a record a
 * family is actually charged from. The bursar's machine therefore decided what
 * every other machine billed, with nothing on the school's records to show where
 * the figure came from. Both halves of that are on the server now.
 */
export async function GET(request: Request) {
  const denied = await requireRole(READ_FEES);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const params = new URL(request.url).searchParams;
  let query = supabase.from("fee_components").select("*").order("category").order("name");

  const session = params.get("session")?.trim();
  const term = params.get("term")?.trim();
  if (session) query = query.eq("session", session);
  if (term) query = query.eq("term", term);

  const { data, error } = await query;
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

/**
 * Saves fee components for the session and term the school is currently in.
 *
 * The session and term are read from the school's own settings rather than
 * taken from the request: a device with a stale term would otherwise file this
 * term's prices under last term's name, and the invoice built from them would
 * not match any schedule anybody can find.
 *
 * Re-sending a component with the same name, target class, session and term
 * updates the amount instead of duplicating the line, so the office can correct
 * a price without deleting the bill it already went out on.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_FEES);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No fee component was sent." }, { status: 400 });
  }
  if (list.length > 100) {
    return NextResponse.json({ success: false, error: "Too many fee components in one submission (max 100)." }, { status: 400 });
  }

  const rows: FeeRow[] = [];
  for (const item of list as FeePayload[]) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (!name) {
      return NextResponse.json({ success: false, error: "Every fee item needs a name parents can read on the bill." }, { status: 400 });
    }
    if (name.length > 255) {
      return NextResponse.json({ success: false, error: `Fee name “${name.slice(0, 30)}…” is longer than 255 characters.` }, { status: 400 });
    }

    const category = typeof item?.category === "string" ? item.category : "";
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { success: false, error: `“${name}” has a category the billing screens do not know: ${category || "(none)"}. Use one of: ${CATEGORIES.join(", ")}.` },
        { status: 400 }
      );
    }

    const amount = typeof item?.amount === "number" && Number.isFinite(item.amount) ? item.amount : NaN;
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ success: false, error: `“${name}” needs a money amount in naira, not "${item?.amount}".` }, { status: 400 });
    }
    // 12 digits, NUMERIC(12,2) on the table. Sending past that would be a
    // database error the office cannot act on.
    if (amount > 999_999_999) {
      return NextResponse.json({ success: false, error: `“${name}” is too large to bill (${amount}).` }, { status: 400 });
    }

    const applicableClass =
      typeof item?.applicable_class === "string" && item.applicable_class.trim()
        ? item.applicable_class.trim().slice(0, 100)
        : "All Classes";

    rows.push({
      name,
      category,
      applicable_class: applicableClass,
      amount,
      is_mandatory: item?.is_mandatory !== false,
      updated_by: access.session?.username ?? "",
      updated_at: new Date().toISOString(),
    });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: config, error: configError } = await supabase
    .from("school_config")
    .select("current_session, current_term")
    .eq("id", 1)
    .maybeSingle();
  if (configError) {
    const setup = databaseSetupRequired(configError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: configError.message }, { status: 502 });
  }
  if (!config) {
    return NextResponse.json(
      {
        success: false,
        error: `The portal does not know which session and term to file these fees under. Run ${SQL_FILE} in the Supabase SQL editor, then set the current session and term in Settings.`,
      },
      { status: 503 }
    );
  }

  const stamped = rows.map((row) => ({ ...row, session: config.current_session, term: config.current_term }));

  const { data: saved, error: saveError } = await supabase
    .from("fee_components")
    .upsert(stamped, { onConflict: "name,applicable_class,session,term" })
    .select("id, name, category, applicable_class, amount, is_mandatory, session, term");
  if (saveError) {
    const setup = databaseSetupRequired(saveError, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: saveError.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: saved ?? [] });
}

/**
 * Removes fee items from the schedule.
 *
 * Invoices already filed keep the amount they were billed with — deleting the
 * item here does not re-bill anybody, and the screen says so.
 */
export async function DELETE(request: Request) {
  const denied = await requireRole(WRITE_FEES);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { ids?: unknown };
  const ids = Array.isArray(sent.ids) ? sent.ids.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: "No fee item was named to remove." }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ success: false, error: "Too many fee items in one removal (max 100)." }, { status: 400 });
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (ids.some((id) => !UUID.test(id))) {
    return NextResponse.json({ success: false, error: "A fee item on this device has no record on the school's schedule, so nothing was removed. Reload the page." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase.from("fee_components").delete().in("id", ids).select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { removed: removed?.length ?? 0 } });
}
