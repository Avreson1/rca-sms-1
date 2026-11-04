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
