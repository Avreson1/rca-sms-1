import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/rbac";
import { getSessionSecret, SESSION_COOKIE, verifySessionToken } from "./session";
import type { SessionUser } from "./session";

export async function getSessionUser(): Promise<SessionUser | null> {
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
  const access = await requireRoleSession(roles);
  return access.denied;
}

/**
 * Same gate, but also hands the route the session it authorised. Routes that
 * serve less than the whole school to the person asking — a parent sees their
 * own children — need to know whose scope to apply.
 */
export async function requireRoleSession(
  roles: readonly UserRole[]
): Promise<{ session: SessionUser; denied: null } | { session: null; denied: NextResponse }> {
  const session = await getSessionUser();
  if (!session) {
    return {
      session: null,
      denied: NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (!roles.includes(session.role)) {
    return {
      session: null,
      denied: NextResponse.json({ success: false, error: "Your role cannot access this data." }, { status: 403 }),
    };
  }
  return { session, denied: null };
}
