"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeStudents,
  useRealtimeClasses,
  useRealtimeGradingScales,
  calculateGradeForClass,
} from "@/lib/realtime-store";
import {
  TrendingUp,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function StudentPromotionPage() {
  const { students } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const { gradingTiers } = useRealtimeGradingScales();

  const [sourceClass, setSourceClass] = useState<string>(classes[0]?.name || "Primary 1");
  const [targetClass, setTargetClass] = useState<string>(classes[1]?.name || "Primary 2");
  const [promotedIds, setPromotedIds] = useState<string[]>([]);
  const [isPromotedSuccess, setIsPromotedSuccess] = useState(false);

  const filtered = students.filter((s) => s.className === sourceClass);

  const toggleStudent = (id: string) => {
    setPromotedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllQualified = () => {
    const qualifiedIds = filtered
      .filter((s) => {
        const total = s.caScores.test1 + s.caScores.test2 + s.caScores.project + s.caScores.midTerm + s.caScores.exam;
        return total >= 50;
      })
      .map((s) => s.id);
    setPromotedIds(qualifiedIds);
  };

  const handlePromote = () => {
    setIsPromotedSuccess(true);
    setTimeout(() => setIsPromotedSuccess(false), 4000);
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
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
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
              disabled={promotedIds.length === 0}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              Promote Selected ({promotedIds.length}) Students
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {isPromotedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Selected {promotedIds.length} candidate(s) successfully marked for promotion from {sourceClass} to {targetClass}!
          </div>
        )}

        {/* Transition Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase">From Current Class</label>
              <select
                value={sourceClass}
                onChange={(e) => {
                  setSourceClass(e.target.value);
                  setPromotedIds([]);
                }}
                className="mt-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4 text-slate-400">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Promote Into</label>
              <select
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                className="mt-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-blue-700 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                    const total = s.caScores.test1 + s.caScores.test2 + s.caScores.project + s.caScores.midTerm + s.caScores.exam;
                    const isQualified = total >= 50;

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
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{total}%</td>
                        <td className="py-3 px-4 text-center">
                          {isQualified ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Promoted (Qualified)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Promoted on Trial / Retain
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
