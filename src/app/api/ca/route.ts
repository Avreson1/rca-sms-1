import { NextResponse } from "next/server";

export async function POST(request: Request) {
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
