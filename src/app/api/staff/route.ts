import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { ASSIGNABLE_ROLES, createAppAccount } from "@/lib/auth/app-accounts";
import type { UserRole } from "@/lib/rbac";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Reading the staff register is for administration and QA; the bursary is not
// entitled to it. Only the super admin may add or change a staff record.
const READ_STAFF = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;
const WRITE_STAFF = ["SUPER_ADMIN"] as const;

type StaffPayload = {
  id?: string;
  staff_id?: string;
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  assigned_subjects?: string[];
  assigned_class?: string;
  is_form_master?: boolean;
  email_verified?: boolean;
  status?: string;
};

function sanitizeStaff(raw: StaffPayload) {
  if (!raw || typeof raw !== "object") return null;
  const staffId = typeof raw.staff_id === "string" ? raw.staff_id.trim() : "";
  const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
  const username = typeof raw.username === "string" ? raw.username.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (!staffId || !fullName || !username || !email) return null;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined,
    staff_id: staffId,
    full_name: fullName,
    username,
    email,
    phone: typeof raw.phone === "string" && raw.phone ? raw.phone : "08030000000",
    role: typeof raw.role === "string" && raw.role ? raw.role : "TEACHER",
    assigned_subjects: Array.isArray(raw.assigned_subjects) ? raw.assigned_subjects : [],
    assigned_class: typeof raw.assigned_class === "string" && raw.assigned_class ? raw.assigned_class : "Primary 1",
    is_form_master: Boolean(raw.is_form_master),
    email_verified: Boolean(raw.email_verified),
    status: typeof raw.status === "string" && raw.status ? raw.status : "Active",
  };
}

export async function GET() {
  const denied = await requireRole(READ_STAFF);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const { session, denied } = await requireRoleSession(WRITE_STAFF);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const row = sanitizeStaff(body as StaffPayload);
  if (!row) {
    return NextResponse.json({ success: false, error: "Provide a staff member with staff_id, full_name, username and email." }, { status: 400 });
  }

  const { error } = await supabase.from("staff").upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });

  // Registering a person and giving them a way to sign in is one act of
  // onboarding, not two. Before this the form invented a passcode in the
  // browser and printed it on a memo, so the office handed out a password that
  // existed nowhere; only the server can issue one that actually works.
  const loginRole = ASSIGNABLE_ROLES.includes(row.role as UserRole) ? (row.role as UserRole) : null;
  if (!loginRole) {
    return NextResponse.json({
      success: true,
      login: null,
      loginError: `"${row.role}" is not a role the portal issues logins for, so the staff record was saved on its own.`,
    });
  }

  const { account, error: loginError } = await createAppAccount({
    username: row.username,
    displayName: row.full_name,
    role: loginRole,
    staffId: row.staff_id,
    email: row.email,
    createdBy: session.username,
  });

  if (account) {
    return NextResponse.json({
      success: true,
      login: { username: account.username, password: account.password },
      loginError: null,
    });
  }

  // The staff record is already saved and stays saved; say plainly what is
  // missing and where to finish the job, rather than failing the whole request.
  const taken = /duplicate key|already exists/i.test(loginError ?? "");
  return NextResponse.json({
    success: true,
    login: null,
    loginError: taken
      ? `A login for ${row.username} already exists, so no new one was issued. Reset it in Settings → User Access if it is not in use.`
      : (loginError ?? "The login could not be created."),
  });
}
