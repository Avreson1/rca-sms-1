"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  useRealtimeGradingScales,
  GradeBracket,
  DEFAULT_GRADING_TIERS,
  UNIVERSAL_GRADING_BRACKETS,
} from "@/lib/realtime-store";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  TriangleAlert,
  RotateCcw,
  Plus,
  Trash2,
  Info,
} from "lucide-react";

export default function SetupGradingPage() {
  const { gradingTiers, updateGradingTierBrackets } = useRealtimeGradingScales();
  const [activeTierKey, setActiveTierKey] = useState<string>("PRIMARY");
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const activeTier =
    gradingTiers[activeTierKey] || DEFAULT_GRADING_TIERS[activeTierKey] || DEFAULT_GRADING_TIERS.PRIMARY;
  const [brackets, setBrackets] = useState<GradeBracket[]>(activeTier.brackets || UNIVERSAL_GRADING_BRACKETS);

  // Sync brackets whenever active tier tab changes
  const handleTabChange = (key: string) => {
    setActiveTierKey(key);
    const tier = gradingTiers[key] || DEFAULT_GRADING_TIERS[key];
    if (tier) {
      setBrackets(tier.brackets);
    }
  };

  const handleBracketChange = (index: number, field: keyof GradeBracket, value: any) => {
    const updated = [...brackets];
    updated[index] = {
      ...updated[index],
      [field]: field === "minScore" || field === "maxScore" || field === "gradePoint" ? Number(value) : value,
    };
    setBrackets(updated);
  };

  const handleAddBracket = () => {
    const newBracket: GradeBracket = {
      grade: "E",
      minScore: 40,
      maxScore: 44,
      gradePoint: 0.5,
      remark: "Marginal Pass",
      classification: "Pass",
      colorBadge: "bg-amber-50 text-amber-900 border-amber-200",
    };
    setBrackets([...brackets, newBracket]);
  };

  const handleDeleteBracket = (index: number) => {
    if (brackets.length <= 1) {
      alert("At least one grade level must remain.");
      return;
    }
    setBrackets(brackets.filter((_, i) => i !== index));
  };

  const fileScale = async (rows: GradeBracket[], label: string) => {
    setBusy(true);
    const reason = await updateGradingTierBrackets(activeTierKey, rows);
    setBusy(false);
    if (reason) {
      setNotice({
        tone: "warn",
        text: `The ${label} scale was NOT filed on the school's records: ${reason}. This browser shows the change; the next machine will still read the old scale.`,
      });
      return;
    }
    setNotice({
      tone: "ok",
      text: `The ${label} scale is filed on the school's records. Score cards built from now on grade with it; cards already printed keep the grades they went out with.`,
    });
  };

  const handleSavePolicy = () => {
    void fileScale(brackets, activeTier.tierTitle ?? activeTierKey);
  };

  const handleResetUniversal = () => {
    if (
      confirm(
        "Replace the brackets on screen with the standard scale (A: 70-100, B: 60-69, C: 50-59, D: 45-49 Pass, F: 0-44) and file it as the school's scale?"
      )
    ) {
      setBrackets(UNIVERSAL_GRADING_BRACKETS);
      void fileScale(UNIVERSAL_GRADING_BRACKETS, "standard");
    }
  };

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
              <span className="text-slate-900 font-extrabold">Universal Grading System</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Approved Universal Grading Criteria
              </h1>
              <span className="bg-blue-100 text-brand-600 border border-blue-300 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Universal Standards
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              The bands that turn a mark into a letter on every score card. You are editing the{" "}
              <strong>{activeTier.tierTitle ?? activeTierKey}</strong> scale; the school&apos;s filed copy is what other
              machines read.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetUniversal}
              className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Universal Scale
            </button>
            <button
              onClick={handleSavePolicy}
              disabled={busy}
              className="px-4 py-2 text-xs font-black bg-brand-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-cyan-300" />
              {busy ? "Filing…" : "File Scale On The School's Records"}
            </button>
          </div>
        </div>

        {/* What the last filing actually did */}
        {notice && (
          <div
            className={`${
              notice.tone === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-300 text-amber-950"
            } rounded-2xl p-4 text-xs font-bold flex items-start gap-2`}
            role="status"
          >
            {notice.tone === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            )}
            <p className="whitespace-pre-line">{notice.text}</p>
          </div>
        )}

        {/* Universal Standard Info Banner */}
        <div className="texture-grid-light relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-800 via-brand-950 to-night-900 p-5 text-white shadow-lg md:flex-row md:items-center">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-200">
                The Scale The Portal Starts From
              </span>
              <span className="text-xs font-bold text-white/70">One band per school section, edited below</span>
            </div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-white tabular-nums">
              A (70-100) • B (60-69) • C (50-59) • D (45-49 Pass Mark) • F (0-44 Fail)
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-white/70">
              The usual West African banding, offered as the starting point for Creche through SS 3. What the school
              actually grades with is the scale filed on its records, shown in the tabs below — if they differ, the
              filed scale is the one on the score cards.
            </p>
          </div>

          <div className="min-w-[150px] flex-shrink-0 rounded-xl border border-accent-400/25 bg-accent-500/12 p-3.5 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-accent-300">Usual Pass Mark</span>
            <strong className="font-display text-2xl font-extrabold tabular-nums text-white">45% (D)</strong>
          </div>
        </div>

        {/* Tier Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          {[
            { key: "PRE_PLAY_PLAY", label: "👶 Creche & Playgroup" },
            { key: "NURSERY", label: "🍼 Nursery School (Nursery 1 & 2)" },
            { key: "PRIMARY", label: "🎒 Basic Primary (Primary 1 – 5)" },
            { key: "JUNIOR_SECONDARY", label: "📘 Junior Secondary (JSS 1 – 3)" },
            { key: "SECONDARY", label: "🎓 Senior Secondary (SS 1 – 3)" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTierKey === tab.key
                  ? "bg-brand-600 text-white shadow-sm border border-brand-700"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Adjustable Brackets Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-black text-sm text-slate-900">Universal Grade Matrix ({activeTier.tierTitle})</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect and configure grade boundaries, point weights, and official remarks.
              </p>
            </div>
            <button
              onClick={handleAddBracket}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-brand-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Grade Bracket</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3.5 px-4 w-28">Grade Letter</th>
                  <th className="py-3.5 px-3 w-28">Min Score (%)</th>
                  <th className="py-3.5 px-3 w-28">Max Score (%)</th>
                  <th className="py-3.5 px-3 w-24 text-center">Grade Point</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Official Terminal Remark</th>
                  <th className="py-3.5 px-3 w-36">Classification</th>
                  <th className="py-3.5 px-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brackets.map((b, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    {/* Grade Symbol */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={b.grade}
                        onChange={(e) => handleBracketChange(idx, "grade", e.target.value)}
                        className="w-16 text-center font-black text-sm py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-300 text-brand-600 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                      />
                    </td>

                    {/* Min Score */}
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={b.minScore}
                        onChange={(e) => handleBracketChange(idx, "minScore", e.target.value)}
                        className="w-16 text-center font-mono font-bold text-xs py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800"
                      />
                    </td>

                    {/* Max Score */}
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={b.maxScore}
                        onChange={(e) => handleBracketChange(idx, "maxScore", e.target.value)}
                        className="w-16 text-center font-mono font-bold text-xs py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800"
                      />
                    </td>

                    {/* Grade Point / GPA */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5.0"
                        value={b.gradePoint}
                        onChange={(e) => handleBracketChange(idx, "gradePoint", e.target.value)}
                        className="w-16 text-center font-mono font-bold text-xs py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800"
                      />
                    </td>

                    {/* Official Remark */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={b.remark}
                        onChange={(e) => handleBracketChange(idx, "remark", e.target.value)}
                        className="w-full font-semibold text-xs py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-800"
                      />
                    </td>

                    {/* Classification */}
                    <td className="py-3 px-3">
                      <select
                        value={b.classification}
                        onChange={(e) => handleBracketChange(idx, "classification", e.target.value)}
                        className="w-full font-bold text-[11px] py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-800"
                      >
                        <option value="Distinction">Distinction</option>
                        <option value="Credit">Credit</option>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                      </select>
                    </td>

                    {/* Delete Bracket */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleDeleteBracket(idx)}
                        className="p-1.5 text-slate-400 hover:text-accent-600 transition-colors rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete Level"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-600" />
              Adjustments apply dynamically across all Continuous Assessment modules and terminal report cards.
            </span>
            <button
              onClick={handleSavePolicy}
              className="inline-flex min-h-6 items-center font-black text-brand-600 hover:text-blue-800 cursor-pointer"
            >
              Save &amp; Apply Universal Grading →
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
