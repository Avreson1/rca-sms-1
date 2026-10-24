import { NextResponse } from "next/server";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (isSupabaseServerConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("students")
        .select("*, ca_scores(*)")
        .order("admission_no", { ascending: true });

      if (!error && data) {
        return NextResponse.json({ success: true, count: data.length, data });
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: "Students endpoint ready. Provide Supabase credentials for persistent storage.",
    data: [],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (isSupabaseServerConfigured) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.from("students").insert(body).select().single();
        if (!error && data) {
          return NextResponse.json({ success: true, message: "Student enrolled in Supabase", data });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Student record processed.",
      data: body,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid student payload" }, { status: 400 });
  }
}
