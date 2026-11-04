import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Decides whether an already-issued session cookie is still good. Suspension,
 * deletion, restoration and password reset all end up here, because each one
 * either clears `status` or advances `token_epoch` out from under the cookie.
 *
 * Lives apart from the account manager so the proxy's per-request path stays
 * free of password-hashing code, and returns true when the database cannot be
 * reached: an outage should not sign the whole school out.
 */
export async function isAppAccountSessionCurrent(username: string, epoch: number): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from("app_accounts")
    .select("status, token_epoch")
    .ilike("username", username)
    .maybeSingle<{ status: string; token_epoch: number }>();

  if (error) return true;
  if (!data) return false;
  return data.status === "Active" && Number(data.token_epoch) === epoch;
}
