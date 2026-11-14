import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const READ_STUDENTS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "TESTERS"] as const;
const WRITE_STUDENTS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireRole(READ_STUDENTS);
  if (denied) return denied;

  const { id } = await context.params;
  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const isUuid = UUID_PATTERN.test(id.trim());
  let query = supabase.from("students").select("*");
  if (isUuid) {
    query = query.eq("id", id.trim());
  } else {
    query = query.eq("admission_no", id.trim());
  }

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ success: false, error: `Student with identifier ${id} not found.` }, { status: 404 });

  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireRole(WRITE_STUDENTS);
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
  let lookupQuery = supabase.from("students").select("*");
  if (isUuid) {
    lookupQuery = lookupQuery.eq("id", id.trim());
  } else {
    lookupQuery = lookupQuery.eq("admission_no", id.trim());
  }

  const { data: existing, error: lookupErr } = await lookupQuery.maybeSingle();
  if (lookupErr) return NextResponse.json({ success: false, error: lookupErr.message }, { status: 502 });
  if (!existing) return NextResponse.json({ success: false, error: `Student with identifier ${id} not found.` }, { status: 404 });

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // 1. Core Fields Validation & Normalization
  if (body.fullName !== undefined || body.full_name !== undefined) {
    const rawName = (body.fullName ?? body.full_name) as unknown;
    if (typeof rawName !== "string" || !rawName.trim()) {
      return NextResponse.json({ success: false, error: "Full name cannot be blank." }, { status: 400 });
    }
    updateData.full_name = rawName.trim();
  }

  if (body.admissionNo !== undefined || body.admission_no !== undefined) {
    const rawAdm = (body.admissionNo ?? body.admission_no) as unknown;
    if (typeof rawAdm !== "string" || !rawAdm.trim()) {
      return NextResponse.json({ success: false, error: "Admission number cannot be blank." }, { status: 400 });
    }
    const normalizedAdm = rawAdm.trim();
    // Cross-check duplicate admission number if changing
    if (normalizedAdm.toLowerCase() !== existing.admission_no.toLowerCase()) {
      const { data: dupStudent, error: dupErr } = await supabase
        .from("students")
        .select("id")
        .ilike("admission_no", normalizedAdm)
        .neq("id", existing.id)
        .maybeSingle();

      if (dupErr && dupErr.code !== "PGRST116") {
        return NextResponse.json({ success: false, error: dupErr.message }, { status: 502 });
      }
      if (dupStudent) {
        return NextResponse.json(
          { success: false, error: "Admission number already assigned to another pupil" },
          { status: 409 }
        );
      }
    }
    updateData.admission_no = normalizedAdm;
  }

  if (body.className !== undefined || body.class_name !== undefined) {
    const rawClass = (body.className ?? body.class_name) as unknown;
    if (typeof rawClass === "string" && rawClass.trim()) {
      updateData.class_name = rawClass.trim();
    }
  }

  if (body.gender !== undefined) {
    const rawGender = body.gender;
    updateData.gender = rawGender === "Female" ? "Female" : "Male";
  }

  if (body.house !== undefined) {
    const rawHouse = body.house;
    if (typeof rawHouse === "string" && rawHouse.trim()) {
      updateData.house = rawHouse.trim();
    }
  }

  if (body.guardianName !== undefined || body.guardian_name !== undefined) {
    const rawGuardian = (body.guardianName ?? body.guardian_name) as unknown;
    updateData.guardian_name = typeof rawGuardian === "string" && rawGuardian.trim() ? rawGuardian.trim() : null;
  }

  if (body.guardianPhone !== undefined || body.guardian_phone !== undefined) {
    const rawPhone = (body.guardianPhone ?? body.guardian_phone) as unknown;
    updateData.guardian_phone = typeof rawPhone === "string" && rawPhone.trim() ? rawPhone.trim() : null;
  }

  if (body.feeStatus !== undefined || body.fee_status !== undefined) {
    const rawFee = (body.feeStatus ?? body.fee_status) as unknown;
    if (typeof rawFee === "string" && rawFee.trim()) {
      updateData.fee_status = rawFee.trim();
    }
  }

  // 2. Extended Profile Fields (Safe Additive / Optional)
  if (body.dateOfBirth !== undefined || body.date_of_birth !== undefined) {
    const val = (body.dateOfBirth ?? body.date_of_birth) as unknown;
    updateData.date_of_birth = typeof val === "string" && val.trim() ? val.trim() : null;
  }
  if (body.bloodGroup !== undefined || body.blood_group !== undefined) {
    const val = (body.bloodGroup ?? body.blood_group) as unknown;
    if (typeof val === "string") updateData.blood_group = val.trim();
  }
  if (body.guardianEmail !== undefined || body.guardian_email !== undefined) {
    const val = (body.guardianEmail ?? body.guardian_email) as unknown;
    if (typeof val === "string") updateData.guardian_email = val.trim();
  }
  if (body.guardianAddress !== undefined || body.guardian_address !== undefined) {
    const val = (body.guardianAddress ?? body.guardian_address) as unknown;
    if (typeof val === "string") updateData.guardian_address = val.trim();
  }
  if (body.guardianRelationship !== undefined || body.guardian_relationship !== undefined) {
    const val = (body.guardianRelationship ?? body.guardian_relationship) as unknown;
    if (typeof val === "string") updateData.guardian_relationship = val.trim();
  }
  if (body.medicalNotes !== undefined || body.medical_notes !== undefined) {
    const val = (body.medicalNotes ?? body.medical_notes) as unknown;
    if (typeof val === "string") updateData.medical_notes = val.trim();
  }
  if (body.allergies !== undefined) {
    if (typeof body.allergies === "string") updateData.allergies = body.allergies.trim();
  }
  if (body.nationality !== undefined && typeof body.nationality === "string") {
    updateData.nationality = body.nationality.trim();
  }
  if (body.stateOfOrigin !== undefined || body.state_of_origin !== undefined) {
    const val = (body.stateOfOrigin ?? body.state_of_origin) as unknown;
    if (typeof val === "string") updateData.state_of_origin = val.trim();
  }
  if (body.lga !== undefined && typeof body.lga === "string") {
    updateData.lga = body.lga.trim();
  }
  if (body.religion !== undefined && typeof body.religion === "string") {
    updateData.religion = body.religion.trim();
  }

  // 3. Database Write
  const { data: updated, error: updateErr } = await supabase
    .from("students")
    .update(updateData)
    .eq("id", existing.id)
    .select()
    .single();

  if (updateErr) {
    if (updateErr.code === "23505" || /duplicate key|unique constraint/i.test(updateErr.message)) {
      return NextResponse.json(
        { success: false, error: "Admission number already assigned to another pupil" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 502 });
  }

  // 4. Cross-Table Consistency
  const oldAdmissionNo = existing.admission_no;
  const newAdmissionNo = (updateData.admission_no as string) || oldAdmissionNo;
  const newFullName = (updateData.full_name as string) || existing.full_name;

  if (oldAdmissionNo.toUpperCase() !== newAdmissionNo.toUpperCase()) {
    // Sync id_cards
    await supabase
      .from("id_cards")
      .update({ holder_ref: newAdmissionNo, holder_name: newFullName, updated_at: new Date().toISOString() })
      .eq("holder_type", "student")
      .eq("holder_ref", oldAdmissionNo);

    // Sync guardian links
    await supabase
      .from("guardian_students")
      .update({ admission_no: newAdmissionNo })
      .eq("admission_no", oldAdmissionNo);

    // Sync snapshot references
    await supabase
      .from("payment_records")
      .update({ admission_no: newAdmissionNo, student_name: newFullName })
      .eq("admission_no", oldAdmissionNo);

    await supabase
      .from("invoices")
      .update({ admission_no: newAdmissionNo, student_name: newFullName })
      .eq("admission_no", oldAdmissionNo);
  } else if (newFullName !== existing.full_name) {
    // Update name on active ID card and invoices
    await supabase
      .from("id_cards")
      .update({ holder_name: newFullName, updated_at: new Date().toISOString() })
      .eq("holder_type", "student")
      .eq("holder_ref", oldAdmissionNo);

    await supabase
      .from("payment_records")
      .update({ student_name: newFullName })
      .eq("student_id", existing.id);

    await supabase
      .from("invoices")
      .update({ student_name: newFullName })
      .eq("student_id", existing.id);
  }

  return NextResponse.json({ success: true, data: updated });
}
