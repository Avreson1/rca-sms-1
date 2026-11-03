import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";

// Matches isActionAuthorized("ENTER_CA") in src/lib/rbac.ts. TESTERS is absent on
// purpose: QA may exercise modules, never a write path.
const ENTER_CA = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER"] as const;

export async function POST(request: Request) {
  const denied = await requireRole(ENTER_CA);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { admissionNo, scores, cbtScore } = body;
    return NextResponse.json({
      success: true,
      message: `Continuous assessment scores updated for ${admissionNo}`,
      data: { admissionNo, scores, cbtScore, updatedAt: new Date().toISOString() },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid CA payload" }, { status: 400 });
  }
}
