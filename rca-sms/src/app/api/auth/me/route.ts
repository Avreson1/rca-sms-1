import { NextResponse } from "next/server";
import { getAuthProfile } from "@/lib/auth";

export async function GET() {
  const { profile } = await getAuthProfile();
  if (!profile) return NextResponse.json({ success: false, user: null }, { status: 401 });
  return NextResponse.json({ success: true, user: profile });
}
