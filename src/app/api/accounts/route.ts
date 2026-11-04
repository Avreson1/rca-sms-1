import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser, requireSuperAdmin } from "@/lib/auth/guard";
import { allGuardianLinks, replaceGuardianLinks } from "@/lib/auth/guardian-links";
import {
  ASSIGNABLE_ROLES,
  createAppAccount,
  isAssignableRole,
  listAppAccounts,
} from "@/lib/auth/app-accounts";
import type { UserRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function deriveUsername(displayName: string): string {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 24) || "user";
  return `${base}.${randomBytes(2).toString("hex")}`;
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { accounts, error } = await listAppAccounts();
  if (accounts === null) {
    const status = error === "Database not configured" ? 503 : 502;
    return NextResponse.json({ success: false, error }, { status });
  }

  // Which pupils sit behind each parent login. A missing link table only costs
  // the column, not the list: the manager stays usable.
  const { links } = await allGuardianLinks();
  const withChildren = accounts.map((account) => ({
    ...account,
    guardian_of: links[account.username.toLowerCase()] ?? [],
  }));

  return NextResponse.json({ success: true, data: withChildren });
}

export async function POST(request: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    displayName?: string;
    username?: string;
    role?: string;
    staffId?: string;
    email?: string;
    admissionNos?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const displayName = (body.displayName || "").trim();
  if (!displayName || displayName.length > 120) {
    return NextResponse.json({ success: false, error: "Provide a display name (max 120 characters)." }, { status: 400 });
  }

  if (!isAssignableRole(body.role)) {
    return NextResponse.json(
      { success: false, error: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}.` },
      { status: 400 }
    );
  }
  const role = body.role as UserRole;

  let username = (body.username || "").trim().toLowerCase();
  if (!username) username = deriveUsername(displayName);
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return NextResponse.json(
      { success: false, error: "Username must be 3-30 characters of letters, numbers, dots, dashes or underscores." },
      { status: 400 }
    );
  }

  const email = (body.email || "").trim();
  if (email && !email.includes("@")) {
    return NextResponse.json({ success: false, error: "Email must contain an @ sign." }, { status: 400 });
  }

  const session = await getSessionUser();
  const admissionNos = Array.isArray(body.admissionNos)
    ? body.admissionNos.filter((item): item is string => typeof item === "string")
    : [];

  if (admissionNos.length > 0 && role !== "STUDENT_PARENT") {
    return NextResponse.json(
      { success: false, error: "Only a Student / Parent login links pupils. Leave the admission numbers empty for other roles." },
      { status: 400 }
    );
  }

  const { account, error } = await createAppAccount({
    username,
    displayName,
    role,
    staffId: (body.staffId || "").trim(),
    email,
    createdBy: session?.username ?? "super_admin",
  });

  if (!account) {
    const status =
      error === "Database not configured"
        ? 503
        : error?.includes("duplicate") || error?.includes("unique")
          ? 409
          : 502;
    return NextResponse.json(
      { success: false, error: status === 409 ? `“${username}” is already taken.` : (error ?? "Failed to create account") },
      { status }
    );
  }

  if (admissionNos.length > 0) {
    const { unknownAdmissionNos, error: linkError } = await replaceGuardianLinks(
      account.username,
      admissionNos,
      session?.username ?? ""
    );
    // A link that worked is part of a successful account, so it must not be
    // reported as one: the manager reads a non-2xx as "nothing was linked" and
    // the office then re-types children it has already given the login.
    if (linkError || unknownAdmissionNos.length > 0) {
      const reason = linkError
        ? `the link could not be saved (${linkError})`
        : `no enrolled pupil for ${unknownAdmissionNos.slice(0, 5).join(", ")}${unknownAdmissionNos.length > 5 ? ", + more" : ""}`;
      return NextResponse.json(
        {
          success: false,
          error: `Login “${account.username}” was created with its password, but no pupil was linked to it — ${reason}. Check the admission numbers, then link the children from the account row before the parent signs in.`,
          data: account,
        },
        { status: linkError ? 502 : 400 }
      );
    }
  }

  return NextResponse.json({ success: true, data: account });
}
