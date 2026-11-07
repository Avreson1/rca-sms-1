"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  ArrowLeft,
  Save,
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
              <Link href="/" className="flex min-h-6 items-center gap-1 font-semibold hover:text-brand-600">
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
            className="px-5 py-2.5 text-xs font-black bg-slate-200 text-slate-500 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start md:self-auto cursor-not-allowed"
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
        <div className="texture-grid-light relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-800 via-brand-950 to-night-900 p-5 text-white shadow-lg sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-accent-400/30 bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-300">
                Not an approved universal score
              </span>
              <span className="text-xs font-semibold text-brand-200">Per-tier configuration</span>
            </div>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-white">Pass marks are set per tier, not on this page</h2>
            <p className="max-w-xl text-xs leading-relaxed text-white/70">
              The tier scales in Setup &rarr; Grading Scales decide where a pass begins for each class band. The
              numbers below are this browser&apos;s draft values only and are not used to grade any pupil.
            </p>
          </div>
          <div className="hidden flex-shrink-0 rounded-xl border border-white/12 bg-white/6 px-5 py-3 text-center sm:block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-white/55">Where it is set</span>
            <span className="font-display text-sm font-extrabold leading-snug text-white">Setup<br />Grading Scales</span>
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
                  className="w-16 text-center font-black text-sm bg-white border border-blue-400 focus:ring-1 focus:ring-brand-600 rounded-xl p-2 text-brand-600"
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
                className="w-5 h-5 text-brand-600 rounded accent-brand-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
