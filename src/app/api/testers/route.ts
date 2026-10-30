import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser, requireSuperAdmin } from "@/lib/auth/guard";
import { createTesterAccount, listTesterAccounts } from "@/lib/auth/tester-accounts";

export const dynamic = "force-dynamic";

function deriveUsername(displayName: string): string {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 24) || "tester";
  return `${base}.${randomBytes(2).toString("hex")}`;
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { accounts, error } = await listTesterAccounts();
  if (accounts === null) {
    const status = error === "Database not configured" ? 503 : 502;
    return NextResponse.json({ success: false, error }, { status });
  }
  return NextResponse.json({ success: true, data: accounts });
}

export async function POST(request: Request) {
  const authorized = await requireSuperAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { displayName?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const displayName = (body.displayName || "").trim();
  if (!displayName || displayName.length > 120) {
    return NextResponse.json({ success: false, error: "Provide a display name (max 120 characters)." }, { status: 400 });
  }

  let username = (body.username || "").trim().toLowerCase();
  if (!username) username = deriveUsername(displayName);
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return NextResponse.json(
      { success: false, error: "Username must be 3-30 characters of letters, numbers, dots, dashes or underscores." },
      { status: 400 }
    );
  }

  const session = await getSessionUser();
  const { account, error } = await createTesterAccount(username, displayName, session?.username ?? "super_admin");
  if (!account) {
    const status = error === "Database not configured" ? 503 : error?.includes("duplicate") || error?.includes("unique") ? 409 : 502;
    return NextResponse.json({ success: false, error: error ?? "Failed to create account" }, { status });
  }

  return NextResponse.json({ success: true, data: account });
}
