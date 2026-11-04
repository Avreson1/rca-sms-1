import { NextResponse } from "next/server";
import { getSessionUser, requireSuperAdmin } from "@/lib/auth/guard";
import { clearGuardianLinks, replaceGuardianLinks } from "@/lib/auth/guardian-links";
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

  let body: { status?: string; resetPassword?: boolean; admissionNos?: unknown };
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

  // Replacing the children behind a parent login. The whole set is sent each
  // time, so unlinking a pupil is a matter of leaving it out.
  if (Array.isArray(body.admissionNos)) {
    const { account, error: lookupError } = await getAppAccountById(id);
    if (!account) {
      return NextResponse.json({ success: false, error: lookupError ?? "Account not found" }, { status: failureStatus(lookupError) });
    }
    if (account.role !== "STUDENT_PARENT") {
      return NextResponse.json(
        { success: false, error: `“${account.username}” is a ${account.role} login. Only a Student / Parent login links pupils.` },
        { status: 400 }
      );
    }

    const session = await getSessionUser();
    const admissionNos = body.admissionNos.filter((item): item is string => typeof item === "string");
    const { unknownAdmissionNos, error } = await replaceGuardianLinks(
      account.username,
      admissionNos,
      session?.username ?? ""
    );
    if (unknownAdmissionNos.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No enrolled pupil for ${unknownAdmissionNos.slice(0, 5).join(", ")}${unknownAdmissionNos.length > 5 ? ", + more" : ""}. Nothing was changed.`,
        },
        { status: 404 }
      );
    }
    if (error) {
      const status = error === "Database not configured" ? 503 : 502;
      return NextResponse.json({ success: false, error }, { status });
    }

    return NextResponse.json({ success: true, data: { username: account.username, guardian_of: admissionNos } });
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
    {
      success: false,
      error:
        'Send { "status": "Active" | "Suspended" }, { "resetPassword": true }, or { "admissionNos": ["RCA/2025/001"] } for a Student / Parent login.',
    },
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

  const { account } = await getAppAccountById(id);
  const error = await deleteAppAccount(id);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: failureStatus(error) });
  }

  // Links are keyed on the username, not the row id, so a deleted login would
  // otherwise hand its children to whoever takes the username next.
  if (account) await clearGuardianLinks(account.username);

  return NextResponse.json({ success: true });
}
