import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./supabase/server";
import type { UserRole } from "./rbac";

export interface AuthProfile {
  id: string;
  authUserId: string;
  username: string;
  fullName: string;
  role: UserRole;
  staffId: string;
  email?: string;
  assignedSubject?: string;
  assignedClass?: string;
  loginTime: string;
}

type StaffRow = {
  id: string;
  staff_id: string;
  full_name: string;
  username: string;
  email: string;
  role: UserRole;
  assigned_subjects: string[] | null;
  assigned_class: string | null;
  status: string;
};

type StudentRow = { id: string; admission_no: string; full_name: string; class_name: string };

/** Resolves the signed-in user and their role from the database (never from client input). */
export async function getAuthProfile(
  existingClient?: SupabaseClient | null
): Promise<{ profile: AuthProfile | null; supabase: SupabaseClient | null }> {
  const supabase = existingClient ?? (await getSupabaseServerClient());
  if (!supabase) return { profile: null, supabase: null };

  const { data: userData, error } = await supabase.auth.getUser();
  const user = userData?.user;
  if (error || !user) return { profile: null, supabase };

  const loginTime = user.last_sign_in_at || new Date().toISOString();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, staff_id, full_name, username, email, role, assigned_subjects, assigned_class, status")
    .eq("auth_user_id", user.id)
    .maybeSingle<StaffRow>();

  if (staff) {
    if (staff.status !== "Active") return { profile: null, supabase };
    return {
      supabase,
      profile: {
        id: staff.id,
        authUserId: user.id,
        username: staff.username,
        fullName: staff.full_name,
        role: staff.role,
        staffId: staff.staff_id,
        email: staff.email,
        assignedSubject: staff.assigned_subjects?.[0],
        assignedClass: staff.assigned_class ?? undefined,
        loginTime,
      },
    };
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, admission_no, full_name, class_name")
    .eq("portal_user_id", user.id)
    .limit(1)
    .maybeSingle<StudentRow>();

  if (student) {
    return {
      supabase,
      profile: {
        id: student.id,
        authUserId: user.id,
        username: student.admission_no,
        fullName: student.full_name,
        role: "STUDENT_PARENT",
        staffId: student.admission_no,
        email: user.email,
        assignedClass: student.class_name,
        loginTime,
      },
    };
  }

  return { profile: null, supabase };
}

/**
 * Route-handler guard. Returns the profile and an RLS-scoped client, or a 401/403 response.
 */
export async function requireRole(allowed: UserRole[] | "ANY") {
  const { profile, supabase } = await getAuthProfile();
  if (!profile || !supabase) {
    return { error: NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 }) } as const;
  }
  if (allowed !== "ANY" && !allowed.includes(profile.role)) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { profile, supabase } as const;
}
