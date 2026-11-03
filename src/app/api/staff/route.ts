import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

  const { data, error } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

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
  return NextResponse.json({ success: true });
}
