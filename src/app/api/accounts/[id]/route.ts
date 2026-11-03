import { NextResponse } from "next/server";
import { getSessionUser, requireSuperAdmin } from "@/lib/auth/guard";
import {
  deleteAppAccount,
  getAppAccountById,
  resetAppAccountPassword,
  setAppAccountStatus,
} from "@/lib/auth/app-accounts";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failureStatus(error: string | null): number {
  if (error === "Database not configured") return 503;
  if (error === "Account not found") return 404;
  return 502;
}

/**
 * The manager operates on other people. Touching your own row would drop the
 * session you are standing in, and a mistuned click could empty the portal of
 * every admin who can reach this screen.
 */
async function isOwnAccount(id: string): Promise<boolean> {
  const session = await getSessionUser();
  if (!session) return false;
  const { account } = await getAppAccountById(id);
  return Boolean(account && account.username.toLowerCase() === session.username.toLowerCase());
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ success: false, error: "Unknown account." }, { status: 400 });
  }

  let body: { status?: string; resetPassword?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (await isOwnAccount(id)) {
    return NextResponse.json(
      { success: false, error: "You cannot change or reset the account you are signed in with." },
      { status: 400 }
    );
  }

  if (body.resetPassword) {
    const { account, error } = await resetAppAccountPassword(id);
    if (!account) {
      return NextResponse.json({ success: false, error: error ?? "Failed to reset password" }, { status: failureStatus(error) });
    }
    return NextResponse.json({ success: true, data: account });
  }

  if (body.status === "Active" || body.status === "Suspended") {
    const { account, error } = await setAppAccountStatus(id, body.status);
    if (!account) {
      return NextResponse.json({ success: false, error: error ?? "Failed to update account" }, { status: failureStatus(error) });
    }
    return NextResponse.json({ success: true, data: account });
  }

  return NextResponse.json(
    { success: false, error: 'Send either { "status": "Active" | "Suspended" } or { "resetPassword": true }.' },
    { status: 400 }
  );
}

export async function DELETE(_: Request, context: RouteContext) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ success: false, error: "Unknown account." }, { status: 400 });
  }

  if (await isOwnAccount(id)) {
    return NextResponse.json(
      { success: false, error: "You cannot delete the account you are signed in with." },
      { status: 400 }
    );
  }

  const error = await deleteAppAccount(id);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: failureStatus(error) });
  }
  return NextResponse.json({ success: true });
}
