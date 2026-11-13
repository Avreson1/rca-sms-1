import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import {
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  DEFAULT_PROMOTION_SETTINGS,
  detectSchoolSection,
  evaluatePromotion,
  computeClassPositions,
  type PromotionEvaluationResult,
  type PromotionSettings,
  type SchoolSection,
  type SubjectScore,
} from "@/lib/promotion-engine";

export const dynamic = "force-dynamic";

const AUTHORIZED_ROLES = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "TESTERS"] as const;

export async function POST(request: Request) {
  const denied = await requireRole(AUTHORIZED_ROLES);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { className, session, studentIds } = (body || {}) as {
    className?: string;
    session?: string;
    studentIds?: string[];
  };

  if (!className || typeof className !== "string") {
    return NextResponse.json({ success: false, error: "className is required" }, { status: 400 });
  }

  const targetSession = session && typeof session === "string" ? session.trim() : "2025/2026";

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  // 1. Fetch class details to detect section (Primary vs Secondary)
  let section: SchoolSection = detectSchoolSection(className);
  const { data: classRow } = await supabase
    .from("class_arms")
    .select("section, section_override")
    .eq("name", className.trim())
    .maybeSingle();

  if (classRow) {
    if (classRow.section_override) {
      section = detectSchoolSection(classRow.section_override);
    } else if (classRow.section) {
      section = detectSchoolSection(classRow.section);
    }
  }

  // 2. Fetch promotion settings
  let settings: PromotionSettings = DEFAULT_PROMOTION_SETTINGS;
  const { data: settingsRow } = await supabase
    .from("promotion_settings")
    .select("primary_avg_threshold, primary_pass_threshold, secondary_avg_threshold, secondary_credit_threshold, show_class_position")
    .eq("id", 1)
    .maybeSingle();

  if (settingsRow) {
    settings = {
      primaryAvgThreshold: Number(settingsRow.primary_avg_threshold) || 50,
      primaryPassThreshold: Number(settingsRow.primary_pass_threshold) || 40,
      secondaryAvgThreshold: Number(settingsRow.secondary_avg_threshold) || 60,
      secondaryCreditThreshold: Number(settingsRow.secondary_credit_threshold) || 50,
      showClassPosition: settingsRow.show_class_position !== false,
    };
  }

  // 3. Fetch students belonging to this class
  let studentsQuery = supabase
    .from("students")
    .select("id, full_name, admission_no, class_name")
    .eq("class_name", className.trim());

  if (Array.isArray(studentIds) && studentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", studentIds);
  }

  const { data: students, error: studentsError } = await studentsQuery.order("full_name");
  if (studentsError) {
    return NextResponse.json({ success: false, error: studentsError.message }, { status: 502 });
  }

  const studentList = students ?? [];
  const targetIds = studentList.map((s) => s.id);

  if (targetIds.length === 0) {
    return NextResponse.json({
      success: true,
      section,
      settings,
      results: [],
      positions: {},
    });
  }

  // 4. Fetch all assessment scores for target students in this session
  const { data: scoresData, error: scoresError } = await supabase
    .from("ca_scores")
    .select("student_id, subject, total_score, term")
    .in("student_id", targetIds)
    .eq("session", targetSession);

  if (scoresError) {
    return NextResponse.json({ success: false, error: scoresError.message }, { status: 502 });
  }

  // Group scores per student, per subject, averaging term scores
  const studentScoresMap = new Map<string, Map<string, number[]>>();
  for (const row of scoresData ?? []) {
    let subjectMap = studentScoresMap.get(row.student_id);
    if (!subjectMap) {
      subjectMap = new Map<string, number[]>();
      studentScoresMap.set(row.student_id, subjectMap);
    }
    const list = subjectMap.get(row.subject) || [];
    list.push(Number(row.total_score) || 0);
    subjectMap.set(row.subject, list);
  }

  const results: PromotionEvaluationResult[] = [];
  const rankCandidates: Array<{ studentId: string; average: number }> = [];

  for (const student of studentList) {
    const subjectMap = studentScoresMap.get(student.id);
    const subjectScores: SubjectScore[] = [];

    if (subjectMap) {
      for (const [subjectName, totals] of subjectMap.entries()) {
        const sum = totals.reduce((a, b) => a + b, 0);
        const avg = Math.round((sum / totals.length) * 10) / 10;
        subjectScores.push({ subject: subjectName, totalScore: avg });
      }
    }

    const evalResult = evaluatePromotion(student.id, section, subjectScores, settings);
    results.push(evalResult);
    rankCandidates.push({ studentId: student.id, average: evalResult.average });
  }

  // 5. Compute standard competition rankings
  const positionMap = computeClassPositions(rankCandidates);
  const positionsObj: Record<string, number> = {};
  for (const [id, rank] of positionMap.entries()) {
    positionsObj[id] = rank;
  }

  return NextResponse.json({
    success: true,
    section,
    settings,
    results,
    positions: positionsObj,
  });
}
