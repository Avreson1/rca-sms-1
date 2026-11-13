import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { DEFAULT_PROMOTION_SETTINGS, type PromotionSettings } from "@/lib/promotion-engine";

export const dynamic = "force-dynamic";

const EDIT_ROLES = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;
const READ_ROLES = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;

export async function GET() {
  const denied = await requireRole(READ_ROLES);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ success: true, data: DEFAULT_PROMOTION_SETTINGS });
  }

  const { data, error } = await supabase
    .from("promotion_settings")
    .select("primary_avg_threshold, primary_pass_threshold, secondary_avg_threshold, secondary_credit_threshold, show_class_position")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/promotion_engine.sql");
    if (setup) {
      // Graceful degradation: return defaults when migration is not yet run
      return NextResponse.json({ success: true, data: DEFAULT_PROMOTION_SETTINGS });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  if (!data) {
    return NextResponse.json({ success: true, data: DEFAULT_PROMOTION_SETTINGS });
  }

  const settings: PromotionSettings = {
    primaryAvgThreshold: Number(data.primary_avg_threshold) || DEFAULT_PROMOTION_SETTINGS.primaryAvgThreshold,
    primaryPassThreshold: Number(data.primary_pass_threshold) || DEFAULT_PROMOTION_SETTINGS.primaryPassThreshold,
    secondaryAvgThreshold: Number(data.secondary_avg_threshold) || DEFAULT_PROMOTION_SETTINGS.secondaryAvgThreshold,
    secondaryCreditThreshold: Number(data.secondary_credit_threshold) || DEFAULT_PROMOTION_SETTINGS.secondaryCreditThreshold,
    showClassPosition: data.show_class_position !== false,
  };

  return NextResponse.json({ success: true, data: settings });
}

export async function PATCH(request: Request) {
  const access = await requireRoleSession(EDIT_ROLES);
  if (access.denied) return access.denied;

  let body: Partial<PromotionSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const updates: Record<string, unknown> = {
    id: 1,
    updated_at: new Date().toISOString(),
    updated_by: access.session.username,
  };

  if (typeof body.primaryAvgThreshold === "number") {
    updates.primary_avg_threshold = body.primaryAvgThreshold;
  }
  if (typeof body.primaryPassThreshold === "number") {
    updates.primary_pass_threshold = body.primaryPassThreshold;
  }
  if (typeof body.secondaryAvgThreshold === "number") {
    updates.secondary_avg_threshold = body.secondaryAvgThreshold;
  }
  if (typeof body.secondaryCreditThreshold === "number") {
    updates.secondary_credit_threshold = body.secondaryCreditThreshold;
  }
  if (typeof body.showClassPosition === "boolean") {
    updates.show_class_position = body.showClassPosition;
  }

  const { error } = await supabase
    .from("promotion_settings")
    .upsert(updates, { onConflict: "id" });

  if (error) {
    const setup = databaseSetupRequired(error, "supabase/promotion_engine.sql");
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: updates });
}
