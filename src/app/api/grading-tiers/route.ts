import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { databaseUnavailable, getSupabaseServerClient } from "@/lib/supabase/server";
import type { GradeBracket, TierGradingConfig } from "@/lib/realtime-store";

export const dynamic = "force-dynamic";

// Matches isActionAuthorized("EDIT_SETUP") in src/lib/rbac.ts.
const EDIT_SETUP = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

// The five scales the portal knows how to apply. A row with any other id would
// be written to the table and then never read by the screens that grade a card.
const TIER_KEYS = ["PRE_PLAY_PLAY", "NURSERY", "PRIMARY", "JUNIOR_SECONDARY", "SECONDARY"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks one bracket, returning the problem in words or null when it is sound.
 * A grade letter longer than the column would make the whole save fail with a
 * database message, so it is refused here instead.
 */
function bracketProblem(bracket: unknown): string | null {
  if (!isRecord(bracket)) return "a bracket must be an object";
  const grade = typeof bracket.grade === "string" ? bracket.grade.trim() : "";
  if (!grade || grade.length > 10) return `grade "${grade}" must be 1 to 10 characters`;
  const min = Number(bracket.minScore);
  const max = Number(bracket.maxScore);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return `${grade}: the score range must be numbers`;
  if (min < 0 || max > 100 || min > max) return `${grade}: the range ${min}-${max} is not inside 0-100`;
  return null;
}

/**
 * The bottom of the scale must start at 0 and the top must reach 100, otherwise
 * a mark filed inside the hole has no grade and /api/ca refuses the entry.
 */
function coverageProblem(brackets: GradeBracket[]): string | null {
  const sorted = brackets.slice().sort((a, b) => Number(a.minScore) - Number(b.minScore));
  if (Number(sorted[0].minScore) > 0) return `nothing in the scale covers a score below ${sorted[0].minScore}`;
  const top = sorted[sorted.length - 1];
  if (Number(top.maxScore) < 100) return `nothing in the scale covers a score above ${top.maxScore}`;

  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (Number(current.minScore) <= Number(previous.maxScore)) {
      return `${previous.grade} and ${current.grade} overlap, so a score in between has two grades`;
    }
  }
  return null;
}

/** Every scale the school has on file, in the shape the screens already use. */
export async function GET() {
  const denied = await requireRole([
    "SUPER_ADMIN",
    "EXAM_OFFICER",
    "TEACHER",
    "ACCOUNTANT",
    "STUDENT_PARENT",
    "TESTERS",
  ]);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase.from("grading_tiers").select("id, tier_title, description, applicable_classes, brackets");
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });

  const tiers: Record<string, TierGradingConfig> = {};
  for (const row of (data as unknown as { id: string; tier_title: string; description: string | null; applicable_classes: string[] | null; brackets: GradeBracket[] | null }[]) ?? []) {
    tiers[row.id] = {
      tierKey: row.id as TierGradingConfig["tierKey"],
      tierTitle: row.tier_title,
      applicableClasses: Array.isArray(row.applicable_classes) ? row.applicable_classes : [],
      description: row.description ?? "",
      brackets: Array.isArray(row.brackets) ? row.brackets : [],
    };
  }

  return NextResponse.json({ success: true, data: tiers });
}

/**
 * Saves the grading scales.
 *
 * Editing a bracket used to land in this browser's localStorage only, so the
 * school's own scale silently reverted to the seeded one on the next reload —
 * and the marks filed in between had been graded against a scale that no longer
 * existed on the screen.
 */
export async function PUT(request: Request) {
  const denied = await requireRole(EDIT_SETUP);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body) || !isRecord(body.tiers)) {
    return NextResponse.json({ success: false, error: "Send the scales as { tiers: { PRIMARY: {…} } }." }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(body.tiers)) {
    if (!(TIER_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json({ success: false, error: `There is no scale called ${key} in this portal.` }, { status: 400 });
    }
    if (!isRecord(value)) {
      return NextResponse.json({ success: false, error: `${key}: the scale must be an object.` }, { status: 400 });
    }
    if (!Array.isArray(value.brackets) || value.brackets.length === 0) {
      return NextResponse.json({ success: false, error: `${key}: a scale with no brackets cannot grade anything.` }, { status: 400 });
    }

    for (const bracket of value.brackets) {
      const problem = bracketProblem(bracket);
      if (problem) return NextResponse.json({ success: false, error: `${key}: ${problem}.` }, { status: 400 });
    }

    const brackets = value.brackets as GradeBracket[];
    const coverage = coverageProblem(brackets);
    if (coverage) return NextResponse.json({ success: false, error: `${key}: ${coverage}.` }, { status: 400 });

    const applicableClasses = Array.isArray(value.applicableClasses)
      ? value.applicableClasses.filter((arm): arm is string => typeof arm === "string").map((arm) => arm.trim()).filter(Boolean)
      : [];

    rows.push({
      id: key,
      tier_title: typeof value.tierTitle === "string" && value.tierTitle.trim() ? value.tierTitle.trim().slice(0, 255) : key,
      description: typeof value.description === "string" ? value.description.slice(0, 4000) : null,
      applicable_classes: applicableClasses,
      brackets: brackets,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "There was no scale in the request to save." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { error } = await supabase.from("grading_tiers").upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });

  return NextResponse.json({ success: true, data: { saved: rows.length } });
}
