import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthProfile } from "@/lib/auth";

const GENERIC_ERROR = "Invalid username/email or password.";

export async function POST(request: Request) {
  let identifier = "";
  let password = "";
  try {
    const body = await request.json();
    identifier = String(body.identifier ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  if (!identifier || !password) {
    return NextResponse.json({ success: false, error: "Enter your username/email and password." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Authentication is not configured" }, { status: 503 });
  }

  let email = identifier;
  if (!identifier.includes("@")) {
    // Username / staff ID lookup happens server-side so the staff table never needs to be public.
    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Sign in with your email address." }, { status: 400 });
    }
    const { data } = await admin
      .from("staff")
      .select("email")
      .or(`username.eq.${identifier.replace(/[^\w./-]/g, "")},staff_id.eq.${identifier.replace(/[^\w./-]/g, "")}`)
      .limit(1)
      .maybeSingle<{ email: string }>();
    if (!data?.email) {
      return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 401 });
    }
    email = data.email;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 401 });
  }

  const { profile } = await getAuthProfile(supabase);
  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { success: false, error: "This account is not linked to an active staff or student record." },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, user: profile });
}
