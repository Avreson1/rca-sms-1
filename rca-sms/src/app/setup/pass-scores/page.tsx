"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  Target,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
} from "lucide-react";

export default function SetupPassScoresPage() {
  const [passScores, setPassScores] = useState({
    universalPassMark: 45, // 45% (Grade D) Approved Universal Pass Mark
    creditPassMark: 50,    // 50% (Grade C)
    distinctionMark: 70,   // 70% (Grade A)
    minCompulsoryCreditsForPromotion: 5,
    mathEnglishRequired: true,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-[#0000FF] flex items-center gap-1 font-semibold">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Setup</span>
              <span>/</span>
              <span className="text-slate-900 font-extrabold">Pass Scores &amp; Benchmarks</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Minimum Pass Score &amp; Promotion Benchmarks</span>
              <span className="text-xs bg-blue-100 text-[#0000FF] font-black px-2.5 py-0.5 rounded-full border border-blue-300 uppercase">
                45% Pass Mark
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Approved universal pass benchmark is strictly <strong>45% (Grade D)</strong> across all academic levels for {SCHOOL_INFO.name}.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 text-xs font-black bg-[#0000FF] hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <Save className="w-4 h-4 text-cyan-300" />
            {saved ? "Saved Configuration!" : "Save Benchmarks"}
          </button>
        </div>

        {/* Success Alert */}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Promotion thresholds updated successfully!
          </div>
        )}

        {/* Universal Pass Policy Banner */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950 via-[#0a1128] to-blue-950 text-white border border-cyan-400/30 flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded border border-cyan-400/40 uppercase tracking-wider">
                Approved Universal Pass Score
              </span>
              <span className="text-xs text-blue-200 font-semibold">National Educational Baseline</span>
            </div>
            <h2 className="text-xl font-black text-white">Minimum Pass Score: 45% (Grade D)</h2>
            <p className="text-xs text-blue-200/80 max-w-xl">
              Any student score below 45% is designated as Fail (Grade F). Scores from 45% to 49% receive a Pass mark.
            </p>
          </div>
          <div className="bg-blue-900/80 border border-cyan-400/40 px-5 py-3 rounded-2xl text-center hidden sm:block">
            <span className="text-[10px] font-bold text-cyan-300 uppercase block">Pass Grade</span>
            <span className="text-2xl font-black text-white">D (45 - 49%)</span>
          </div>
        </div>

        {/* Configurations Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs max-w-2xl space-y-6">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-extrabold text-sm text-slate-900">Minimum Universal Pass Mark (Grade D)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Approved baseline mark required to avoid failing a subject</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={passScores.universalPassMark}
                  onChange={(e) => setPassScores({ ...passScores, universalPassMark: parseInt(e.target.value, 10) || 45 })}
                  className="w-16 text-center font-black text-sm bg-white border border-blue-400 focus:ring-1 focus:ring-[#0000FF] rounded-xl p-2 text-[#0000FF]"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-extrabold text-sm text-slate-900">Credit Benchmark (Grade C)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Benchmark score required to qualify as a Credit grade</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={passScores.creditPassMark}
                  onChange={(e) => setPassScores({ ...passScores, creditPassMark: parseInt(e.target.value, 10) || 50 })}
                  className="w-16 text-center font-black text-sm bg-white border border-slate-300 rounded-xl p-2 text-cyan-700"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-extrabold text-sm text-slate-900">Distinction Threshold (Grade A)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Benchmark for academic honors, merit awards, and distinctions</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={passScores.distinctionMark}
                  onChange={(e) => setPassScores({ ...passScores, distinctionMark: parseInt(e.target.value, 10) || 70 })}
                  className="w-16 text-center font-black text-sm bg-white border border-slate-300 rounded-xl p-2 text-emerald-700"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-extrabold text-sm text-slate-900">Minimum Credits for Session Promotion</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Number of passed subjects required to advance to next academic session</p>
              </div>
              <input
                type="number"
                value={passScores.minCompulsoryCreditsForPromotion}
                onChange={(e) => setPassScores({ ...passScores, minCompulsoryCreditsForPromotion: parseInt(e.target.value, 10) || 5 })}
                className="w-16 text-center font-black text-sm bg-white border border-slate-300 rounded-xl p-2 text-purple-700"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-extrabold text-sm text-slate-900">Mandatory Mathematics &amp; English Credit</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Require credits in both core subjects for unconditional promotion</p>
              </div>
              <input
                type="checkbox"
                checked={passScores.mathEnglishRequired}
                onChange={(e) => setPassScores({ ...passScores, mathEnglishRequired: e.target.checked })}
                className="w-5 h-5 text-[#0000FF] rounded accent-[#0000FF] cursor-pointer"
              />
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
