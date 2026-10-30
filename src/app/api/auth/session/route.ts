import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = getSessionSecret();
  const cookieStore = await cookies();
  const session = secret ? await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, secret) : null;

  if (!session) return NextResponse.json({ success: false, user: null }, { status: 401 });
  return NextResponse.json({ success: true, user: session });
}
