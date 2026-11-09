export type SessionRole =
  | "SUPER_ADMIN"
  | "EXAM_OFFICER"
  | "TEACHER"
  | "ACCOUNTANT"
  | "STUDENT_PARENT"
  | "TESTERS";

export interface SessionUser {
  username: string;
  fullName: string;
  role: SessionRole;
  staffId: string;
  email: string;
  /**
   * Revision counter of an app-managed account, carried so the proxy can tell a
   * still-current cookie from one issued before a reset or suspension. Absent on
   * environment accounts, which are not revocable and need no database lookup.
   */
  epoch?: number;
}

export const SESSION_COOKIE = "rca_session";
/**
 * Length of the inactivity window. The token's `exp` is set to "now + this" on
 * sign-in and slid forward by the same amount on every activity heartbeat
 * (`/api/auth/touch`), so a session dies five minutes after the last action.
 * The cookie itself carries no max-age: it is a browser-session cookie and is
 * dropped when the browser closes, independent of this idle window.
 */
export const SESSION_IDLE_SECONDS = 5 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function getSessionSecret(): string {
  return process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export async function createSessionToken(user: SessionUser, secret: string): Promise<string> {
  const payload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_IDLE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await importHmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string
): Promise<SessionUser | null> {
  if (!token || !secret) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await importHmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(body)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      username: String(payload.username),
      fullName: String(payload.fullName),
      role: payload.role,
      staffId: String(payload.staffId ?? ""),
      email: String(payload.email ?? ""),
      epoch: typeof payload.epoch === "number" ? payload.epoch : undefined,
    };
  } catch {
    return null;
  }
}
