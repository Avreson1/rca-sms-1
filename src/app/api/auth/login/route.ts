import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/auth/accounts";
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

  const user = await verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials. Please check your username and passcode." }, { status: 401 });
  }

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
