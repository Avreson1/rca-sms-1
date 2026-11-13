"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import {
  useRealtimeStudents,
  useRealtimeClasses,
  useRealtimeSubjectScores,
  useRealtimeAuth,
} from "@/lib/realtime-store";
import { bulkInsertStudentsToSupabase } from "@/lib/supabase/db";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  TrendingUp,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Users,
  ArrowRight,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  Info,
} from "lucide-react";
import {
  detectSchoolSection,
  DEFAULT_PROMOTION_SETTINGS,
  type PromotionEvaluationResult,
  type PromotionSettings,
  type SchoolSection,
} from "@/lib/promotion-engine";

const PROMOTION_TERMS = ["First Term", "Second Term", "Third Term"] as const;

export default function StudentPromotionPage() {
  const { students, moveStudentsToClass } = useRealtimeStudents();
  const { classes, classesSource } = useRealtimeClasses();
  const { currentUser } = useRealtimeAuth();

  const [sourceClass, setSourceClass] = useState<string>(classes[0]?.name || "Primary 1");
  const [targetClass, setTargetClass] = useState<string>(classes[1]?.name || "Primary 2");
  const [promotedIds, setPromotedIds] = useState<string[]>([]);
  const [resultNote, setResultNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // Settings & evaluation state
  const [settings, setSettings] = useState<PromotionSettings>(DEFAULT_PROMOTION_SETTINGS);
  const [evaluationMap, setEvaluationMap] = useState<Map<string, PromotionEvaluationResult>>(new Map());
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Auto-align classes once loaded
  useEffect(() => {
    if (classesSource !== "server") return;
    const names = classes.map((c) => c.name);
    if (names.length === 0) return;
    setSourceClass((current) => (names.includes(current) ? current : names[0]));
    setTargetClass((current) => (names.includes(current) ? current : names[1] ?? names[0]));
  }, [classes, classesSource]);

  // Load configured promotion settings
  useEffect(() => {
    fetch("/api/promotion/settings")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setSettings(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const canPromote = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";
  const filtered = useMemo(() => students.filter((s) => s.className === sourceClass), [students, sourceClass]);

  const { config: school } = useSchoolConfig();
  const scope = effectiveScope(school, {
    session: SCHOOL_INFO.currentSession,
    term: SCHOOL_INFO.currentTerm,
  });

  const { subjectScores: filedMarks, filedLoaded } = useRealtimeSubjectScores({
    session: scope.session,
    terms: [...PROMOTION_TERMS],
    className: sourceClass,
  });

  // Section detection for the source class
  const detectedSection: SchoolSection = useMemo(() => {
    const classObj = classes.find((c) => c.name === sourceClass);
    return detectSchoolSection(classObj?.section || sourceClass);
  }, [classes, sourceClass]);

  const isSecondary = detectedSection === "SECONDARY";
  const schoolBrand = isSecondary ? "Royal Crown High School" : "Royal Crown Academy";

  // Calculate traditional averages for fallback
  const averages = useMemo(() => {
    const totalsByStudent = new Map<string, number[]>();
    for (const row of filedMarks) {
      const list = totalsByStudent.get(row.studentId);
      if (list) list.push(row.total);
      else totalsByStudent.set(row.studentId, [row.total]);
    }

    const result = new Map<string, { avg: number; subjects: number }>();
    for (const [studentId, totals] of totalsByStudent) {
      const sum = totals.reduce((acc, value) => acc + value, 0);
      result.set(studentId, { avg: Math.round((sum / totals.length) * 10) / 10, subjects: totals.length });
    }
    return result;
  }, [filedMarks]);

  // Execute Promotion Engine Evaluation (Dry-Run Preview)
  const runEvaluation = async () => {
    if (filtered.length === 0) return;
    setIsEvaluating(true);
    setEvalError(null);
    try {
      const res = await fetch("/api/promotion/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          className: sourceClass,
          session: scope.session,
          studentIds: filtered.map((s) => s.id),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const map = new Map<string, PromotionEvaluationResult>();
        for (const item of data.results) {
          map.set(item.studentId, item);
        }
        setEvaluationMap(map);
        if (data.settings) {
          setSettings(data.settings);
        }
      } else {
        setEvalError(data.error || "Failed to evaluate promotion rules");
      }
    } catch {
      setEvalError("Evaluation service temporarily unreachable");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Automatically trigger evaluation preview when class or filed marks change
  useEffect(() => {
    if (filtered.length > 0) {
      void runEvaluation();
    } else {
      setEvaluationMap(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceClass, scope.session, filedMarks.length]);

  const toggleStudent = (id: string) => {
    setPromotedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllQualified = () => {
    if (!filedLoaded && evaluationMap.size === 0) {
      setResultNote({
        kind: "bad",
        text: `Assessment marks for ${sourceClass} are still loading. Try again once loaded.`,
      });
      return;
    }

    let qualifiedIds: string[] = [];

    // Prioritize Promotion Engine verdicts if available
    if (evaluationMap.size > 0) {
      qualifiedIds = filtered
        .filter((s) => evaluationMap.get(s.id)?.status === "PROMOTED")
        .map((s) => s.id);
    } else {
      const passMark = isSecondary ? settings.secondaryAvgThreshold : settings.primaryAvgThreshold;
      qualifiedIds = filtered
        .filter((s) => {
          const record = averages.get(s.id);
          return record !== undefined && record.avg >= passMark;
        })
        .map((s) => s.id);
    }

    setPromotedIds(qualifiedIds);
    setResultNote({
      kind: qualifiedIds.length === 0 ? "bad" : "ok",
      text:
        qualifiedIds.length === 0
          ? `No student in ${sourceClass} meets all ${detectedSection} promotion criteria.`
          : `${qualifiedIds.length} of ${filtered.length} students in ${sourceClass} meet all criteria for promotion to ${targetClass}.`,
    });
  };

  const handlePromote = async () => {
    const moving = filtered
      .filter((s) => promotedIds.includes(s.id))
      .map((s) => ({ ...s, className: targetClass }));
    if (moving.length === 0 || sourceClass === targetClass) return;

    if (!canPromote) {
      setResultNote({
        kind: "bad",
        text: "Only Super Admin or Exam Officer roles can promote students between classes.",
      });
      return;
    }
    if (!isSupabaseConfigured) {
      setResultNote({
        kind: "bad",
        text: "Database is not connected. Promotion must be saved to the database.",
      });
      return;
    }
    if (!window.confirm(`Advance ${moving.length} student(s) from ${sourceClass} to ${targetClass}?`)) {
      return;
    }

    setIsWorking(true);
    const saved = await bulkInsertStudentsToSupabase(moving);
    setIsWorking(false);

    if (saved) {
      moveStudentsToClass(moving.map((s) => s.id), targetClass);
      setPromotedIds([]);
      setResultNote({
        kind: "ok",
        text: `${moving.length} student${moving.length === 1 ? "" : "s"} successfully promoted from ${sourceClass} to ${targetClass}.`,
      });
      void runEvaluation();
    } else {
      setResultNote({
        kind: "bad",
        text: "The database could not complete the class transition. Check network connectivity.",
      });
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="flex min-h-6 items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Promotion Engine</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Tiered Student Promotion Engine
              </h1>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  isSecondary
                    ? "bg-purple-50 text-purple-800 border-purple-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                {schoolBrand} • {detectedSection} SECTION
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated promotion verification following section-differentiated benchmark standards for {schoolBrand}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={runEvaluation}
              disabled={isEvaluating || filtered.length === 0}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Refresh diagnostic evaluation from database scores"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              {isEvaluating ? "Evaluating..." : "Refresh Dry Run"}
            </button>

            <button
              onClick={selectAllQualified}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              Select All Qualified
            </button>

            <button
              onClick={handlePromote}
              disabled={promotedIds.length === 0 || isWorking || sourceClass === targetClass || !canPromote}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              {isWorking ? "Saving..." : `Promote Selected (${promotedIds.length})`}
            </button>
          </div>
        </div>

        {/* Action result note */}
        {resultNote && (
          <div
            className={`rounded-xl p-4 text-xs font-semibold flex items-start gap-2 ${
              resultNote.kind === "ok"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}
          >
            {resultNote.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <span>{resultNote.text}</span>
          </div>
        )}

        {evalError && (
          <div className="rounded-xl p-4 text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{evalError}</span>
          </div>
        )}

        {/* Transition & Benchmark Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-48">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">From Current Class</label>
                <select
                  value={sourceClass}
                  onChange={(e) => {
                    setSourceClass(e.target.value);
                    setPromotedIds([]);
                  }}
                  className="mt-1 w-full min-w-0 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.section || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden sm:block pt-4 text-slate-400">
                <ArrowRight className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1 sm:w-48">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">Promote Into</label>
                <select
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  className="mt-1 w-full min-w-0 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-blue-700 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Configured Rule Description */}
            <div className="text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-2 max-w-md">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">
                  {isSecondary ? "Royal Crown High School Rule:" : "Royal Crown Academy Rule:"}
                </span>
                <span className="text-slate-600 text-[11px] leading-relaxed">
                  {isSecondary
                    ? `Overall average ≥ ${settings.secondaryAvgThreshold}%, plus Credit level (≥ ${settings.secondaryCreditThreshold}%) in both Mathematics and English Language.`
                    : `Overall average ≥ ${settings.primaryAvgThreshold}%, plus Pass mark (≥ ${settings.primaryPassThreshold}%) in both Mathematics and English Language.`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Student Roster Table with Diagnostic Verdicts */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">No students enrolled in {sourceClass}</h3>
            <p className="text-xs text-slate-500">Select another class or register students into this arm.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-500" />
                <span>
                  {filtered.length} Student{filtered.length === 1 ? "" : "s"} in {sourceClass} — Session: {scope.session}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {promotedIds.length} selected for promotion
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4 w-12 text-center">Select</th>
                    <th className="py-3 px-4">Admission No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center">Average</th>
                    <th className="py-3 px-4 text-center">Maths Status</th>
                    <th className="py-3 px-4 text-center">English Status</th>
                    <th className="py-3 px-4 text-center">Promotion Engine Verdict</th>
                    <th className="py-3 px-4">Diagnostic Reasons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => {
                    const isSelected = promotedIds.includes(s.id);
                    const evalResult = evaluationMap.get(s.id);
                    const record = averages.get(s.id);
                    const avgDisplay = evalResult ? `${evalResult.average}%` : record ? `${record.avg}%` : "—";
                    const isPromoted = evalResult?.status === "PROMOTED";

                    return (
                      <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudent(s.id)}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{s.admissionNo}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{s.fullName}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {avgDisplay}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              evalResult?.mathStatus.includes("Credit") || evalResult?.mathStatus.includes("Pass")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {evalResult?.mathStatus || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              evalResult?.englishStatus.includes("Credit") || evalResult?.englishStatus.includes("Pass")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {evalResult?.englishStatus || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {evalResult ? (
                            <span
                              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full inline-flex items-center gap-1 ${
                                isPromoted
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-amber-100 text-amber-800 border border-amber-300"
                              }`}
                            >
                              {isPromoted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  PROMOTED
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  REPEAT
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Evaluating...</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {evalResult && evalResult.reasons.length > 0 ? (
                            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                              {evalResult.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          ) : isPromoted ? (
                            <span className="text-emerald-700 font-semibold">Meets all requirements</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
