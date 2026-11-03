"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeCAStructure,
  useRealtimeAuth,
  TierCAStructure,
  CAComponentItem,
} from "@/lib/realtime-store";
import {
  PieChart,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  Database,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Save,
  RotateCcw,
  AlertTriangle,
  Info,
} from "lucide-react";

export default function CAStructurePage() {
  const { caStructures, updateTierCAComponents, resetCAStructuresToDefault } = useRealtimeCAStructure();
  const { currentUser } = useRealtimeAuth();

  const [selectedTierKey, setSelectedTierKey] = useState<"PLAY_PRESCHOOL" | "NURSERY" | "PRIMARY" | "SECONDARY">("SECONDARY");
  const [editingComponents, setEditingComponents] = useState<CAComponentItem[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeStructure: TierCAStructure = caStructures[selectedTierKey] || {
    tierKey: selectedTierKey,
    tierTitle: "Educational Tier",
    applicableClasses: [],
    components: [],
    totalMaxScore: 100,
    description: "Standard tier Continuous Assessment structure.",
  };

  const currentComponents = editingComponents ?? activeStructure.components;
  const currentTotal = currentComponents.reduce((sum, c) => sum + (Number(c.maxScore) || 0), 0);

  const canEdit = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleComponentChange = (index: number, field: keyof CAComponentItem, value: any) => {
    const updated = [...currentComponents];
    updated[index] = {
      ...updated[index],
      [field]: field === "maxScore" || field === "weight" ? Number(value) : value,
    };
    setEditingComponents(updated);
  };

  const handleAddComponent = () => {
    const newComp: CAComponentItem = {
      id: `comp-${Date.now()}`,
      name: "New Assessment Component",
      key: `custom_${Date.now()}`,
      maxScore: 10,
      weight: 10,
      description: "Custom assessment criteria.",
    };
    setEditingComponents([...currentComponents, newComp]);
  };

  const handleDeleteComponent = (index: number) => {
    if (currentComponents.length <= 1) {
      alert("At least one assessment component is required.");
      return;
    }
    const updated = currentComponents.filter((_, i) => i !== index);
    setEditingComponents(updated);
  };

  const handleSaveStructure = () => {
    if (currentTotal !== 100) {
      if (!confirm(`Warning: The total score sum is ${currentTotal}/100 Marks. Standard curriculum guidelines require exactly 100 Marks. Do you wish to save anyway?`)) {
        return;
      }
    }

    updateTierCAComponents(selectedTierKey, currentComponents);
    setEditingComponents(null);
    showToast(`Saved CA Structure for ${activeStructure.tierTitle}`);
  };

  const handleResetDefaults = () => {
    if (confirm("Reset all educational tier CA structures to standard approved defaults?")) {
      resetCAStructuresToDefault();
      setEditingComponents(null);
      showToast("Reset all CA structures to curriculum defaults.");
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-6 bg-[#0a1128] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-in slide-in-from-top-3 border border-cyan-400">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
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
              <span className="text-slate-900 font-extrabold">Continuous Assessment (CA) Structure</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Tier-Specific Continuous Assessment (CA) Engine</span>
              <span className="text-xs bg-cyan-100 text-cyan-900 font-black px-2.5 py-0.5 rounded-full border border-cyan-300 uppercase">
                Tier Configurable
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configurable by <strong>Super Admin</strong> & <strong>Exam Officer</strong> across Early Years, Nursery, Basic Primary & Secondary.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              Reset All Defaults
            </button>
            <Link
              href="/operations/update-ca"
              className="px-4 py-2 text-xs font-black bg-[#0000FF] hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              Open Live CA Gradebook
              <ArrowUpRight className="w-4 h-4 text-cyan-300" />
            </Link>
          </div>
        </div>

        {/* Permissions & Roles Banner */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-950 via-[#0a1128] to-blue-950 text-white border border-cyan-400/30 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0000FF] text-cyan-200 ring-1 ring-cyan-400/50">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Tier Weight Assignment Authorization</h3>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-300 font-mono font-bold px-2 py-0.2 rounded border border-cyan-400/40">
                  {canEdit ? "EDIT ACCESS GRANTED" : "READ ONLY VIEW"}
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Logged in as <strong>{currentUser?.fullName || "Dr. Dominic Mark"}</strong> ({currentUser?.role || "SUPER_ADMIN"}).
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Standard Scale</span>
            <span className="text-sm font-black text-cyan-300">100 Max Cumulative Marks</span>
          </div>
        </div>

        {/* Tier Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: "PLAY_PRESCHOOL", title: "Play & Preschool", sub: "Creche & Play (Exam 100)" },
            { key: "NURSERY", title: "Nursery 1 & 2", sub: "4 Assessments + Exam" },
            { key: "PRIMARY", title: "Primary 1 – 5", sub: "4 Assessments + Internal/External" },
            { key: "SECONDARY", title: "JSS 1-3 & SS 1-3", sub: "4 Assessments + CBT Exam" },
          ].map((tier) => {
            const isSelected = selectedTierKey === tier.key;
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => {
                  setSelectedTierKey(tier.key as any);
                  setEditingComponents(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0000FF] text-white border-cyan-400 shadow-lg shadow-blue-900/40 ring-2 ring-cyan-400/30"
                    : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? "text-cyan-200" : "text-slate-400"}`}>
                    Tier {tier.key === "PLAY_PRESCHOOL" ? "1" : tier.key === "NURSERY" ? "2" : tier.key === "PRIMARY" ? "3" : "4"}
                  </span>
                  {isSelected && <Sparkles className="w-3.5 h-3.5 text-cyan-300" />}
                </div>
                <h4 className={`text-sm font-black leading-tight ${isSelected ? "text-white" : "text-slate-900"}`}>{tier.title}</h4>
                <p className={`text-[11px] mt-1 truncate ${isSelected ? "text-blue-100" : "text-slate-500"}`}>{tier.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Active Tier Summary Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider bg-blue-100 text-[#0000FF] border border-blue-200">
                  {activeStructure.tierKey}
                </span>
                <span className="text-xs text-slate-500">
                  Applicable Classes: <strong>{activeStructure.applicableClasses.join(", ")}</strong>
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900">{activeStructure.tierTitle}</h2>
              <p className="text-xs text-slate-600 mt-0.5">{activeStructure.description}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border text-center min-w-[120px] ${
                currentTotal === 100
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">Total Score</span>
                <strong className="text-2xl font-black">{currentTotal} / 100</strong>
              </div>

              {canEdit && (
                <button
                  onClick={handleAddComponent}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#0000FF]" />
                  <span>Add Assessment</span>
                </button>
              )}
            </div>
          </div>

          {/* Components List / Editable Rows */}
          <div className="space-y-3.5">
            {currentComponents.map((comp, idx) => (
              <div
                key={comp.id || idx}
                className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-[#0000FF] text-white flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="space-y-1 flex-1">
                    {canEdit ? (
                      <input
                        type="text"
                        value={comp.name}
                        onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 outline-none focus:border-[#0000FF]"
                      />
                    ) : (
                      <h4 className="text-sm font-black text-slate-900">{comp.name}</h4>
                    )}
                    {canEdit ? (
                      <input
                        type="text"
                        value={comp.description}
                        onChange={(e) => handleComponentChange(idx, "description", e.target.value)}
                        placeholder="Component description..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-[#0000FF]"
                      />
                    ) : (
                      <p className="text-xs text-slate-500">{comp.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500">Max Score:</span>
                    {canEdit ? (
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={comp.maxScore}
                        onChange={(e) => handleComponentChange(idx, "maxScore", e.target.value)}
                        className="w-14 font-mono font-black text-xs text-[#0000FF] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center outline-none focus:border-[#0000FF]"
                      />
                    ) : (
                      <span className="font-mono font-black text-xs text-[#0000FF]">{comp.maxScore}</span>
                    )}
                    <span className="text-xs font-bold text-slate-400">Marks</span>
                  </div>

                  {canEdit && currentComponents.length > 1 && (
                    <button
                      onClick={() => handleDeleteComponent(idx)}
                      className="text-slate-300 hover:text-[#FF0000] p-2 transition-colors rounded-lg hover:bg-rose-50"
                      title="Remove Component"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          {canEdit && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                <span>Changes will take effect instantly in the Live Gradebook and Student Report Cards.</span>
              </div>

              <div className="flex items-center gap-2">
                {editingComponents && (
                  <button
                    onClick={() => setEditingComponents(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel Edits
                  </button>
                )}
                <button
                  onClick={handleSaveStructure}
                  className="px-5 py-2.5 bg-[#0000FF] hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-cyan-300" />
                  <span>Save CA Weights</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardShell>
  );
}
