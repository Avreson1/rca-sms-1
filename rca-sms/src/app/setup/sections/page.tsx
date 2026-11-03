"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO, ALL_SCHOOL_SECTIONS } from "@/lib/constants";
import { useRealtimeStudents, useRealtimeClasses, useRealtimeStaff } from "@/lib/realtime-store";
import {
  GraduationCap,
  Plus,
  ArrowLeft,
  Users,
  Layers,
  CheckCircle2,
  Sliders,
  UserCheck,
  Building2,
} from "lucide-react";

interface SectionConfig {
  id: string;
  name: string;
  sectionKey: "Creche & Playgroup" | "Nursery School" | "Basic Primary" | "Junior Secondary" | "Senior Secondary";
  code: string;
  gradingModelName: string;
  description: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    id: "sec-creche-play",
    name: "Creche & Playgroup (Pre-Play & Play)",
    sectionKey: "Creche & Playgroup",
    code: "EY-PLAY",
    gradingModelName: "Sensory & Developmental (EE, ME, AE, EM)",
    description: "Pre-Play Class and Play Class providing early cognitive, sensory, social habits, and motor skill foundation.",
  },
  {
    id: "sec-nursery",
    name: "Nursery School (Nursery 1 & 2)",
    sectionKey: "Nursery School",
    code: "EY-NUR",
    gradingModelName: "Early Literacy & Numeracy (A+, A, B, C, D)",
    description: "Nursery 1 and Nursery 2 building foundational phonics, quantitative skills, writing, and school readiness.",
  },
  {
    id: "sec-primary",
    name: "Basic Primary Education (Primary 1 - 5)",
    sectionKey: "Basic Primary",
    code: "PRI",
    gradingModelName: "Primary Numeric Descriptive (A to F 6-Point Scale)",
    description: "Primary 1 to Primary 5 imparting rigorous literacy, mathematics, basic science, and civic education.",
  },
  {
    id: "sec-jss",
    name: "Junior Secondary School (JSS 1 - 3)",
    sectionKey: "Junior Secondary",
    code: "JSS",
    gradingModelName: "BECE National Standard (A, B, C, P, F)",
    description: "JSS 1 to JSS 3 single stream preparing students for Basic Education Certificate Examination (BECE).",
  },
  {
    id: "sec-sss",
    name: "Senior Secondary School (SS 1 - 3)",
    sectionKey: "Senior Secondary",
    code: "SSS",
    gradingModelName: "WAEC / NECO 9-Point Scale (A1 to F9)",
    description: "SS 1 to SS 3 single stream offering specialized Science, Arts, and Commercial tracks for WAEC/NECO.",
  },
];

export default function SetupSectionsPage() {
  const { students } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const { staff } = useRealtimeStaff();

  // Local storage or state for section heads
  const [sectionHeads, setSectionHeads] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rca_section_heads_v6");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return {
      "sec-creche-play": "Unassigned",
      "sec-nursery": "Unassigned",
      "sec-primary": "Unassigned",
      "sec-jss": "Unassigned",
      "sec-sss": "Dominic Mark",
    };
  });

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const handleUpdateSectionHead = (secId: string, headName: string) => {
    const updated = { ...sectionHeads, [secId]: headName };
    setSectionHeads(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("rca_section_heads_v6", JSON.stringify(updated));
    }
    setEditingSectionId(null);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Setup</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">School Sections</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              School Sections & Educational Divisions
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live configuration for {SCHOOL_INFO.name} • Total Active Students:{" "}
              <strong className="text-blue-700 font-bold">{students.length}</strong> • Total Classes:{" "}
              <strong className="text-slate-800 font-bold">{classes.length}</strong>
            </p>
          </div>

          <Link
            href="/setup/grading"
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto"
          >
            <Sliders className="w-4 h-4" />
            Adjust Section Grading Scales
          </Link>
        </div>

        {/* Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SECTION_CONFIGS.map((sec) => {
            const sectionClasses = classes.filter((c) => c.section === sec.sectionKey);
            const classNames = sectionClasses.map((c) => c.name);
            const studentCount = students.filter((s) => classNames.includes(s.className)).length;
            const currentHead = sectionHeads[sec.id] || "Unassigned";

            return (
              <div
                key={sec.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
                      {sec.code}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-semibold">{sectionClasses.length} Classes</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-blue-700 font-bold">{studentCount} Enrolled</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{sec.name}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{sec.description}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Active Class Arms:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sectionClasses.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No classes configured</span>
                      ) : (
                        sectionClasses.map((cls) => {
                          const clsStudentCount = students.filter((s) => s.className === cls.name).length;
                          return (
                            <span
                              key={cls.id}
                              className="text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
                            >
                              <span>{cls.name}</span>
                              <span className="text-[9px] bg-slate-200 text-slate-800 px-1 rounded font-bold">
                                {clsStudentCount}
                              </span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Head of Section</span>
                      {editingSectionId === sec.id ? (
                        <div className="flex items-center gap-1 mt-1">
                          <select
                            defaultValue={currentHead}
                            onChange={(e) => handleUpdateSectionHead(sec.id, e.target.value)}
                            className="text-xs p-1 bg-white border border-blue-400 rounded font-bold text-slate-800"
                          >
                            <option value="Unassigned">Unassigned</option>
                            <option value="Dominic Mark">Dominic Mark (Super Admin)</option>
                            {staff.map((st) => (
                              <option key={st.id} value={st.fullName}>
                                {st.fullName} ({st.role})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingSectionId(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <strong className={currentHead === "Unassigned" ? "text-slate-400 italic" : "text-slate-800"}>
                            {currentHead}
                          </strong>
                          <button
                            onClick={() => setEditingSectionId(sec.id)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Grading Standard</span>
                      <strong className="text-blue-700 font-bold text-[11px]">{sec.gradingModelName}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <Link href="/setup/classes" className="font-bold text-blue-600 hover:text-blue-700">
                      Manage Classes →
                    </Link>
                    <Link href="/operations/update-ca" className="text-slate-500 hover:text-slate-800 font-medium">
                      Open Gradebook
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
