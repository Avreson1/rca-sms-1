import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/rbac";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "./session";

export async function getSessionUser() {
  const secret = getSessionSecret();
  if (!secret) return null;
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, secret);
}

export async function requireSuperAdmin(): Promise<boolean> {
  const session = await getSessionUser();
  return session?.role === "SUPER_ADMIN";
}

/**
 * Returns null when the signed-in role may proceed, otherwise the 401/403
 * response the handler should return. The proxy proves the cookie is genuine;
 * this proves the role, so a valid session from the wrong department cannot
 * read a table it has no business seeing.
 */
export async function requireRole(roles: readonly UserRole[]): Promise<NextResponse | null> {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }
  if (!roles.includes(session.role)) {
    return NextResponse.json({ success: false, error: "Your role cannot access this data." }, { status: 403 });
  }
  return null;
}
