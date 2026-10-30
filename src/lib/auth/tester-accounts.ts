import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "./session";

// App-generated logins (currently the TESTERS role). Created by the super
// admin from Settings → Tester Access; passwords are shown once at creation
// and stored only as salted scrypt hashes.

export interface TesterAccountRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_by: string;
  created_at: string;
  last_login_at: string | null;
}

export interface CreatedTesterAccount extends TesterAccountRow {
  password: string; // returned exactly once, never stored
}

const SCRYPT_KEYLEN = 64;

export function generatePassword(length = 14): string {
  // base64url of 11 bytes = ~15 chars; slice keeps charset unambiguous enough
  // while staying URL- and message-safe (no +, /, or =).
  return randomBytes(11).toString("base64url").slice(0, length);
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? randomBytes(16).toString("hex");
  const derived = scryptSync(password, actualSalt, SCRYPT_KEYLEN);
  return { salt: actualSalt, hash: derived.toString("hex") };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function verifyTesterCredentials(username: string, password: string): Promise<SessionUser | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_accounts")
    .select("username, display_name, role, password_hash, password_salt")
    .ilike("username", username)
    .maybeSingle();

  if (error || !data || !verifyPassword(password, data.password_salt, data.password_hash)) {
    return null;
  }

  void supabase.from("app_accounts").update({ last_login_at: new Date().toISOString() }).ilike("username", username);

  return {
    username: data.username,
    fullName: data.display_name || data.username,
    role: "TESTERS",
    staffId: "",
    email: "",
  };
}

export async function listTesterAccounts(): Promise<{ accounts: TesterAccountRow[] | null; error: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { accounts: null, error: "Database not configured" };

  const { data, error } = await supabase
    .from("app_accounts")
    .select("id, username, display_name, role, created_by, created_at, last_login_at")
    .order("created_at", { ascending: false });

  if (error) return { accounts: null, error: error.message };
  return { accounts: (data ?? []) as TesterAccountRow[], error: null };
}

export async function createTesterAccount(
  username: string,
  displayName: string,
  createdBy: string
): Promise<{ account: CreatedTesterAccount | null; error: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { account: null, error: "Database not configured" };

  const password = generatePassword();
  const { salt, hash } = hashPassword(password);

  const { data, error } = await supabase
    .from("app_accounts")
    .insert({
      username,
      display_name: displayName,
      role: "TESTERS",
      password_hash: hash,
      password_salt: salt,
      created_by: createdBy,
    })
    .select("id, username, display_name, role, created_by, created_at, last_login_at")
    .single();

  if (error) return { account: null, error: error.message };
  return { account: { ...(data as TesterAccountRow), password }, error: null };
}

export async function regenerateTesterPassword(
  id: string
): Promise<{ account: CreatedTesterAccount | null; error: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { account: null, error: "Database not configured" };

  const password = generatePassword();
  const { salt, hash } = hashPassword(password);

  const { data, error } = await supabase
    .from("app_accounts")
    .update({ password_hash: hash, password_salt: salt })
    .eq("id", id)
    .select("id, username, display_name, role, created_by, created_at, last_login_at")
    .single();

  if (error) return { account: null, error: error.message };
  return { account: { ...(data as TesterAccountRow), password }, error: null };
}

export async function revokeTesterAccount(id: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "Database not configured";

  const { error } = await supabase.from("app_accounts").delete().eq("id", id);
  return error ? error.message : null;
}
