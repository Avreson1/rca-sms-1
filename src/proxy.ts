import { NextResponse, type NextRequest } from "next/server";
import { isAppAccountSessionCurrent } from "@/lib/auth/revocation";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { DATABASE_FLAG_COOKIE } from "@/lib/supabase/client";

// The browser's copy of the address is inlined at build time, which misses
// hosts that only supply it at runtime. The server knows the truth on every
// request, so it tells the browser once per document response.
//
// Next inlines `process.env.NEXT_PUBLIC_*` reads into this proxy bundle at build
// time — literal keys, aliases and concatenated keys all get folded — which
// would freeze the address and stamp the flag "0" forever on a host that only
// supplies it at runtime. Reflect.get is not a member expression the compiler
// can substitute, so this stays a live lookup of the server's environment.
const supabaseUrl =
  (Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL") as string | undefined) || "";
const databaseConfigured = Boolean(
  supabaseUrl && !supabaseUrl.includes("placeholder") && process.env.SUPABASE_SERVICE_ROLE_KEY
);

function stampDatabaseFlag(response: NextResponse) {
  response.cookies.set(DATABASE_FLAG_COOKIE, databaseConfigured ? "1" : "0", {
    path: "/",
    sameSite: "lax",
  });
  return response;
}

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
      return stampDatabaseFlag(NextResponse.next());
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Session is no longer valid." }, { status: 401 });
    }

    const revokedUrl = request.nextUrl.clone();
    revokedUrl.search = "";
    revokedUrl.pathname = "/login";
    const revoked = NextResponse.redirect(revokedUrl);
    revoked.cookies.delete(SESSION_COOKIE);
    return stampDatabaseFlag(revoked);
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
  return stampDatabaseFlag(NextResponse.redirect(redirectUrl));
}

export const config = {
  // api/keep-warm is public for the same reason api/auth is: the scheduler that
  // visits it has no session to present.
  matcher: ["/((?!api/auth|api/keep-warm|login|welcome|blog|gallery|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
