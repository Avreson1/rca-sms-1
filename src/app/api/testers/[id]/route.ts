import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { regenerateTesterPassword, revokeTesterAccount } from "@/lib/auth/tester-accounts";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ success: false, error: "Missing account id." }, { status: 400 });

  const { account, error } = await regenerateTesterPassword(id);
  if (!account) {
    const status = error === "Database not configured" ? 503 : 502;
    return NextResponse.json({ success: false, error: error ?? "Failed to regenerate password" }, { status });
  }
  return NextResponse.json({ success: true, data: account });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ success: false, error: "Missing account id." }, { status: 400 });

  const error = await revokeTesterAccount(id);
  if (error) {
    const status = error === "Database not configured" ? 503 : 502;
    return NextResponse.json({ success: false, error }, { status });
  }
  return NextResponse.json({ success: true });
}
