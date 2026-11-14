import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { ASSIGNABLE_ROLES, createAppAccount, getAppAccountByUsername, setAppAccountStatus } from "@/lib/auth/app-accounts";
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
  designation?: string;
  standing_duties?: string[];
};

function trimmedList(value: unknown, max: number, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => (typeof entry === "string" ? entry.trim().slice(0, max) : "")).filter(Boolean))
  ).slice(0, cap);
}

function sanitizeStaff(raw: StaffPayload) {
  if (!raw || typeof raw !== "object") return null;
  const staffId = typeof raw.staff_id === "string" ? raw.staff_id.trim() : "";
  const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
  const username = typeof raw.username === "string" ? raw.username.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (!staffId || !fullName || !username || !email) return null;
  const designation = typeof raw.designation === "string" ? raw.designation.trim().slice(0, 80) : "";
  const standingDuties = trimmedList(raw.standing_duties, 120, 12);
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
    // Sent only when the office actually wrote one, so a project that has not run
    // supabase/staff_duties.sql carries on filing staff records exactly as before
    // instead of failing on a column that does not exist yet.
    ...(designation ? { designation } : {}),
    ...(standingDuties.length ? { standing_duties: standingDuties } : {}),
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
  if (error) {
    // A designation or standing duty is a column supabase/staff_duties.sql adds.
    // Naming the file is the difference between "the save failed" and "run this
    // one script and the save works".
    if (/designation|standing_duties/i.test(`${error.message} ${error.code ?? ""}`)) {
      return NextResponse.json(
        {
          success: false,
          error: `The staff record cannot carry a designation or a standing duty until supabase/staff_duties.sql has been run on this project. Nothing was saved.`,
          reason: error.message,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  // If appointed as Form Master, sync to the corresponding class arm in public.class_arms
  if (row.is_form_master && row.assigned_class) {
    await supabase
      .from("class_arms")
      .update({
        form_teacher: row.full_name,
        form_teacher_id: row.staff_id,
        updated_at: new Date().toISOString(),
      })
      .eq("name", row.assigned_class);
  }

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

export async function PATCH(request: Request) {
  const { denied } = await requireRoleSession(WRITE_STAFF);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const targetIdentifier = (body.id || body.staffId || body.staff_id) as string | undefined;
  if (!targetIdentifier || typeof targetIdentifier !== "string") {
    return NextResponse.json({ success: false, error: "Provide the staff id or UUID to update." }, { status: 400 });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdentifier.trim());
  let lookupQuery = supabase.from("staff").select("*");
  if (isUuid) lookupQuery = lookupQuery.eq("id", targetIdentifier.trim());
  else lookupQuery = lookupQuery.eq("staff_id", targetIdentifier.trim());

  const { data: existing, error: lookupErr } = await lookupQuery.maybeSingle();
  if (lookupErr) return NextResponse.json({ success: false, error: lookupErr.message }, { status: 502 });
  if (!existing) return NextResponse.json({ success: false, error: "Staff member not found" }, { status: 404 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.fullName === "string" && body.fullName.trim()) updateData.full_name = body.fullName.trim();
  if (typeof body.full_name === "string" && body.full_name.trim()) updateData.full_name = body.full_name.trim();

  if (body.staffId !== undefined || body.staff_id !== undefined) {
    const rawStaffId = ((body.staffId ?? body.staff_id) as string).trim();
    if (rawStaffId && rawStaffId.toLowerCase() !== existing.staff_id.toLowerCase()) {
      const { data: dup } = await supabase.from("staff").select("id").ilike("staff_id", rawStaffId).neq("id", existing.id).maybeSingle();
      if (dup) return NextResponse.json({ success: false, error: "Staff ID already assigned to another staff member" }, { status: 409 });
      updateData.staff_id = rawStaffId;
    }
  }

  if (typeof body.username === "string" && body.username.trim()) {
    const rawUser = body.username.trim().toLowerCase();
    if (rawUser !== existing.username.toLowerCase()) {
      const { data: dup } = await supabase.from("staff").select("id").ilike("username", rawUser).neq("id", existing.id).maybeSingle();
      if (dup) return NextResponse.json({ success: false, error: "Username already assigned to another staff member" }, { status: 409 });
      updateData.username = rawUser;
    }
  }

  if (typeof body.email === "string" && body.email.trim()) {
    const rawEmail = body.email.trim().toLowerCase();
    if (rawEmail !== existing.email.toLowerCase()) {
      const { data: dup } = await supabase.from("staff").select("id").ilike("email", rawEmail).neq("id", existing.id).maybeSingle();
      if (dup) return NextResponse.json({ success: false, error: "Email address already registered to another staff member" }, { status: 409 });
      updateData.email = rawEmail;
    }
  }

  if (typeof body.phone === "string") updateData.phone = body.phone.trim();
  if (typeof body.role === "string" && body.role.trim()) updateData.role = body.role.trim();
  if (Array.isArray(body.assignedSubjects || body.assigned_subjects)) {
    updateData.assigned_subjects = trimmedList(body.assignedSubjects || body.assigned_subjects, 80, 20);
  }
  if (typeof body.assignedClass === "string" || typeof body.assigned_class === "string") {
    updateData.assigned_class = ((body.assignedClass || body.assigned_class) as string).trim();
  }
  if (body.status !== undefined && typeof body.status === "string") updateData.status = body.status.trim();
  if (body.designation !== undefined && typeof body.designation === "string") updateData.designation = body.designation.trim();

  const { data: updated, error: updateErr } = await supabase.from("staff").update(updateData).eq("id", existing.id).select().single();
  if (updateErr) {
    if (updateErr.code === "23505") return NextResponse.json({ success: false, error: "A unique constraint conflict occurred: " + updateErr.message }, { status: 409 });
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 502 });
  }

  const oldStaffId = existing.staff_id;
  const newStaffId = (updateData.staff_id as string) || oldStaffId;
  const newFullName = (updateData.full_name as string) || existing.full_name;
  const newEmail = (updateData.email as string) || existing.email;

  const accountUpdates: Record<string, unknown> = {};
  if (updateData.full_name) accountUpdates.display_name = newFullName;
  if (updateData.staff_id) accountUpdates.staff_id = newStaffId;
  if (updateData.email) accountUpdates.email = newEmail;
  if (updateData.status) accountUpdates.status = updateData.status === "Suspended" ? "Suspended" : "Active";
  if (updateData.role) accountUpdates.role = updateData.role;

  if (Object.keys(accountUpdates).length > 0) {
    await supabase.from("app_accounts").update(accountUpdates).or(`staff_id.eq.${oldStaffId},username.eq.${existing.username}`);
  }

  await supabase.from("id_cards").update({ holder_ref: newStaffId, holder_name: newFullName, updated_at: new Date().toISOString() }).eq("holder_type", "staff").eq("holder_ref", oldStaffId);
  await supabase.from("staff_duties").update({ staff_id: newStaffId, staff_name: newFullName, designation: updateData.designation !== undefined ? (updateData.designation as string) : existing.designation, updated_at: new Date().toISOString() }).eq("staff_id", oldStaffId);

  return NextResponse.json({ success: true, data: updated });
}

/**
 * Removes a staff record and closes the door that record's login walks through.
 *
 * The register screen has always had a delete button, but it only edited this
 * browser's copy, so the member was back on the list after a reload — and their
 * login kept working the whole time. Removal now happens on the server, and the
 * login is suspended with it: a departed member should not keep a credential
 * that outlives their record. Suspension rather than deletion because the
 * password was handed out once, on paper, and an office that removes someone by
 * mistake can put the record back without inventing a new credential nobody was
 * told about.
 */
export async function DELETE(request: Request) {
  const { session, denied } = await requireRoleSession(WRITE_STAFF);
  if (denied) return denied;

  let body: { staffId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
  if (!staffId) {
    return NextResponse.json({ success: false, error: "Provide the staff ID of the member to remove." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: member, error: lookupError } = await supabase
    .from("staff")
    .select("staff_id, full_name, username")
    .eq("staff_id", staffId)
    .maybeSingle<{ staff_id: string; full_name: string; username: string }>();

  if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 502 });
  if (!member) {
    return NextResponse.json({ success: false, error: `No staff record on file with ID ${staffId}.` }, { status: 404 });
  }

  // Removing yourself would take the register — and the login behind the
  // session in this browser — with it.
  if (member.username.toLowerCase() === session.username.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: `You are signed in as ${member.username}, so this record cannot be removed from here.` },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase.from("staff").delete().eq("staff_id", staffId);
  if (deleteError) return NextResponse.json({ success: false, error: deleteError.message }, { status: 502 });

  const { account, error: accountError } = await getAppAccountByUsername(member.username);
  if (accountError) {
    return NextResponse.json({
      success: true,
      data: {
        staffId,
        loginSuspended: false,
        loginWarning: `The staff record was removed, but the portal could not check the login “${member.username}”: ${accountError}.`,
      },
    });
  }

  if (!account) {
    // Env-configured logins (AUTH_<ROLE>_*) are not rows in app_accounts, so
    // nothing here can suspend them. Say so instead of claiming the door closed.
    return NextResponse.json({
      success: true,
      data: {
        staffId,
        loginSuspended: false,
        loginWarning: `The staff record was removed. No portal login is filed under “${member.username}”, so there was nothing to suspend — if that person signs in with a login set up outside this screen, remove it where it was created.`,
      },
    });
  }

  const { error: suspendError } = await setAppAccountStatus(account.id, "Suspended");
  if (suspendError) {
    return NextResponse.json({
      success: true,
      data: {
        staffId,
        loginSuspended: false,
        loginWarning: `The staff record was removed, but its login “${member.username}” is still active — ${suspendError}. Suspend it in Settings → User Access.`,
      },
    });
  }

  return NextResponse.json({ success: true, data: { staffId, loginSuspended: true, loginUsername: account.username } });
}
