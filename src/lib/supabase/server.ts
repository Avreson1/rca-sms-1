import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Checks whether a given JWT string has an `iat` (issued-at) timestamp that is
 * in the future compared to the local system clock.
 */
export function inspectJwtClockSkew(token: string): { isFuture: boolean; diffSeconds: number; iat?: number } {
  if (!token || !token.includes(".")) return { isFuture: false, diffSeconds: 0 };
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      if (typeof payload.iat === "number") {
        const now = Math.floor(Date.now() / 1000);
        const diff = payload.iat - now;
        return { isFuture: diff > 0, diffSeconds: diff, iat: payload.iat };
      }
    }
  } catch {
    // Ignore non-standard tokens
  }
  return { isFuture: false, diffSeconds: 0 };
}

/**
 * Identifies errors caused by clock skew ("JWT issued at future" from PostgREST/Supabase).
 */
export function isJwtFutureError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${err.code ?? ""} ${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();
  return (
    text.includes("jwt issued at future") ||
    text.includes("issued at future") ||
    text.includes("jwtissuedatfuture") ||
    err.code === "PGRST301"
  );
}

/**
 * Executes a Supabase query with automatic single retry (default 1500ms delay)
 * when Postgres/PostgREST returns "JWT issued at future" due to container/server clock skew.
 */
export async function executeWithJwtRetry<T>(
  operation: () => PromiseLike<T>,
  options: { delayMs?: number; label?: string } = {}
): Promise<T> {
  const delayMs = options.delayMs ?? 1500;
  const label = options.label || "Supabase operation";

  const skew = inspectJwtClockSkew(supabaseServiceKey);
  if (skew.isFuture) {
    console.warn(
      `[Supabase Auth] SUPABASE_SERVICE_ROLE_KEY has an iat timestamp ${skew.diffSeconds}s in the future. Clock skew detected.`
    );
  }

  try {
    const res = await operation();
    if (res && typeof res === "object" && "error" in res && isJwtFutureError((res as Record<string, unknown>).error)) {
      console.warn(`[Supabase Auth] ${label} encountered "JWT issued at future". Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return await operation();
    }
    return res;
  } catch (err: unknown) {
    if (isJwtFutureError(err)) {
      console.warn(`[Supabase Auth] ${label} threw "JWT issued at future". Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return await operation();
    }
    throw err;
  }
}

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
  sqlFile: string,
  ownedColumns?: RegExp
): NextResponse | null {
  if (!error) return null;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`;
  const tableMissing =
    error.code === "42P01" || // undefined_table, straight from Postgres
    error.code === "PGRST205" || // the REST layer's own "not in the schema cache"
    /could not find the table|relation .* does not exist|schema cache/i.test(text);
  const grantMissing =
    error.code === "42501" || /permission denied for table|insufficient privilege/i.test(text);
  // A missing column means the same thing as a missing table, but only the route
  // that owns the column can say which file adds it — so a route has to name its
  // own columns before this one is believed.
  const columnMissing =
    ownedColumns !== undefined &&
    (error.code === "42703" || /column .* does not exist/i.test(text)) &&
    ownedColumns.test(text);
  if (!tableMissing && !grantMissing && !columnMissing) return null;

  return NextResponse.json(
    {
      success: false,
      error: `This part of the database is not set up on this project yet. Run ${sqlFile} in the Supabase SQL editor, then try again.`,
      reason: error.message ?? error.code ?? "missing table or grant",
    },
    { status: 503 }
  );
}
