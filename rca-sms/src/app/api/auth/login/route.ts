import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthProfile } from "@/lib/auth";

const GENERIC_ERROR = "Invalid username/email or password.";

// Basic brute-force throttle (per server instance; Supabase Auth applies its own limits too).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 5;
const MAX_PER_IP = 20;
const failures = new Map<string, { count: number; first: number }>();

function failureCount(key: string) {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return 0;
  }
  return entry.count;
}

function recordFailure(...keys: string[]) {
  for (const key of keys) {
    const entry = failures.get(key);
    if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
    else entry.count += 1;
  }
}

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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipKey = `ip:${ip}`;
  const accountKey = `id:${identifier.toLowerCase()}`;
  if (failureCount(ipKey) >= MAX_PER_IP || failureCount(accountKey) >= MAX_PER_ACCOUNT) {
    return NextResponse.json(
      { success: false, error: "Too many failed sign-in attempts. Please wait 15 minutes and try again." },
      { status: 429 }
    );
  }
  const fail = () => {
    recordFailure(ipKey, accountKey);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 401 });
  };

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
    const safeId = identifier.replace(/[^\w./-]/g, "");
    const { data: staff } = await admin
      .from("staff")
      .select("email")
      .or(`username.eq.${safeId},staff_id.eq.${safeId}`)
      .limit(1)
      .maybeSingle<{ email: string }>();
    let resolved = staff?.email ?? null;

    if (!resolved) {
      // Parents / students may sign in with the admission number their login is linked to.
      const { data: student } = await admin
        .from("students")
        .select("portal_user_id")
        .ilike("admission_no", safeId)
        .not("portal_user_id", "is", null)
        .limit(1)
        .maybeSingle<{ portal_user_id: string }>();
      if (student?.portal_user_id) {
        const { data: authUser } = await admin.auth.admin.getUserById(student.portal_user_id);
        resolved = authUser?.user?.email ?? null;
      }
    }

    if (!resolved) return fail();
    email = resolved;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail();
  failures.delete(accountKey);

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
