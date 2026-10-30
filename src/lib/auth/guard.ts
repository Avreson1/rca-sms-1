import { cookies } from "next/headers";
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
