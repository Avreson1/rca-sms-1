import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const READ_SECTIONS = [
  "SUPER_ADMIN",
  "EXAM_OFFICER",
  "TEACHER",
  "ACCOUNTANT",
  "STUDENT_PARENT",
  "TESTERS",
] as const;

export interface SectionMetadata {
  id: string;
  name: string;
  sectionKey: "Creche & Playgroup" | "Nursery School" | "Basic Primary" | "Junior Secondary" | "Senior Secondary";
  code: string;
  level: "PRIMARY" | "SECONDARY";
  gradingModelName: string;
  description: string;
}

export const CANONICAL_SECTIONS: SectionMetadata[] = [
  {
    id: "sec-creche-play",
    name: "Creche & Playgroup (Pre-Play & Play)",
    sectionKey: "Creche & Playgroup",
    code: "EY-PLAY",
    level: "PRIMARY",
    gradingModelName: "Sensory & Developmental (EE, ME, AE, EM)",
    description: "Pre-Play Class and Play Class providing early cognitive, sensory, social habits, and motor skill foundation.",
  },
  {
    id: "sec-nursery",
    name: "Nursery School (Nursery 1 & 2)",
    sectionKey: "Nursery School",
    code: "EY-NUR",
    level: "PRIMARY",
    gradingModelName: "Early Literacy & Numeracy (A+, A, B, C, D)",
    description: "Nursery 1 and Nursery 2 building foundational phonics, quantitative skills, writing, and school readiness.",
  },
  {
    id: "sec-primary",
    name: "Basic Primary Education (Primary 1 - 5)",
    sectionKey: "Basic Primary",
    code: "PRI",
    level: "PRIMARY",
    gradingModelName: "Primary Numeric Descriptive (A to F 6-Point Scale)",
    description: "Primary 1 to Primary 5 imparting rigorous literacy, mathematics, basic science, and civic education.",
  },
  {
    id: "sec-jss",
    name: "Junior Secondary School (JSS 1 - 3)",
    sectionKey: "Junior Secondary",
    code: "JSS",
    level: "SECONDARY",
    gradingModelName: "BECE National Standard (A, B, C, P, F)",
    description: "JSS 1 to JSS 3 single stream preparing students for Basic Education Certificate Examination (BECE).",
  },
  {
    id: "sec-sss",
    name: "Senior Secondary School (SS 1 - 3)",
    sectionKey: "Senior Secondary",
    code: "SSS",
    level: "SECONDARY",
    gradingModelName: "WAEC / NECO 9-Point Scale (A1 to F9)",
    description: "SS 1 to SS 3 single stream offering specialized Science, Arts, and Commercial tracks for WAEC/NECO.",
  },
];

export async function GET() {
  const denied = await requireRole(READ_SECTIONS);
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    data: CANONICAL_SECTIONS,
  });
}
