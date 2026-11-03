import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/rbac";
import type { SessionUser } from "./session";

// App-managed login accounts: one row per person, created from
// Settings → User Access. Passwords exist as salted scrypt hashes only, and are
// revealed once when created or reset. The table is read and written exclusively
// by the server, which holds the service-role key.

const SCRYPT_KEYLEN = 64;

const ACCOUNT_COLUMNS =
  "id, username, display_name, role, staff_id, email, status, token_epoch, created_by, created_at, last_login_at";

export interface AppAccountRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  staff_id: string;
  email: string;
  status: string;
  token_epoch: number;
  created_by: string;
  created_at: string;
  last_login_at: string | null;
}

export interface CreatedAppAccount extends AppAccountRow {
  password: string; // returned exactly once, never stored
}

export const ASSIGNABLE_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "EXAM_OFFICER",
  "TEACHER",
  "ACCOUNTANT",
  "STUDENT_PARENT",
  "TESTERS",
];

export function isAssignableRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as string[]).includes(value);
}

export function generatePassword(length = 14): string {
  // base64url keeps the alphabet URL- and message-safe (no +, / or =), which
  // matters because these passwords are typed by hand or pasted into WhatsApp.
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

type CredentialRow = {
  username: string;
  display_name: string;
  role: string;
  staff_id: string;
  email: string;
  status: string;
  token_epoch: number;
  password_hash: string;
  password_salt: string;
};

export async function verifyAppAccountCredentials(username: string, password: string): Promise<SessionUser | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_accounts")
    .select("username, display_name, role, staff_id, email, status, token_epoch, password_hash, password_salt")
    .ilike("username", username)
    .maybeSingle<CredentialRow>();

  if (error || !data) return null;
  if (data.status !== "Active") return null;
  if (!isAssignableRole(data.role)) return null;
  if (!verifyPassword(password, data.password_salt, data.password_hash)) return null;

  void supabase.from("app_accounts").update({ last_login_at: new Date().toISOString() }).eq("username", data.username);

  return {
    username: data.username,
    fullName: data.display_name || data.username,
    role: data.role,
    staffId: data.staff_id ?? "",
    email: data.email ?? "",
    epoch: Number(data.token_epoch),
  };
}

export async function listAppAccounts(): Promise<{ accounts: AppAccountRow[] | null; error: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { accounts: null, error: "Database not configured" };

  const { data, error } = await supabase
    .from("app_accounts")
    .select(ACCOUNT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { accounts: null, error: error.message };
  return { accounts: (data ?? []) as AppAccountRow[], error: null };
}

export async function getAppAccountById(id: string): Promise<{ account: AppAccountRow | null; error: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { account: null, error: "Database not configured" };

  const { data, error } = await supabase
    .from("app_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("id", id)
    .maybeSingle<AppAccountRow>();

  if (error) return { account: null, error: error.message };
  if (!data) return { account: null, error: "Account not found" };
  return { account: data as AppAccountRow, error: null };
}

export interface NewAppAccount {
  username: string;
  displayName: string;
  role: UserRole;
  staffId?: string;
  email?: string;
  createdBy: string;
}

export async function createAppAccount(input: NewAppAccount): Promise<{
  account: CreatedAppAccount | null;
  error: string | null;
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { account: null, error: "Database not configured" };

  const password = generatePassword();
  const { salt, hash } = hashPassword(password);

  const { data, error } = await supabase
    .from("app_accounts")
    .insert({
      username: input.username,
      display_name: input.displayName,
      role: input.role,
      staff_id: input.staffId ?? "",
      email: input.email ?? "",
      password_hash: hash,
      password_salt: salt,
      created_by: input.createdBy,
    })
    .select(ACCOUNT_COLUMNS)
    .single<AppAccountRow>();

  if (error) return { account: null, error: error.message };
  return { account: { ...(data as AppAccountRow), password }, error: null };
}

/** Issues a fresh password and invalidates every session already held by that account. */
export async function resetAppAccountPassword(id: string): Promise<{
  account: CreatedAppAccount | null;
  error: string | null;
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { account: null, error: "Database not configured" };

  const password = generatePassword();
  const { salt, hash } = hashPassword(password);
  const epoch = await nextEpoch(id);
  if (epoch === null) return { account: null, error: "Account not found" };

  const { data, error } = await supabase
    .from("app_accounts")
    .update({ password_hash: hash, password_salt: salt, token_epoch: epoch })
    .eq("id", id)
    .select(ACCOUNT_COLUMNS)
    .single<AppAccountRow>();

  if (error) return { account: null, error: error.message };
  return { account: { ...(data as AppAccountRow), password }, error: null };
}

/**
 * Suspension also advances the epoch, so a cookie handed out before it is
 * refused; restoration advances it again so the old cookie cannot come back.
 */
export async function setAppAccountStatus(id: string, status: "Active" | "Suspended"): Promise<{
  account: AppAccountRow | null;
  error: string | null;
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { account: null, error: "Database not configured" };

  const epoch = await nextEpoch(id);
  if (epoch === null) return { account: null, error: "Account not found" };

  const { data, error } = await supabase
    .from("app_accounts")
    .update({ status, token_epoch: epoch })
    .eq("id", id)
    .select(ACCOUNT_COLUMNS)
    .single<AppAccountRow>();

  if (error) return { account: null, error: error.message };
  return { account: (data as AppAccountRow) ?? null, error: null };
}

export async function deleteAppAccount(id: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "Database not configured";

  const { error } = await supabase.from("app_accounts").delete().eq("id", id);
  return error ? error.message : null;
}

async function nextEpoch(id: string): Promise<number | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from("app_accounts").select("token_epoch").eq("id", id).maybeSingle();
  if (!data) return null;
  return Number(data.token_epoch) + 1;
}
