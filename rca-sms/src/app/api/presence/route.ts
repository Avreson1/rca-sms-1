import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

interface UserPresenceItem {
  id: string;
  username: string;
  name: string;
  role: string;
  staffId?: string;
  lastSeen: number;
  status: "Active now" | "Idle (2m)" | "Active (5m)";
}

// In-memory active presence cache (dynamic heartbeats from active sessions)
const activeUsers: Record<string, UserPresenceItem> = {};

export async function GET() {
  const auth = await requireRole("ANY");
  if ("error" in auth) return auth.error;
  const now = Date.now();
  // Filter users active in the last 10 minutes
  const activeEntries = Object.entries(activeUsers).filter(
    ([, user]) => now - user.lastSeen < 10 * 60 * 1000
  );

  const onlineList = activeEntries.map(([, user]) => {
    const diffSeconds = Math.floor((now - user.lastSeen) / 1000);
    let statusText: "Active now" | "Idle (2m)" | "Active (5m)" = "Active now";
    if (diffSeconds > 120) statusText = "Active (5m)";
    else if (diffSeconds > 60) statusText = "Idle (2m)";

    return {
      ...user,
      status: statusText,
      secondsAgo: diffSeconds,
    };
  });

  return NextResponse.json({
    onlineCount: onlineList.length,
    users: onlineList,
    serverTimestamp: now,
  });
}

export async function POST() {
  // Identity comes from the verified session, never from the request body.
  const auth = await requireRole("ANY");
  if ("error" in auth) return auth.error;
  const { profile } = auth;
  const now = Date.now();

  activeUsers[profile.authUserId] = {
    id: `p-${profile.authUserId}`,
    username: profile.username,
    name: profile.fullName,
    role: profile.role.replace("_", " "),
    staffId: profile.staffId,
    lastSeen: now,
    status: "Active now",
  };

  return NextResponse.json({ success: true, timestamp: now });
}
