import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// The rules about *when* a record may be filed, shared by every route that writes
// a pupil's school record. They live here rather than in each route because a
// term is either closed or it is not: two implementations drift, and the one that
// drifted is how a mark ends up inside a term the head has already signed off.

/** The only terms a mark or a rating can belong to. */
export const KNOWN_TERMS: readonly string[] = ["First Term", "Second Term", "Third Term"];

/** A timestamp from the database in the form the office recognises. */
function formatStamp(value: string | null | undefined): string {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "an earlier session";
}

/**
 * Refuses a request that does not name a session and a term the school uses.
 *
 * No silent default: filing into "First Term 2025/2026" because the request forgot
 * to say which term is how a child ends up with a grade, or a behaviour rating,
 * on a card for a term they were never taught.
 */
export function validateScope(session: string, term: string): NextResponse | null {
  if (!/^\d{4}[\/\s-]+\d{4}$/.test(session)) {
    return NextResponse.json(
      { success: false, error: `The academic session must be stated and look like 2025/2026, not "${session}".` },
      { status: 400 }
    );
  }
  if (!KNOWN_TERMS.includes(term)) {
    return NextResponse.json(
      { success: false, error: `The term must be one of: ${KNOWN_TERMS.join(", ")}. Not "${term}".` },
      { status: 400 }
    );
  }
  return null;
}

/**
 * The 409 when this term has been signed off, or null when writing into it is
 * allowed. This is what makes the End of Term screen's button mean something: the
 * records inside a closed term stay readable, so last term's cards still print,
 * but nothing can be filed into them afterwards.
 */
export async function closedTermRefusal(
  supabase: SupabaseClient,
  session: string,
  term: string
): Promise<NextResponse | null> {
  const { data: closedRow, error } = await supabase
    .from("closed_terms")
    .select("term, closed_by, closed_at")
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  if (error) {
    // A term can only be signed off by writing into closed_terms, so a database
    // with no such table has signed off nothing, and filing a record there is not
    // unlocking a closed term. Refusing instead would stop the whole school
    // entering marks because one optional migration had not been run. Every other
    // failure — a lost connection, a revoked key, a table the server cannot read —
    // is refused, because there the portal truly does not know whether it is open.
    const tableAbsent =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /could not find the table|relation .* does not exist|schema cache/i.test(error.message ?? "");

    if (!tableAbsent) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    return null;
  }

  if (!closedRow) return null;

  return NextResponse.json(
    {
      success: false,
      error: `${term} of ${session} was closed on ${formatStamp(closedRow.closed_at)} by ${
        closedRow.closed_by || "the office"
      }. Ask the exam office to re-open it from Operations → End of Term before any record in it is changed.`,
    },
    { status: 409 }
  );
}
