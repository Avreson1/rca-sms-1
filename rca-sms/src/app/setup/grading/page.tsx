"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeGradingScales,
  GradeBracket,
  DEFAULT_GRADING_TIERS,
  UNIVERSAL_GRADING_BRACKETS,
} from "@/lib/realtime-store";
import {
  Award,
  ArrowLeft,
  Save,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Info,
} from "lucide-react";

export default function SetupGradingPage() {
  const { gradingTiers, updateGradingTierBrackets, resetGradingScalesToDefault } = useRealtimeGradingScales();
  const [activeTierKey, setActiveTierKey] = useState<string>("PRIMARY");
  const [isSaved, setIsSaved] = useState(false);

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

  const handleSavePolicy = () => {
    updateGradingTierBrackets(activeTierKey, brackets);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetUniversal = () => {
    if (confirm("Reset to official Universal Grading Standard (A: 70-100, B: 60-69, C: 50-59, D: 45-49 Pass, F: 0-44)?")) {
      setBrackets(UNIVERSAL_GRADING_BRACKETS);
      updateGradingTierBrackets(activeTierKey, UNIVERSAL_GRADING_BRACKETS);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
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
              <span className="text-slate-900 font-extrabold">Universal Grading System</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Approved Universal Grading Criteria
              </h1>
              <span className="bg-blue-100 text-[#0000FF] border border-blue-300 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Universal Standards
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized A – F universal grading criteria across all classes. Pass mark is officially set at <strong>45% (Grade D)</strong>.
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
              className="px-4 py-2 text-xs font-black bg-[#0000FF] hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4 text-cyan-300" />
              {isSaved ? "Grading Scale Saved!" : "Save & Sync Scale"}
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {isSaved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Grading criteria synchronized! Gradebooks and scorecards updated in real-time.
          </div>
        )}

        {/* Universal Standard Info Banner */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950 via-[#0a1128] to-blue-950 text-white border border-cyan-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/20 px-2.5 py-0.5 rounded-full border border-cyan-400/40">
                Official Universal Standard
              </span>
              <span className="text-xs text-blue-200 font-bold">Enforced Across All Classes</span>
            </div>
            <h2 className="text-lg font-black text-white">
              A (70-100) • B (60-69) • C (50-59) • D (45-49 Pass Mark) • F (0-44 Fail)
            </h2>
            <p className="text-xs text-blue-200/80 leading-relaxed max-w-2xl">
              Applicable uniformly across Creche, Playgroup, Nursery 1-2, Basic Primary 1-5, JSS 1-3 and SS 1-3.
            </p>
          </div>

          <div className="bg-blue-900/60 border border-cyan-400/30 p-3.5 rounded-2xl text-center min-w-[150px]">
            <span className="text-[10px] text-cyan-300 uppercase font-bold block">Pass Benchmark</span>
            <strong className="text-2xl font-black text-white">45% (D)</strong>
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
                  ? "bg-[#0000FF] text-white shadow-md shadow-blue-900/30 border border-cyan-400/40"
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
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0000FF] font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
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
                        className="w-16 text-center font-black text-sm py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-300 text-[#0000FF] focus:border-[#0000FF] focus:ring-1 focus:ring-[#0000FF]"
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
                        className="p-1.5 text-slate-400 hover:text-[#FF0000] transition-colors rounded-lg hover:bg-rose-50 cursor-pointer"
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
              className="font-black text-[#0000FF] hover:text-blue-800 cursor-pointer"
            >
              Save &amp; Apply Universal Grading →
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
