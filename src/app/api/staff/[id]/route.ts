import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const READ_STAFF = ["SUPER_ADMIN", "EXAM_OFFICER", "TESTERS"] as const;
const WRITE_STAFF = ["SUPER_ADMIN"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

function trimmedList(value: unknown, max: number, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => (typeof entry === "string" ? entry.trim().slice(0, max) : "")).filter(Boolean))
  ).slice(0, cap);
}

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireRole(READ_STAFF);
  if (denied) return denied;

  const { id } = await context.params;
  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const isUuid = UUID_PATTERN.test(id.trim());
  let query = supabase.from("staff").select("*");
  if (isUuid) {
    query = query.eq("id", id.trim());
  } else {
    query = query.eq("staff_id", id.trim());
  }

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ success: false, error: `Staff record with identifier ${id} not found.` }, { status: 404 });

  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { denied } = await requireRoleSession(WRITE_STAFF);
  if (denied) return denied;

  const { id } = await context.params;
  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const isUuid = UUID_PATTERN.test(id.trim());
  let lookupQuery = supabase.from("staff").select("*");
  if (isUuid) {
    lookupQuery = lookupQuery.eq("id", id.trim());
  } else {
    lookupQuery = lookupQuery.eq("staff_id", id.trim());
  }

  const { data: existing, error: lookupErr } = await lookupQuery.maybeSingle();
  if (lookupErr) return NextResponse.json({ success: false, error: lookupErr.message }, { status: 502 });
  if (!existing) return NextResponse.json({ success: false, error: `Staff record with identifier ${id} not found.` }, { status: 404 });

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // 1. Core Field Validations & Normalizations
  if (body.fullName !== undefined || body.full_name !== undefined) {
    const rawName = (body.fullName ?? body.full_name) as unknown;
    if (typeof rawName !== "string" || !rawName.trim()) {
      return NextResponse.json({ success: false, error: "Full name cannot be blank." }, { status: 400 });
    }
    updateData.full_name = rawName.trim();
  }

  if (body.staffId !== undefined || body.staff_id !== undefined) {
    const rawStaffId = (body.staffId ?? body.staff_id) as unknown;
    if (typeof rawStaffId !== "string" || !rawStaffId.trim()) {
      return NextResponse.json({ success: false, error: "Staff ID cannot be blank." }, { status: 400 });
    }
    const normalizedStaffId = rawStaffId.trim();
    if (normalizedStaffId.toLowerCase() !== existing.staff_id.toLowerCase()) {
      const { data: dupStaff, error: dupErr } = await supabase
        .from("staff")
        .select("id")
        .ilike("staff_id", normalizedStaffId)
        .neq("id", existing.id)
        .maybeSingle();

      if (dupErr && dupErr.code !== "PGRST116") {
        return NextResponse.json({ success: false, error: dupErr.message }, { status: 502 });
      }
      if (dupStaff) {
        return NextResponse.json(
          { success: false, error: "Staff ID already assigned to another staff member" },
          { status: 409 }
        );
      }
    }
    updateData.staff_id = normalizedStaffId;
  }

  if (body.username !== undefined) {
    const rawUser = body.username;
    if (typeof rawUser !== "string" || !rawUser.trim()) {
      return NextResponse.json({ success: false, error: "Username cannot be blank." }, { status: 400 });
    }
    const normalizedUser = rawUser.trim().toLowerCase();
    if (normalizedUser !== existing.username.toLowerCase()) {
      const { data: dupUser, error: dupErr } = await supabase
        .from("staff")
        .select("id")
        .ilike("username", normalizedUser)
        .neq("id", existing.id)
        .maybeSingle();

      if (dupErr && dupErr.code !== "PGRST116") {
        return NextResponse.json({ success: false, error: dupErr.message }, { status: 502 });
      }
      if (dupUser) {
        return NextResponse.json(
          { success: false, error: "Username already assigned to another staff member" },
          { status: 409 }
        );
      }
    }
    updateData.username = normalizedUser;
  }

  if (body.email !== undefined) {
    const rawEmail = body.email;
    if (typeof rawEmail !== "string" || !rawEmail.trim()) {
      return NextResponse.json({ success: false, error: "Email cannot be blank." }, { status: 400 });
    }
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (normalizedEmail !== existing.email.toLowerCase()) {
      const { data: dupEmail, error: dupErr } = await supabase
        .from("staff")
        .select("id")
        .ilike("email", normalizedEmail)
        .neq("id", existing.id)
        .maybeSingle();

      if (dupErr && dupErr.code !== "PGRST116") {
        return NextResponse.json({ success: false, error: dupErr.message }, { status: 502 });
      }
      if (dupEmail) {
        return NextResponse.json(
          { success: false, error: "Email address already registered to another staff member" },
          { status: 409 }
        );
      }
    }
    updateData.email = normalizedEmail;
  }

  if (body.phone !== undefined) {
    const rawPhone = body.phone;
    if (typeof rawPhone === "string") updateData.phone = rawPhone.trim();
  }

  if (body.role !== undefined) {
    const rawRole = body.role;
    if (typeof rawRole === "string" && rawRole.trim()) {
      updateData.role = rawRole.trim();
    }
  }

  if (body.assignedSubjects !== undefined || body.assigned_subjects !== undefined) {
    const rawSubs = (body.assignedSubjects ?? body.assigned_subjects) as unknown;
    if (Array.isArray(rawSubs)) {
      updateData.assigned_subjects = trimmedList(rawSubs, 80, 20);
    }
  }

  if (body.assignedClass !== undefined || body.assigned_class !== undefined || body.classId !== undefined || body.class_id !== undefined) {
    const rawClass = (body.assignedClass ?? body.assigned_class ?? body.classId ?? body.class_id) as unknown;
    if (typeof rawClass === "string" && rawClass.trim()) {
      const classIdentifier = rawClass.trim();
      updateData.assigned_class = classIdentifier;

      // Dynamic lookup against canonical class_arms catalog
      const { data: matchedArm } = await supabase
        .from("class_arms")
        .select("id, name, section")
        .or(`name.eq."${classIdentifier}",id.eq."${classIdentifier}"`)
        .maybeSingle();

      if (matchedArm) {
        updateData.assigned_class = matchedArm.name;
        updateData.class_id = matchedArm.id;
        updateData.section_id = matchedArm.section;
      }
    }
  }

  if (body.isFormMaster !== undefined || body.is_form_master !== undefined) {
    updateData.is_form_master = Boolean(body.isFormMaster ?? body.is_form_master);
  }

  if (body.status !== undefined) {
    const rawStatus = body.status;
    if (typeof rawStatus === "string" && rawStatus.trim()) {
      updateData.status = rawStatus.trim();
    }
  }

  if (body.designation !== undefined) {
    const rawDesig = body.designation;
    if (typeof rawDesig === "string") {
      updateData.designation = rawDesig.trim().slice(0, 100);
    }
  }

  if (body.standingDuties !== undefined || body.standing_duties !== undefined) {
    const rawDuties = (body.standingDuties ?? body.standing_duties) as unknown;
    if (Array.isArray(rawDuties)) {
      updateData.standing_duties = trimmedList(rawDuties, 120, 12);
    }
  }

  // 2. Extended Profile Fields (Safe Additive / Optional)
  if (body.staffType !== undefined || body.staff_type !== undefined) {
    const val = (body.staffType ?? body.staff_type) as unknown;
    if (typeof val === "string" && val.trim()) updateData.staff_type = val.trim();
  }
  if (body.qualifications !== undefined && typeof body.qualifications === "string") {
    updateData.qualifications = body.qualifications.trim();
  }
  if (body.bankName !== undefined || body.bank_name !== undefined) {
    const val = (body.bankName ?? body.bank_name) as unknown;
    if (typeof val === "string") updateData.bank_name = val.trim();
  }
  if (body.accountNumber !== undefined || body.account_number !== undefined) {
    const val = (body.accountNumber ?? body.account_number) as unknown;
    if (typeof val === "string") updateData.account_number = val.trim();
  }
  if (body.accountName !== undefined || body.account_name !== undefined) {
    const val = (body.accountName ?? body.account_name) as unknown;
    if (typeof val === "string") updateData.account_name = val.trim();
  }
  if (body.salaryGrade !== undefined || body.salary_grade !== undefined) {
    const val = (body.salaryGrade ?? body.salary_grade) as unknown;
    if (typeof val === "string") updateData.salary_grade = val.trim();
  }
  if (body.address !== undefined && typeof body.address === "string") {
    updateData.address = body.address.trim();
  }
  if (body.emergencyContactName !== undefined || body.emergency_contact_name !== undefined) {
    const val = (body.emergencyContactName ?? body.emergency_contact_name) as unknown;
    if (typeof val === "string") updateData.emergency_contact_name = val.trim();
  }
  if (body.emergencyContactPhone !== undefined || body.emergency_contact_phone !== undefined) {
    const val = (body.emergencyContactPhone ?? body.emergency_contact_phone) as unknown;
    if (typeof val === "string") updateData.emergency_contact_phone = val.trim();
  }
  if (body.dateOfBirth !== undefined || body.date_of_birth !== undefined) {
    const val = (body.dateOfBirth ?? body.date_of_birth) as unknown;
    updateData.date_of_birth = typeof val === "string" && val.trim() ? val.trim() : null;
  }
  if (body.employmentDate !== undefined || body.employment_date !== undefined) {
    const val = (body.employmentDate ?? body.employment_date) as unknown;
    updateData.employment_date = typeof val === "string" && val.trim() ? val.trim() : null;
  }

  // 3. Database Write
  let { data: updated, error: updateErr } = await supabase
    .from("staff")
    .update(updateData)
    .eq("id", existing.id)
    .select()
    .single();

  // Graceful fallback if class_id or section_id columns are not yet present in remote DB
  if (updateErr && /class_id|section_id/i.test(updateErr.message)) {
    const fallbackData = { ...updateData };
    delete fallbackData.class_id;
    delete fallbackData.section_id;
    const retry = await supabase
      .from("staff")
      .update(fallbackData)
      .eq("id", existing.id)
      .select()
      .single();
    updated = retry.data;
    updateErr = retry.error;
  }

  if (updateErr) {
    if (updateErr.code === "23505" || /duplicate key|unique constraint/i.test(updateErr.message)) {
      if (/staff_id/i.test(updateErr.message)) {
        return NextResponse.json({ success: false, error: "Staff ID already assigned to another staff member" }, { status: 409 });
      }
      if (/username/i.test(updateErr.message)) {
        return NextResponse.json({ success: false, error: "Username already assigned to another staff member" }, { status: 409 });
      }
      if (/email/i.test(updateErr.message)) {
        return NextResponse.json({ success: false, error: "Email address already registered to another staff member" }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: "A unique constraint conflict occurred: " + updateErr.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 502 });
  }

  // 4. Cross-Table Consistency
  const oldStaffId = existing.staff_id;
  const newStaffId = (updateData.staff_id as string) || oldStaffId;
  const newFullName = (updateData.full_name as string) || existing.full_name;
  const newEmail = (updateData.email as string) || existing.email;

  // A. Sync to app_accounts (for Access Slips and login consistency)
  const accountUpdates: Record<string, unknown> = {};
  if (updateData.full_name) accountUpdates.display_name = newFullName;
  if (updateData.staff_id) accountUpdates.staff_id = newStaffId;
  if (updateData.email) accountUpdates.email = newEmail;
  if (updateData.status) accountUpdates.status = updateData.status === "Suspended" ? "Suspended" : "Active";
  if (updateData.role) accountUpdates.role = updateData.role;

  if (Object.keys(accountUpdates).length > 0) {
    await supabase
      .from("app_accounts")
      .update(accountUpdates)
      .or(`staff_id.eq.${oldStaffId},username.eq.${existing.username}`);
  }

  // B. Sync to id_cards
  await supabase
    .from("id_cards")
    .update({
      holder_ref: newStaffId,
      holder_name: newFullName,
      updated_at: new Date().toISOString(),
    })
    .eq("holder_type", "staff")
    .eq("holder_ref", oldStaffId);

  // C. Sync to staff_duties roster
  await supabase
    .from("staff_duties")
    .update({
      staff_id: newStaffId,
      staff_name: newFullName,
      designation: updateData.designation !== undefined ? (updateData.designation as string) : existing.designation,
      updated_at: new Date().toISOString(),
    })
    .eq("staff_id", oldStaffId);

  // D. Form Teacher & Class Arm Synchronization
  const willBeFormMaster = updateData.is_form_master !== undefined ? Boolean(updateData.is_form_master) : Boolean(existing.is_form_master);
  const targetClassName = (updateData.assigned_class as string) || existing.assigned_class;

  if (willBeFormMaster && targetClassName) {
    // Appoint this staff member as form teacher on the target class arm
    await supabase
      .from("class_arms")
      .update({
        form_teacher: newFullName,
        form_teacher_id: newStaffId,
        updated_at: new Date().toISOString(),
      })
      .eq("name", targetClassName);

    // If they were form teacher of another class arm previously, unassign them from that other arm
    await supabase
      .from("class_arms")
      .update({
        form_teacher: "Unassigned",
        form_teacher_id: "",
        updated_at: new Date().toISOString(),
      })
      .eq("form_teacher_id", oldStaffId)
      .neq("name", targetClassName);
  } else if (!willBeFormMaster) {
    // If no longer form master, clear any class arm currently assigned to this staff member
    await supabase
      .from("class_arms")
      .update({
        form_teacher: "Unassigned",
        form_teacher_id: "",
        updated_at: new Date().toISOString(),
      })
      .eq("form_teacher_id", oldStaffId);
  }

  return NextResponse.json({ success: true, data: updated });
}
