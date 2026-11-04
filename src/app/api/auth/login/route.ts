import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/auth/accounts";
import {
  loginAttemptKey,
  loginLockFor,
  registerFailedLogin,
  registerSuccessfulLogin,
  requestClientIp,
} from "@/lib/auth/login-throttle";
import { createSessionToken, getSessionSecret, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Authentication is not configured. Set AUTH_SESSION_SECRET on the server." },
      { status: 500 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = (body.password || "").trim();

  if (!username || !password) {
    return NextResponse.json({ error: "Enter both your username and passcode." }, { status: 400 });
  }

  // Counted per address *and* username, so a run of wrong passwords against one
  // account cannot be reset by moving to another machine.
  const attemptKey = loginAttemptKey(requestClientIp(request), username);
  const tooSoon = (lock: { retryAfterSeconds: number }) => {
    const wait =
      lock.retryAfterSeconds >= 120
        ? `${Math.ceil(lock.retryAfterSeconds / 60)} minutes`
        : `${lock.retryAfterSeconds} seconds`;
    return NextResponse.json(
      { error: `Too many failed sign-in attempts for this username. Try again in ${wait}.` },
      { status: 429, headers: { "Retry-After": String(lock.retryAfterSeconds) } }
    );
  };

  const existingLock = loginLockFor(attemptKey);
  if (existingLock) return tooSoon(existingLock);

  const user = await verifyCredentials(username, password);
  if (!user) {
    const justLocked = registerFailedLogin(attemptKey);
    if (justLocked) return tooSoon(justLocked);
    return NextResponse.json({ error: "Invalid credentials. Please check your username and passcode." }, { status: 401 });
  }

  registerSuccessfulLogin(attemptKey);

  const response = NextResponse.json({ success: true, user });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
