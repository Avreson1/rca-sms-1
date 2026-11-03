import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StudentPayload = {
  id?: string;
  admission_no?: string;
  full_name?: string;
  gender?: string;
  class_name?: string;
  house?: string;
  guardian_name?: string;
  guardian_phone?: string;
  fee_status?: string;
};

function sanitizeStudent(raw: StudentPayload) {
  if (!raw || typeof raw !== "object") return null;
  const admissionNo = typeof raw.admission_no === "string" ? raw.admission_no.trim() : "";
  const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
  if (!admissionNo || !fullName) return null;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined,
    admission_no: admissionNo,
    full_name: fullName,
    gender: raw.gender === "Female" ? "Female" : "Male",
    class_name: typeof raw.class_name === "string" && raw.class_name ? raw.class_name : "Primary 1",
    house: typeof raw.house === "string" && raw.house ? raw.house : "Sapphire (Blue)",
    guardian_name: typeof raw.guardian_name === "string" ? raw.guardian_name : null,
    guardian_phone: typeof raw.guardian_phone === "string" ? raw.guardian_phone : null,
    fee_status: typeof raw.fee_status === "string" && raw.fee_status ? raw.fee_status : "Outstanding",
  };
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("students")
    .select("*, ca_scores(test1, test2, project, mid_term, exam)")
    .order("created_at", { ascending: false });
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

  const list = Array.isArray(body) ? body : [body];
  const rows = list.map((item) => sanitizeStudent(item as StudentPayload)).filter((row): row is NonNullable<typeof row> => row !== null);
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "Provide at least one student with admission_no and full_name." }, { status: 400 });
  }

  const { error } = await supabase.from("students").upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  return NextResponse.json({ success: true });
}
