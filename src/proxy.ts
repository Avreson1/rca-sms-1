import { NextResponse, type NextRequest } from "next/server";
import { isAppAccountSessionCurrent } from "@/lib/auth/revocation";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = getSessionSecret();
  const session = secret
    ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;

  if (session) {
    // Environment accounts carry no epoch and cannot be revoked from the app.
    // App-managed accounts are re-checked against the row that issued the
    // cookie, so suspending someone or resetting their password takes effect
    // on the next request rather than at cookie expiry.
    if (!session.epoch || (await isAppAccountSessionCurrent(session.username, session.epoch))) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Session is no longer valid." }, { status: 401 });
    }

    const revokedUrl = request.nextUrl.clone();
    revokedUrl.search = "";
    revokedUrl.pathname = "/login";
    const revoked = NextResponse.redirect(revokedUrl);
    revoked.cookies.delete(SESSION_COOKIE);
    return revoked;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.search = "";

  // Visitors without a session see the public landing page first; the
  // dashboard itself stays login-gated.
  if (pathname === "/") {
    redirectUrl.pathname = "/welcome";
  } else {
    redirectUrl.pathname = "/login";
  }
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api/auth|login|welcome|blog|gallery|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
