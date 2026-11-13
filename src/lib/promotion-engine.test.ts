import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePromotion,
  computeClassPositions,
  formatOrdinalRank,
  detectSchoolSection,
  DEFAULT_PROMOTION_SETTINGS,
} from "./promotion-engine";

describe("Tiered Promotion Condition Engine", () => {
  describe("Primary School Rules (Royal Crown Academy)", () => {
    it("promotes student with average >= 50% and Maths/English >= 40%", () => {
      const scores = [
        { subject: "Mathematics", totalScore: 40 },
        { subject: "English Language", totalScore: 40 },
        { subject: "Basic Science", totalScore: 70 },
      ];
      // Average = (40 + 40 + 70) / 3 = 50.0%
      const result = evaluatePromotion("student-1", "PRIMARY", scores);
      assert.equal(result.eligible, true);
      assert.equal(result.status, "PROMOTED");
      assert.equal(result.average, 50);
      assert.equal(result.reasons.length, 0);
    });

    it("repeats student with 49.9% average (edge case below 50%)", () => {
      const scores = [
        { subject: "General Mathematics", totalScore: 50 },
        { subject: "English Studies", totalScore: 50 },
        { subject: "Social Studies", totalScore: 49.7 },
      ];
      // Average = 49.9%
      const result = evaluatePromotion("student-2", "PRIMARY", scores);
      assert.equal(result.eligible, false);
      assert.equal(result.status, "REPEAT");
      assert.equal(result.average, 49.9);
      assert.ok(result.reasons.some((r) => r.includes("below the Primary threshold")));
    });

    it("repeats student with high average (75%) but failed Maths (39.9%)", () => {
      const scores = [
        { subject: "Mathematics", totalScore: 39.9 },
        { subject: "English Language", totalScore: 90 },
        { subject: "Basic Science", totalScore: 95 },
      ];
      const result = evaluatePromotion("student-3", "PRIMARY", scores);
      assert.equal(result.eligible, false);
      assert.equal(result.status, "REPEAT");
      assert.ok(result.reasons.some((r) => r.includes("Mathematics score")));
    });

    it("repeats student with high average but missing English Language", () => {
      const scores = [
        { subject: "Mathematics", totalScore: 80 },
        { subject: "Basic Science", totalScore: 90 },
      ];
      const result = evaluatePromotion("student-4", "PRIMARY", scores);
      assert.equal(result.eligible, false);
      assert.equal(result.status, "REPEAT");
      assert.ok(result.reasons.some((r) => r.includes("English Language score not found")));
    });
  });

  describe("Secondary School Rules (Royal Crown High School)", () => {
    it("promotes student with average >= 60% and Maths/English at Credit level (>= 50%)", () => {
      const scores = [
        { subject: "General Mathematics", totalScore: 50 },
        { subject: "English Language", totalScore: 50 },
        { subject: "Biology", totalScore: 80 },
      ];
      // Average = (50 + 50 + 80) / 3 = 60.0%
      const result = evaluatePromotion("student-sec-1", "SECONDARY", scores);
      assert.equal(result.eligible, true);
      assert.equal(result.status, "PROMOTED");
      assert.equal(result.average, 60);
      assert.equal(result.reasons.length, 0);
    });

    it("repeats student with 59.9% average (edge case below 60%)", () => {
      const scores = [
        { subject: "Mathematics", totalScore: 60 },
        { subject: "English Language", totalScore: 60 },
        { subject: "Chemistry", totalScore: 59.7 },
      ];
      // Average = 59.9%
      const result = evaluatePromotion("student-sec-2", "SECONDARY", scores);
      assert.equal(result.eligible, false);
      assert.equal(result.status, "REPEAT");
      assert.equal(result.average, 59.9);
      assert.ok(result.reasons.some((r) => r.includes("below the Secondary threshold")));
    });

    it("repeats student with high average (70%) but Pass instead of Credit in Maths (49%)", () => {
      const scores = [
        { subject: "Mathematics", totalScore: 49 },
        { subject: "English Language", totalScore: 80 },
        { subject: "Physics", totalScore: 81 },
      ];
      const result = evaluatePromotion("student-sec-3", "SECONDARY", scores);
      assert.equal(result.eligible, false);
      assert.equal(result.status, "REPEAT");
      assert.ok(result.reasons.some((r) => r.includes("Credit level")));
    });
  });

  describe("Class Position Competition Ranking (1, 2, 2, 4)", () => {
    it("ranks tied scores correctly without skipping properly", () => {
      const candidates = [
        { studentId: "s1", average: 85 },
        { studentId: "s2", average: 85 },
        { studentId: "s3", average: 92 },
        { studentId: "s4", average: 70 },
      ];
      const positions = computeClassPositions(candidates);
      assert.equal(positions.get("s3"), 1); // 92 -> 1st
      assert.equal(positions.get("s1"), 2); // 85 -> 2nd (tied)
      assert.equal(positions.get("s2"), 2); // 85 -> 2nd (tied)
      assert.equal(positions.get("s4"), 4); // 70 -> 4th (skips 3rd)
    });

    it("formats ordinal ranks accurately", () => {
      assert.equal(formatOrdinalRank(1), "1st");
      assert.equal(formatOrdinalRank(2), "2nd");
      assert.equal(formatOrdinalRank(3), "3rd");
      assert.equal(formatOrdinalRank(4), "4th");
      assert.equal(formatOrdinalRank(11), "11th");
      assert.equal(formatOrdinalRank(21), "21st");
      assert.equal(formatOrdinalRank(22), "22nd");
      assert.equal(formatOrdinalRank(23), "23rd");
    });
  });

  describe("Section Detection", () => {
    it("identifies Primary arms", () => {
      assert.equal(detectSchoolSection("Primary 1"), "PRIMARY");
      assert.equal(detectSchoolSection("Basic Primary"), "PRIMARY");
      assert.equal(detectSchoolSection("Nursery 2"), "PRIMARY");
    });

    it("identifies Secondary arms", () => {
      assert.equal(detectSchoolSection("JSS 1A"), "SECONDARY");
      assert.equal(detectSchoolSection("Junior Secondary"), "SECONDARY");
      assert.equal(detectSchoolSection("SSS 3 Science"), "SECONDARY");
      assert.equal(detectSchoolSection("Senior Secondary"), "SECONDARY");
    });
  });
});
