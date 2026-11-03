import { NextResponse, type NextRequest } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = getSessionSecret();
  const session = secret
    ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;

  if (session) {
    return NextResponse.next();
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
