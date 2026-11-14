import { NextResponse } from "next/server";
import { requireRoleSession } from "@/lib/auth/guard";
import { isEnvironmentUsername } from "@/lib/auth/accounts";
import {
  createAppAccount,
  getAppAccountByUsername,
  isAssignableRole,
  resetAppAccountPassword,
} from "@/lib/auth/app-accounts";
import { replaceGuardianLinks } from "@/lib/auth/guardian-links";
import type { UserRole } from "@/lib/rbac";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ISSUE_LOGIN = ["SUPER_ADMIN"] as const;

type StaffRow = {
  staff_id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: string | null;
};

/**
 * Hands out a working credential for a person already on the staff register.
 *
 * The per-row *Access Slip* button used to build a passcode in the browser with
 * `Math.random()`, print it on a memo and send it nowhere — so the office
 * distributed passwords that belonged to no account, sometimes to people who
 * already had a working one. Only the server can issue a credential that signs
 * someone in, and only the server knows whether this username already has a
 * login that must be *replaced* rather than duplicated.
 */
export async function POST(request: Request) {
  const { session, denied } = await requireRoleSession(ISSUE_LOGIN);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const username = typeof (body as { username?: unknown })?.username === "string"
    ? (body as { username: string }).username.trim()
    : "";
  if (!username) {
    return NextResponse.json({ success: false, error: "Provide the username to issue a login for." }, { status: 400 });
  }

  // Sign-in tries environment accounts first, so a database row under one of
  // these names would be stored, shown, and never consulted.
  if (isEnvironmentUsername(username)) {
    return NextResponse.json(
      {
        success: false,
        error: `${username} is answered by the server's own configuration, not by a portal login, so a password issued here would never be used. Its passcode is set by the server environment variables.`,
      },
      { status: 409 }
    );
  }

  const existing = await getAppAccountByUsername(username);
  if (existing.error) {
    return NextResponse.json({ success: false, error: existing.error }, { status: 502 });
  }

  if (existing.account) {
    const { account, error } = await resetAppAccountPassword(existing.account.id);
    if (!account) {
      return NextResponse.json(
        { success: false, error: error ?? "The existing login could not be reset." },
        { status: error === "Account not found" ? 404 : 502 }
      );
    }
    return NextResponse.json({
      success: true,
      login: { username: account.username, password: account.password, action: "reset" as const },
    });
  }

  const { data: staffRow, error: staffError } = await supabase
    .from("staff")
    .select("staff_id, full_name, username, email, role")
    .in("username", [username, username.toLowerCase(), username.toUpperCase()])
    .limit(1)
    .maybeSingle<StaffRow>();

  if (staffError) {
    return NextResponse.json({ success: false, error: staffError.message }, { status: 502 });
  }

  if (staffRow) {
    const role = isAssignableRole(staffRow.role) ? (staffRow.role as UserRole) : "TEACHER";
    const { account, error } = await createAppAccount({
      username: staffRow.username,
      displayName: staffRow.full_name,
      role,
      staffId: staffRow.staff_id,
      email: staffRow.email ?? "",
      createdBy: session.username,
    });

    if (!account) {
      return NextResponse.json({ success: false, error: error ?? "The login could not be created." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      login: { username: account.username, password: account.password, action: "created" as const },
      holder: { fullName: staffRow.full_name, staffId: staffRow.staff_id, role: staffRow.role },
    });
  }

  // Fallback: Check if username or ref corresponds to a pupil admission number
  const { data: pupil, error: pupilError } = await supabase
    .from("students")
    .select("admission_no, full_name")
    .or(`admission_no.eq.${username},admission_no.ilike.${username}`)
    .limit(1)
    .maybeSingle();

  if (pupilError) {
    return NextResponse.json({ success: false, error: pupilError.message }, { status: 502 });
  }

  if (pupil) {
    const studentUsername = `pupil.${pupil.admission_no.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const studentExisting = await getAppAccountByUsername(studentUsername);

    if (studentExisting.account) {
      const { account, error } = await resetAppAccountPassword(studentExisting.account.id);
      if (!account) {
        return NextResponse.json(
          { success: false, error: error ?? "The existing student/parent login could not be reset." },
          { status: error === "Account not found" ? 404 : 502 }
        );
      }
      return NextResponse.json({
        success: true,
        login: { username: account.username, password: account.password, action: "reset" as const },
        holder: { fullName: pupil.full_name, admissionNo: pupil.admission_no, role: "STUDENT_PARENT" },
      });
    }

    const { account, error } = await createAppAccount({
      username: studentUsername,
      displayName: `${pupil.full_name} (Parent/Pupil)`,
      role: "STUDENT_PARENT",
      email: "",
      createdBy: session.username,
    });

    if (!account) {
      return NextResponse.json({ success: false, error: error ?? "The student/parent login could not be created." }, { status: 502 });
    }

    await replaceGuardianLinks(studentUsername, [pupil.admission_no], session.username);

    return NextResponse.json({
      success: true,
      login: { username: account.username, password: account.password, action: "created" as const },
      holder: { fullName: pupil.full_name, admissionNo: pupil.admission_no, role: "STUDENT_PARENT" },
    });
  }

  return NextResponse.json(
    { success: false, error: `No registered staff member or enrolled pupil found matching identifier "${username}".` },
    { status: 404 }
  );
}
