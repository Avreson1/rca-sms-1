"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeTraits, TraitConfigItem } from "@/lib/realtime-store";
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Heart,
  Activity,
  Trash2,
  RotateCcw,
  Sliders,
} from "lucide-react";

export default function SetupTraitsPage() {
  const { traits, addTrait, deleteTrait, resetTraitsToDefault } = useRealtimeTraits();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTraitName, setNewTraitName] = useState("");
  const [newTraitCategory, setNewTraitCategory] = useState<"Affective (Behavioral)" | "Psychomotor (Physical / Skill)">("Affective (Behavioral)");
  const [newTraitDescription, setNewTraitDescription] = useState("");

  const handleCreateTrait = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTraitName.trim()) return;

    addTrait({
      name: newTraitName.trim(),
      category: newTraitCategory,
      scale: "1 - 5 Scale",
      description: newTraitDescription.trim() || "Form Master character assessment rating.",
    });

    setNewTraitName("");
    setNewTraitDescription("");
    setIsModalOpen(false);
  };

  const affectiveList = traits.filter((t) => t.category.toLowerCase().includes("affective"));
  const psychomotorList = traits.filter((t) => t.category.toLowerCase().includes("psychomotor"));

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
              <span className="text-slate-800 font-semibold">Behavioral Traits</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Affective &amp; Psychomotor Traits Configuration
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Define the character metrics and skill acquisition criteria evaluated on terminal scorecards at {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={resetTraitsToDefault}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Reset traits to national curriculum standards"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Defaults
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add New Trait
            </button>

            <Link
              href="/operations/traits-assessments"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              Assess Students Now →
            </Link>
          </div>
        </div>

        {/* 2-Column Traits Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Affective Domain */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-purple-200">
              <h3 className="font-extrabold text-sm text-purple-950 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4 text-purple-600" />
                Affective Domain (Behavioral &amp; Social Habits)
              </h3>
              <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                {affectiveList.length} Traits
              </span>
            </div>

            <div className="space-y-3">
              {affectiveList.map((t) => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5 hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                      Affective
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400">{t.scale}</span>
                      <button
                        type="button"
                        onClick={() => deleteTrait(t.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete trait"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{t.name}</h4>
                  <p className="text-xs text-slate-500">{t.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Psychomotor Domain */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200">
              <h3 className="font-extrabold text-sm text-blue-950 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Psychomotor Domain (Skills &amp; Physical Dexterity)
              </h3>
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {psychomotorList.length} Traits
              </span>
            </div>

            <div className="space-y-3">
              {psychomotorList.map((t) => (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5 hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      Psychomotor
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400">{t.scale}</span>
                      <button
                        type="button"
                        onClick={() => deleteTrait(t.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete trait"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{t.name}</h4>
                  <p className="text-xs text-slate-500">{t.description}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal: Add Trait */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  Add New Assessment Trait
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreateTrait} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trait Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Critical Thinking & Problem Solving"
                    value={newTraitName}
                    onChange={(e) => setNewTraitName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Educational Domain</label>
                  <select
                    value={newTraitCategory}
                    onChange={(e) => setNewTraitCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="Affective (Behavioral)">Affective Domain (Character, Manners &amp; Social Habits)</option>
                    <option value="Psychomotor (Physical / Skill)">Psychomotor Domain (Dexterity, Agility &amp; Practical Skills)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Evaluation Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of behavior or skill being assessed..."
                    value={newTraitDescription}
                    onChange={(e) => setNewTraitDescription(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Save Trait
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
