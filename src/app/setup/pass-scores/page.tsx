"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Target,
  ArrowLeft,
  AlertCircle,
  Save,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
} from "lucide-react";

export default function SetupPassScoresPage() {
  const [passScores, setPassScores] = useState({
    universalPassMark: 45,
    creditPassMark: 50,
    distinctionMark: 70,
    minCompulsoryCreditsForPromotion: 5,
    mathEnglishRequired: true,
  });

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
              <span className="text-xs bg-slate-100 text-slate-600 font-black px-2.5 py-0.5 rounded-full border border-slate-200 uppercase">
                Set per tier in Grading Scales
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              The pass mark this portal actually applies to a pupil&apos;s result is the one configured per tier in
              Setup &rarr; Grading Scales. No universal figure is approved or stored on this screen.
            </p>
          </div>

          <button
            type="button"
            disabled
            title="Nothing on this screen is saved to the school database"
            className="px-5 py-2.5 text-xs font-black bg-slate-200 text-slate-500 rounded-xl flex items-center gap-1.5 self-start md:self-auto cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Benchmarks
          </button>
        </div>

        {/* No store hook backs these fields, so a save would claim a change that never lands. */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[11px] text-amber-900 max-w-2xl">
          These benchmarks are not connected to the school database, so editing them changes nothing and saving is
          disabled. Use Setup &rarr; Grading Scales, where the marks the portal computes from are configured per tier.
        </div>

        {/* Universal Pass Policy Banner */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950 via-[#0a1128] to-blue-950 text-white border border-cyan-400/30 flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded border border-cyan-400/40 uppercase tracking-wider">
                Not an approved universal score
              </span>
              <span className="text-xs text-blue-200 font-semibold">Per-tier configuration</span>
            </div>
            <h2 className="text-xl font-black text-white">Pass marks are set per tier, not on this page</h2>
            <p className="text-xs text-blue-200/80 max-w-xl">
              The tier scales in Setup &rarr; Grading Scales decide where a pass begins for each class band. The
              numbers below are this browser&apos;s draft values only and are not used to grade any pupil.
            </p>
          </div>
          <div className="bg-blue-900/80 border border-cyan-400/40 px-5 py-3 rounded-2xl text-center hidden sm:block">
            <span className="text-[10px] font-bold text-cyan-300 uppercase block">Where it is set</span>
            <span className="text-sm font-black text-white leading-snug">Setup<br />Grading Scales</span>
          </div>
        </div>

        {/* Configurations Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs max-w-2xl space-y-6">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-extrabold text-sm text-slate-900">Minimum Universal Pass Mark (Grade D)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Draft value only; the mark a result is judged against comes from Setup &rarr; Grading Scales</p>
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
