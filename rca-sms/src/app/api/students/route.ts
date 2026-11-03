import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

const STUDENT_FIELDS = ["admission_no", "full_name", "gender", "class_name", "house", "guardian_name", "guardian_phone"] as const;

export async function GET() {
  const auth = await requireRole("ANY");
  if ("error" in auth) return auth.error;

  // RLS limits STUDENT_PARENT accounts to their own linked records.
  const { data, error } = await auth.supabase
    .from("students")
    .select("*, ca_scores(*)")
    .order("admission_no", { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: data.length, data });
}

export async function POST(request: Request) {
  const auth = await requireRole(["SUPER_ADMIN", "EXAM_OFFICER"]);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid student payload" }, { status: 400 });
  }
  const record = Object.fromEntries(STUDENT_FIELDS.filter((k) => k in body).map((k) => [k, body[k]]));

  const { data, error } = await auth.supabase.from("students").insert(record).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: "Student enrolled", data }, { status: 201 });
}
