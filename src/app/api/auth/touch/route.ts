import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  getSessionSecret,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Activity heartbeat. The proxy matcher skips api/auth, so this route verifies
// the cookie itself and, while it is still valid, reissues it with a fresh
// five-minute exp. Once the token has expired this returns 401 and the browser
// is sent back to the sign-in door.
export async function POST() {
  const secret = getSessionSecret();
  if (!secret) return NextResponse.json({ success: false }, { status: 401 });

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, secret);
  if (!session) {
    return NextResponse.json({ success: false, error: "Session expired." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(session, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Session cookie: no max-age, so closing the browser ends it regardless of
    // how recently it was touched.
  });
  return response;
}