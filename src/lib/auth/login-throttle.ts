// Brute-force brake for POST /api/auth/login.
//
// The counters live in this process's memory. That is enough to make a scripted
// password run expensive, but it resets on a restart and is per-instance; a
// shared store would need something like Redis, which this app does not run.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

type Attempt = { failures: number[]; blockedUntil: number };

const attempts = new Map<string, Attempt>();

/**
 * Render terminates TLS in front of the app and appends the caller's address,
 * so the first entry of x-forwarded-for is the client and the rest are proxies.
 */
export function requestClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip") ?? "unknown-ip";
}

export function loginAttemptKey(ip: string, username: string): string {
  return `${ip}|${username.trim().toLowerCase()}`;
}

export function loginLockFor(key: string): { retryAfterSeconds: number } | null {
  const entry = attempts.get(key);
  if (!entry) return null;
  const remaining = entry.blockedUntil - Date.now();
  if (remaining <= 0) return null;
  return { retryAfterSeconds: Math.ceil(remaining / 1000) };
}

/** Returns the lock the attempt just triggered, so the fifth wrong passcode says so. */
export function registerFailedLogin(key: string): { retryAfterSeconds: number } | null {
  pruneIfFull();
  const now = Date.now();
  const entry = attempts.get(key) ?? { failures: [], blockedUntil: 0 };
  entry.failures = entry.failures.filter((at) => now - at < WINDOW_MS);
  entry.failures.push(now);
  if (entry.failures.length < MAX_FAILURES) {
    attempts.set(key, entry);
    return null;
  }
  entry.blockedUntil = now + BLOCK_MS;
  entry.failures = [];
  attempts.set(key, entry);
  return { retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
}

export function registerSuccessfulLogin(key: string): void {
  attempts.delete(key);
}

function pruneIfFull(): void {
  if (attempts.size < MAX_TRACKED_KEYS) return;
  const now = Date.now();
  for (const [key, entry] of attempts) {
    const stillBlocked = entry.blockedUntil > now;
    const recentFailure = entry.failures.some((at) => now - at < WINDOW_MS);
    if (!stillBlocked && !recentFailure) attempts.delete(key);
  }
}
