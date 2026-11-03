import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

const STAFF_FIELDS = ["staff_id", "full_name", "username", "email", "phone", "role", "assigned_subjects", "assigned_class", "is_form_master", "status"] as const;

export async function GET() {
  const auth = await requireRole(["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT"]);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("staff")
    .select("id, staff_id, full_name, username, email, phone, role, assigned_subjects, assigned_class, is_form_master, status")
    .order("staff_id", { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: data.length, data });
}

export async function POST(request: Request) {
  const auth = await requireRole(["SUPER_ADMIN"]);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid staff payload" }, { status: 400 });
  }
  const record = Object.fromEntries(STAFF_FIELDS.filter((k) => k in body).map((k) => [k, body[k]]));

  const { data, error } = await auth.supabase.from("staff").insert(record).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: "Staff member registered", data }, { status: 201 });
}
