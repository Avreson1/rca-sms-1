import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Only the service role key can read the school tables: row-level security
 * denies the anon key on every one of them, so falling back to it turned a
 * missing variable into a 502 "permission denied" that looked like a database
 * fault. A server route without the service key is not configured, full stop.
 */
export function missingDatabaseConfig(): string | null {
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) return "NEXT_PUBLIC_SUPABASE_URL is not set on the server";
  if (!supabaseServiceKey) return "SUPABASE_SERVICE_ROLE_KEY is not set on the server";
  return null;
}

export const isSupabaseServerConfigured = missingDatabaseConfig() === null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseServerConfigured) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * A route that cannot reach the database says which setting is missing, because
 * the person on the other end of the screen is the one who has to set it.
 */
export function databaseUnavailable() {
  return NextResponse.json(
    {
      success: false,
      error: "Database not configured",
      reason: missingDatabaseConfig() ?? "the database is unavailable",
    },
    { status: 503 }
  );
}

/**
 * "relation does not exist" and "permission denied for table" both mean the same
 * thing to the person watching a spinner: the portal is broken. They usually
 * mean one SQL file has not been run on this project yet. Hand back the file
 * name so the office can fix it in the Supabase editor, instead of a database
 * message that reads like a fault in the code.
 */
export function databaseSetupRequired(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  sqlFile: string
): NextResponse | null {
  if (!error) return null;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`;
  const tableMissing =
    error.code === "42P01" || // undefined_table, straight from Postgres
    error.code === "PGRST205" || // the REST layer's own "not in the schema cache"
    /could not find the table|relation .* does not exist|schema cache/i.test(text);
  const grantMissing =
    error.code === "42501" || /permission denied for table|insufficient privilege/i.test(text);
  if (!tableMissing && !grantMissing) return null;

  return NextResponse.json(
    {
      success: false,
      error: `This part of the database is not set up on this project yet. Run ${sqlFile} in the Supabase SQL editor, then try again.`,
      reason: error.message ?? error.code ?? "missing table or grant",
    },
    { status: 503 }
  );
}
