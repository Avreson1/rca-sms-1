/**
 * Tiered Promotion Condition Engine for Royal Crown Academy & Royal Crown High School
 * Pure evaluation functions — zero side effects, fully testable, Expand-and-Contract safe.
 */

export type SchoolSection = "PRIMARY" | "SECONDARY";
export type PromotionStatus = "PROMOTED" | "REPEAT";

export interface PromotionSettings {
  primaryAvgThreshold: number;      // Default: 50.0%
  primaryPassThreshold: number;     // Default: 40.0% (Pass in Maths & English)
  secondaryAvgThreshold: number;    // Default: 60.0%
  secondaryCreditThreshold: number; // Default: 50.0% (Credit in Maths & English)
  showClassPosition: boolean;       // Global scorecard toggle
}

export const DEFAULT_PROMOTION_SETTINGS: PromotionSettings = {
  primaryAvgThreshold: 50.0,
  primaryPassThreshold: 40.0,
  secondaryAvgThreshold: 60.0,
  secondaryCreditThreshold: 50.0,
  showClassPosition: true,
};

export interface SubjectScore {
  subject: string;
  totalScore: number; // 0 to 100 scale
}

export interface PromotionEvaluationResult {
  studentId: string;
  eligible: boolean;
  status: PromotionStatus;
  average: number;
  mathStatus: string;
  englishStatus: string;
  mathScore: number | null;
  englishScore: number | null;
  reasons: string[];
}

/**
 * Matches common variations of Mathematics subject names.
 * Matches: "Mathematics", "General Mathematics", "Maths", "Numeracy & Counting", "Basic Mathematics"
 */
export function isMathSubject(name: string): boolean {
  return /(^|\b)(math|mathematics|maths|numeracy)($|\b)/i.test(name.trim());
}

/**
 * Matches common variations of English subject names.
 * Matches: "English Language", "English Studies", "English", "Literacy & Phonics", "Diction & Phonics"
 */
export function isEnglishSubject(name: string): boolean {
  return /(^|\b)(english|english language|english studies|literacy)($|\b)/i.test(name.trim());
}

/**
 * Detects school section from class arm name or registered section string.
 * Primary: Creche, Nursery, Primary 1-5, Basic 1-6
 * Secondary: JSS 1-3, SSS 1-3, Grade 7-12
 */
export function detectSchoolSection(sectionOrClassName: string): SchoolSection {
  const normalized = (sectionOrClassName || "").toLowerCase();
  if (
    normalized.includes("secondary") ||
    normalized.includes("jss") ||
    normalized.includes("sss") ||
    normalized.includes("high school") ||
    normalized.includes("junior") ||
    normalized.includes("senior")
  ) {
    return "SECONDARY";
  }
  return "PRIMARY";
}

/**
 * Pure evaluation function for student promotion.
 * - Primary: Average >= 50% AND Maths >= 40% (Pass) AND English >= 40% (Pass)
 * - Secondary: Average >= 60% AND Maths >= 50% (Credit) AND English >= 50% (Credit)
 */
export function evaluatePromotion(
  studentId: string,
  section: SchoolSection,
  scores: SubjectScore[],
  userSettings?: Partial<PromotionSettings>
): PromotionEvaluationResult {
  const settings: PromotionSettings = {
    ...DEFAULT_PROMOTION_SETTINGS,
    ...userSettings,
  };

  if (!scores || scores.length === 0) {
    return {
      studentId,
      eligible: false,
      status: "REPEAT",
      average: 0,
      mathStatus: "Not Entered",
      englishStatus: "Not Entered",
      mathScore: null,
      englishScore: null,
      reasons: ["No assessment scores recorded for this session"],
    };
  }

  // Calculate overall arithmetic average
  const totalSum = scores.reduce((acc, curr) => acc + curr.totalScore, 0);
  const rawAverage = totalSum / scores.length;
  const average = Math.round(rawAverage * 10) / 10;

  // Locate Mathematics and English Language records
  const mathRecord = scores.find((s) => isMathSubject(s.subject));
  const englishRecord = scores.find((s) => isEnglishSubject(s.subject));

  const mathScore = mathRecord !== undefined ? mathRecord.totalScore : null;
  const englishScore = englishRecord !== undefined ? englishRecord.totalScore : null;

  const reasons: string[] = [];

  let mathStatus = "Not Entered";
  let englishStatus = "Not Entered";

  if (section === "PRIMARY") {
    // 1. Primary School Rules: Royal Crown Academy
    // Rule A: Overall average >= 50%
    if (average < settings.primaryAvgThreshold) {
      reasons.push(
        `Overall average ${average}% is below the Primary threshold (${settings.primaryAvgThreshold}%)`
      );
    }

    // Rule B: Pass in Mathematics (>= 40%)
    if (mathScore === null) {
      mathStatus = "Missing";
      reasons.push("Mathematics score not found on record");
    } else if (mathScore < settings.primaryPassThreshold) {
      mathStatus = `Fail (${mathScore}%)`;
      reasons.push(
        `Mathematics score ${mathScore}% is below the minimum Pass mark (${settings.primaryPassThreshold}%)`
      );
    } else {
      mathStatus = `Pass (${mathScore}%)`;
    }

    // Rule C: Pass in English Language (>= 40%)
    if (englishScore === null) {
      englishStatus = "Missing";
      reasons.push("English Language score not found on record");
    } else if (englishScore < settings.primaryPassThreshold) {
      englishStatus = `Fail (${englishScore}%)`;
      reasons.push(
        `English Language score ${englishScore}% is below the minimum Pass mark (${settings.primaryPassThreshold}%)`
      );
    } else {
      englishStatus = `Pass (${englishScore}%)`;
    }
  } else {
    // 2. Secondary School Rules: Royal Crown High School
    // Rule A: Overall average >= 60%
    if (average < settings.secondaryAvgThreshold) {
      reasons.push(
        `Overall average ${average}% is below the Secondary threshold (${settings.secondaryAvgThreshold}%)`
      );
    }

    // Rule B: Credit in Mathematics (>= 50%)
    if (mathScore === null) {
      mathStatus = "Missing";
      reasons.push("Mathematics score not found on record");
    } else if (mathScore < settings.secondaryCreditThreshold) {
      mathStatus = `Below Credit (${mathScore}%)`;
      reasons.push(
        `Mathematics score ${mathScore}% is below Credit level (${settings.secondaryCreditThreshold}%)`
      );
    } else {
      mathStatus = `Credit (${mathScore}%)`;
    }

    // Rule C: Credit in English Language (>= 50%)
    if (englishScore === null) {
      englishStatus = "Missing";
      reasons.push("English Language score not found on record");
    } else if (englishScore < settings.secondaryCreditThreshold) {
      englishStatus = `Below Credit (${englishScore}%)`;
      reasons.push(
        `English Language score ${englishScore}% is below Credit level (${settings.secondaryCreditThreshold}%)`
      );
    } else {
      englishStatus = `Credit (${englishScore}%)`;
    }
  }

  const eligible = reasons.length === 0;
  const status: PromotionStatus = eligible ? "PROMOTED" : "REPEAT";

  return {
    studentId,
    eligible,
    status,
    average,
    mathStatus,
    englishStatus,
    mathScore,
    englishScore,
    reasons,
  };
}

/**
 * Standard Competition Ranking (1, 2, 2, 4) for class positions.
 * Handles tied averages strictly without skipping ranks improperly.
 */
export function computeClassPositions(
  candidates: Array<{ studentId: string; average: number }>
): Map<string, number> {
  const sorted = [...candidates].sort((a, b) => b.average - a.average);
  const positionMap = new Map<string, number>();

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].average < sorted[i - 1].average) {
      currentRank = i + 1;
    }
    positionMap.set(sorted[i].studentId, currentRank);
  }

  return positionMap;
}

/**
 * Formats numeric integer rank to standard ordinal string ('1st', '2nd', '3rd', '4th', etc.)
 */
export function formatOrdinalRank(rank: number): string {
  if (rank <= 0) return "—";
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}
