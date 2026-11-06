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
} from "lucide-react";

const PROMOTION_TERMS = ["First Term", "Second Term", "Third Term"] as const;
const PASS_MARK = 50;

export default function StudentPromotionPage() {
  const { students, moveStudentsToClass } = useRealtimeStudents();
  const { classes, classesSource } = useRealtimeClasses();
  const { currentUser } = useRealtimeAuth();

  const [sourceClass, setSourceClass] = useState<string>(classes[0]?.name || "Primary 1");
  const [targetClass, setTargetClass] = useState<string>(classes[1]?.name || "Primary 2");
  const [promotedIds, setPromotedIds] = useState<string[]>([]);
  const [resultNote, setResultNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // The class arms are the school's records now, and they arrive after the page
  // has already painted its first guess. An arm the school does not run cannot
  // be promoted out of or into, so once the school's list is on screen any
  // selection naming an arm that is not on it is replaced by one that is.
  useEffect(() => {
    if (classesSource !== "server") return;
    const names = classes.map((c) => c.name);
    if (names.length === 0) return;
    setSourceClass((current) => (names.includes(current) ? current : names[0]));
    setTargetClass((current) => (names.includes(current) ? current : names[1] ?? names[0]));
  }, [classes, classesSource]);

  // Moving a pupil up a class rewrites the roll, which is an admissions action.
  const canPromote = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  const filtered = useMemo(() => students.filter((s) => s.className === sourceClass), [students, sourceClass]);

  // Promotion is decided from the marks filed on the school's own tables. The
  // roster used to carry one subject's numbers per pupil, so a child who had
  // done well all year could be retained — or, with the buffer empty, shown as
  // scoring 0% and retained for a term nobody had marked yet.
  //
  // The year is the one the school's own record names. Read against the year
  // compiled into the bundle, a school that had moved into its next session in
  // Settings found no filed marks at all and could not promote anybody.
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

  const toggleStudent = (id: string) => {
    setPromotedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllQualified = () => {
    if (!filedLoaded) {
      setResultNote({
        kind: "bad",
        text: `The filed marks for ${sourceClass} have not arrived from the school records yet, so no pupil can be judged. Reload this screen once the sync notice clears.`,
      });
      return;
    }

    const qualifiedIds = filtered
      .filter((s) => {
        const record = averages.get(s.id);
        return record !== undefined && record.avg >= PASS_MARK;
      })
      .map((s) => s.id);

    setPromotedIds(qualifiedIds);
    const unmarked = filtered.length - averages.size;
    setResultNote({
      kind: qualifiedIds.length === 0 ? "bad" : "ok",
      text:
        qualifiedIds.length === 0
          ? `No pupil in ${sourceClass} reaches ${PASS_MARK}% on a filed mark. ${unmarked} of ${filtered.length} have no marks filed at all for ${scope.session}, so nothing can be decided for them.`
          : `${qualifiedIds.length} of ${filtered.length} pupils in ${sourceClass} reach ${PASS_MARK}% on filed marks.${unmarked > 0 ? ` ${unmarked} have no marks filed and are not included.` : ""}`,
    });
  };

  const handlePromote = async () => {
    const moving = filtered
      .filter((s) => promotedIds.includes(s.id))
      .map((s) => ({ ...s, className: targetClass }));
    if (moving.length === 0 || sourceClass === targetClass) return;

    if (!canPromote) {
      setResultNote({ kind: "bad", text: "Only the school office (Super Admin) or an Exam Officer may move a pupil between classes." });
      return;
    }
    if (!isSupabaseConfigured) {
      setResultNote({
        kind: "bad",
        text: "This device is not connected to the school records, so the promotion would only apply to this browser and vanish on reload. Nothing was changed.",
      });
      return;
    }
    if (!window.confirm(`Move ${moving.length} pupil(s) from ${sourceClass} to ${targetClass} on the school records?`)) return;

    setIsWorking(true);
    const saved = await bulkInsertStudentsToSupabase(moving);
    setIsWorking(false);

    if (saved) {
      moveStudentsToClass(moving.map((s) => s.id), targetClass);
      setPromotedIds([]);
      setResultNote({
        kind: "ok",
        text: `${moving.length} pupil${moving.length === 1 ? "" : "s"} moved from ${sourceClass} to ${targetClass} on the school records.`,
      });
    } else {
      setResultNote({
        kind: "bad",
        text: `The school records did not accept the move, so ${sourceClass} is unchanged. Read the sync notice above for the reason.`,
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
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Promotion</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Annual Student Class Promotion Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Advance qualified students with minimum required academic scores to the next academic level for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={selectAllQualified}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              Select All Qualified (≥50%)
            </button>

            <button
              onClick={handlePromote}
              disabled={promotedIds.length === 0 || isWorking || sourceClass === targetClass || !canPromote}
              title={
                !canPromote
                  ? "Only the school office or an Exam Officer may move a pupil between classes"
                  : sourceClass === targetClass
                    ? "Choose a different class to promote into"
                    : undefined
              }
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              {isWorking ? "Saving to the school records…" : `Promote Selected (${promotedIds.length}) Students`}
            </button>
          </div>
        </div>

        {/* Outcome of the last action */}
        {resultNote && (
          <div
            className={`rounded-xl p-4 text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
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

        {/* Transition Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="min-w-0 flex-1">
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
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:block pt-4 text-slate-400">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
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

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span>Promotion Benchmark: </span>
            <strong className="text-slate-800">Minimum 50% Aggregate / Pass Grade</strong>
          </div>
        </div>

        {/* Student Selection Roster */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">No students currently enrolled in {sourceClass}</h3>
            <p className="text-xs text-slate-500">Select another classroom arm or enroll students in the registry.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4 w-12 text-center">Select</th>
                    <th className="py-3 px-4">Admission No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center">Average Score</th>
                    <th className="py-3 px-4 text-center">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => {
                    const isSelected = promotedIds.includes(s.id);
                    const record = averages.get(s.id);

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
                          {record ? `${record.avg}%` : <span title="No mark has been filed for this pupil">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {!record ? (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              No marks filed
                            </span>
                          ) : record.avg >= PASS_MARK ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Qualified on {record.subjects} filed subject{record.subjects === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Below {PASS_MARK}% — office decision
                            </span>
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
