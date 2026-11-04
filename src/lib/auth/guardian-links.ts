import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "./session";

// guardian_students pairs one login with one pupil. It is the only thing that
// decides what a Student / Parent may read, so it is read and written by the
// server alone: the browser never sends an admission number and has it taken on
// faith. Usernames are stored lower-cased, which is what the accounts route
// already does, so the lookup matches case-insensitively without wildcards.

export interface GuardianScope {
  admissionNos: string[] | null;
  error: string | null;
}

/**
 * null means "no restriction" — the caller is staff. An empty array means the
 * login is a parent with nothing linked yet, which the routes report instead of
 * quietly serving an empty list.
 */
export async function guardianScope(session: SessionUser): Promise<GuardianScope> {
  if (session.role !== "STUDENT_PARENT") return { admissionNos: null, error: null };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { admissionNos: null, error: "Database not configured" };

  const { data, error } = await supabase
    .from("guardian_students")
    .select("admission_no")
    .eq("guardian_username", session.username.toLowerCase());

  if (error) return { admissionNos: null, error: error.message };
  return { admissionNos: (data ?? []).map((row) => String(row.admission_no)), error: null };
}

export interface LinkResult {
  unknownAdmissionNos: string[];
  error: string | null;
}

/** Replaces the whole set of pupils behind one login, so removing a child is just omitting it. */
export async function replaceGuardianLinks(
  guardianUsername: string,
  admissionNos: string[],
  createdBy: string
): Promise<LinkResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { unknownAdmissionNos: [], error: "Database not configured" };

  const username = guardianUsername.trim().toLowerCase();
  const wanted: string[] = [];
  const seen = new Set<string>();
  for (const raw of admissionNos) {
    const trimmed = raw.trim();
    const key = trimmed.toUpperCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    wanted.push(trimmed);
  }

  if (wanted.length === 0) {
    const { error } = await supabase.from("guardian_students").delete().eq("guardian_username", username);
    return { unknownAdmissionNos: [], error: error ? error.message : null };
  }

  // Admission numbers are matched without wildcards (`_` is ordinary in this
  // school's identifiers, so a LIKE pattern would over-match). Both the typed
  // spelling and its upper-case form are offered; whatever the database has is
  // the spelling kept below.
  const candidates = Array.from(new Set([...wanted, ...wanted.map((no) => no.toUpperCase())]));
  const { data: onFile, error: lookupError } = await supabase
    .from("students")
    .select("admission_no")
    .in("admission_no", candidates);
  if (lookupError) return { unknownAdmissionNos: [], error: lookupError.message };

  // The row is stored with the spelling the database has, not the one typed in:
  // the parent's read filter is case-sensitive, so a lower-cased link would be
  // accepted here and then match no pupil.
  const canonicalByUpper = new Map((onFile ?? []).map((row) => [String(row.admission_no).toUpperCase(), String(row.admission_no)]));
  const unknownAdmissionNos = wanted.filter((no) => !canonicalByUpper.has(no.toUpperCase()));
  if (unknownAdmissionNos.length > 0) {
    return { unknownAdmissionNos, error: null };
  }

  const { error } = await supabase
    .from("guardian_students")
    .delete()
    .eq("guardian_username", username);
  if (error) return { unknownAdmissionNos: [], error: error.message };

  const { error: insertError } = await supabase.from("guardian_students").insert(
    wanted.map((typed) => ({
      guardian_username: username,
      admission_no: canonicalByUpper.get(typed.toUpperCase()) as string,
      created_by: createdBy,
    }))
  );
  return { unknownAdmissionNos: [], error: insertError ? insertError.message : null };
}

/** Used when an account is deleted: links live on by username, not by row id. */
export async function clearGuardianLinks(guardianUsername: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "Database not configured";

  const { error } = await supabase
    .from("guardian_students")
    .delete()
    .eq("guardian_username", guardianUsername.trim().toLowerCase());
  return error ? error.message : null;
}

/** Every link in one query, grouped by login, for the User Access list. */
export async function allGuardianLinks(): Promise<{ links: Record<string, string[]>; error: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { links: {}, error: "Database not configured" };

  const { data, error } = await supabase.from("guardian_students").select("guardian_username, admission_no");
  if (error) return { links: {}, error: error.message };

  const links: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const username = String(row.guardian_username);
    (links[username] ??= []).push(String(row.admission_no));
  }
  return { links, error: null };
}
