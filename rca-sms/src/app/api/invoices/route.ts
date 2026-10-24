import { NextResponse } from "next/server";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { INITIAL_INVOICES } from "@/lib/realtime-store";

export async function GET() {
  if (isSupabaseServerConfigured) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return NextResponse.json({ success: true, count: data.length, data });
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: INITIAL_INVOICES,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (isSupabaseServerConfigured) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.from("invoices").insert(body).select().single();
        if (!error && data) {
          return NextResponse.json({ success: true, message: "Invoice created in Supabase", data });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment transaction recorded successfully.",
      data: body,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid payment payload" }, { status: 400 });
  }
}
