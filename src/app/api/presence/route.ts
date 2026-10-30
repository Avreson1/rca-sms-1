import { NextResponse } from "next/server";

interface UserPresenceItem {
  id: string;
  username: string;
  name: string;
  role: string;
  staffId?: string;
  lastSeen: number;
  status: "Active now" | "Idle (2m)" | "Active (5m)";
  isSelf?: boolean;
}

// In-memory active presence cache (dynamic heartbeats from active sessions)
const activeUsers: Record<string, UserPresenceItem> = {};

export async function GET() {
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = body.username || "dominic370";
    const now = Date.now();

    activeUsers[username] = {
      id: `p-${username}`,
      username: username,
      name: body.name || "Dominic Mark (You)",
      role: body.role || "Administrator / ICT",
      staffId: body.staffId || "RCA/PERS/025",
      lastSeen: now,
      status: "Active now",
      isSelf: true,
    };

    return NextResponse.json({ success: true, timestamp: now });
  } catch (error) {
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 400 });
  }
}
