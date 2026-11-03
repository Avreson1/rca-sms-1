import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";

type PresenceStatus = "Active now" | "Idle (2m)" | "Active (5m)";

interface PresenceEntry {
  id: string;
  username: string;
  name: string;
  role: string;
  staffId: string;
  lastSeen: number;
}

// Heartbeats live in this process's memory and are forgotten on a restart; the
// widget re-registers within one 5-second sync. A shared store would be needed
// for the count to survive more than one instance.
const activeUsers = new Map<string, PresenceEntry>();

const STALE_AFTER_MS = 10 * 60 * 1000;

export async function GET() {
  const viewer = await getSessionUser();
  if (!viewer) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const now = Date.now();
  for (const [username, entry] of activeUsers) {
    if (now - entry.lastSeen >= STALE_AFTER_MS) activeUsers.delete(username);
  }

  const users = Array.from(activeUsers.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const secondsAgo = Math.floor((now - entry.lastSeen) / 1000);
      const status: PresenceStatus = secondsAgo > 120 ? "Active (5m)" : secondsAgo > 60 ? "Idle (2m)" : "Active now";
      return { ...entry, status, secondsAgo, isSelf: entry.username === viewer.username };
    });

  return NextResponse.json({ onlineCount: users.length, users, serverTimestamp: now });
}

/**
 * The heartbeat carries no identity. It used to accept name, role and staff ID
 * from the request body, so any signed-in browser could put "Administrator /
 * ICT" and someone else's staff number on its own presence card.
 */
export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Presence needs a session. Sign in again." },
      { status: 401 }
    );
  }

  const now = Date.now();
  activeUsers.set(session.username, {
    id: `p-${session.username}`,
    username: session.username,
    name: session.fullName || session.username,
    role: session.role.replace(/_/g, " "),
    staffId: session.staffId,
    lastSeen: now,
  });

  return NextResponse.json({ success: true, timestamp: now });
}
