"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  CA_TIER_KEYS,
  useRealtimeAuth,
  useRealtimeCAStructure,
  type CAComponentItem,
  type CATierKey,
} from "@/lib/realtime-store";
import {
  ArrowLeft,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Info,
  TriangleAlert,
} from "lucide-react";

const TIER_TAB_SUBTITLES: Record<CATierKey, string> = {
  PLAY_PRESCHOOL: "Creche & Playgroup",
  NURSERY: "Nursery 1 & 2",
  PRIMARY: "Primary 1 – 5",
  SECONDARY: "JSS 1-3 & SS 1-3",
};

export default function CAStructurePage() {
  const { caStructures, caStructuresSource, fileTierStructure, fileStandardOutline, reloadCAStructures } =
    useRealtimeCAStructure();
  const { currentUser } = useRealtimeAuth();

  const [selectedTierKey, setSelectedTierKey] = useState<CATierKey>("SECONDARY");
  const [editingComponents, setEditingComponents] = useState<CAComponentItem[] | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isFiling, setIsFiling] = useState(false);

  const activeStructure = caStructures[selectedTierKey];

  // The draft is this tier's filed list until somebody edits it. Switching tiers
  // — or the school's answer arriving a moment after the page — drops the draft,
  // so an edit started on one tier can never be filed onto another.
  useEffect(() => {
    setEditingComponents(null);
    setEditingNote(null);
  }, [selectedTierKey, caStructuresSource, activeStructure.updatedAt]);

  const currentComponents = editingComponents ?? activeStructure.components;
  const currentNote = editingNote ?? activeStructure.description;
  const currentTotal = currentComponents.reduce((sum, component) => sum + (Number(component.maxScore) || 0), 0);
  const isDraft = editingComponents !== null || editingNote !== null;
  const filedTiers = CA_TIER_KEYS.filter((tierKey) => caStructures[tierKey].components.length > 0);

  const canEdit = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 6000);
  };

  const handleComponentChange = (index: number, field: "name" | "description" | "maxScore", value: string | number) => {
    const updated = [...currentComponents];
    updated[index] = {
      ...updated[index],
      [field]: field === "maxScore" ? Number(value) : value,
    };
    setEditingComponents(updated);
  };

  const handleAddComponent = () => {
    setEditingComponents([
      ...currentComponents,
      {
        key: `custom_${Date.now()}`,
        name: "New Assessment Component",
        maxScore: 10,
        description: "",
      },
    ]);
  };

  const handleDeleteComponent = (index: number) => {
    if (currentComponents.length <= 1) {
      setRefusal("A tier needs at least one component: a mark is made of something.");
      return;
    }
    setEditingComponents(currentComponents.filter((_, i) => i !== index));
  };

  const handleSaveStructure = async () => {
    setRefusal(null);
    if (currentComponents.length === 0) {
      setRefusal(
        "There is nothing to file for this tier yet: add the components it is assessed by, or file the starting outline below and correct it."
      );
      return;
    }
    if (currentTotal !== 100) {
      if (
        !confirm(
          `These components add up to ${currentTotal} marks, not the 100 the standard scale uses. File it on the school's records anyway?`
        )
      ) {
        return;
      }
    }

    setIsFiling(true);
    const outcome = await fileTierStructure(selectedTierKey, {
      components: currentComponents,
      description: currentNote.trim(),
    });
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the portal server refused the write");
      showToast("Nothing was filed on the school's records.");
      return;
    }

    showToast(`${activeStructure.tierTitle}: filed on the school's records.`);
  };

  const handleFileStandardOutline = async () => {
    setRefusal(null);
    if (
      !confirm(
        "File the portal's starting outline for all four tiers (Play & Preschool, Nursery, Primary, Secondary)? " +
          "It is the outline whoever built this software wrote, not a structure this school approved — file it, then correct each tier. " +
          "Any structure already filed for these tiers is replaced."
      )
    ) {
      return;
    }

    setIsFiling(true);
    const outcome = await fileStandardOutline();
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the portal server refused the write");
      showToast("Nothing was filed on the school's records.");
      return;
    }

    setEditingComponents(null);
    setEditingNote(null);
    showToast("The four starting outlines are filed on the school's records. Correct any tier that is not yours.");
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div role="status" className="fixed top-20 right-4 sm:right-6 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3 text-ink shadow-lg animate-in slide-in-from-top-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
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
              <span className="text-slate-900 font-extrabold">Continuous Assessment (CA) Structure</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Tier-Specific Continuous Assessment (CA) Structure</span>
              <span className="text-xs bg-cyan-100 text-cyan-900 font-black px-2.5 py-0.5 rounded-full border border-cyan-300 uppercase">
                {filedTiers.length} of {CA_TIER_KEYS.length} tiers filed
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configurable by <strong>Super Admin</strong> & <strong>Exam Officer</strong> across Early Years, Nursery, Basic Primary & Secondary.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={handleFileStandardOutline}
                disabled={isFiling}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 disabled:bg-slate-300 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                File the starting outline
              </button>
            )}
            <Link
              href="/operations/update-ca"
              className="px-4 py-2 text-xs font-black bg-brand-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-2xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              Open Live CA Gradebook
              <ArrowUpRight className="w-4 h-4 text-cyan-300" />
            </Link>
          </div>
        </div>

        {caStructuresSource !== "server" && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] leading-snug text-amber-950 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>The school&apos;s filed structures could not be read, so this screen is showing this
              browser&apos;s own copy.</strong> Another machine will not see what is typed here, and clearing this
              browser&apos;s data loses it.
            </p>
          </div>
        )}

        {/* A record that is filed but not obeyed has to say so. */}
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-[11px] leading-snug text-sky-950 flex items-start gap-2">
          <Info className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
          <p>
            <strong>This is what the school states its assessment is made of.</strong> It does not yet change how a
            mark is worked out: the gradebook under Operations → Update CA still has five boxes of its own — 10, 10,
            10, 10 and 60 marks — and adds those, whatever is filed here. Filing a different structure changes what
            every machine reads, not a pupil&apos;s total.
          </p>
        </div>

        {refusal && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-[11px] leading-snug text-rose-950 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Nothing was filed on the school&apos;s records.</strong> {refusal}
            </p>
          </div>
        )}

        {/* Permissions & Roles Banner */}
        <div className="texture-grid-light relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-800 via-brand-950 to-night-900 p-4 text-white shadow-lg sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex-shrink-0 rounded-xl bg-white/10 p-2.5 text-white ring-1 ring-inset ring-white/20">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-sm font-extrabold tracking-tight text-white">Tier Assessment Authorization</h3>
                <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                  canEdit
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                    : "border-white/15 bg-white/10 text-white/75"
                }`}>
                  {canEdit ? "EDIT ACCESS GRANTED" : "READ ONLY VIEW"}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-white/70">
                {currentUser ? (
                  <>
                    Logged in as <strong className="font-semibold text-white">{currentUser.fullName}</strong> ({currentUser.role}).
                  </>
                ) : (
                  "Signing in… the server has not named this session yet."
                )}
              </p>
            </div>
          </div>

          <div className="hidden flex-shrink-0 text-right sm:block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-white/55">Standard Scale</span>
            <span className="font-display text-sm font-extrabold tabular-nums text-brand-200">100 Max Cumulative Marks</span>
          </div>
        </div>

        {/* Tier Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CA_TIER_KEYS.map((tierKey) => {
            const isSelected = selectedTierKey === tierKey;
            const filed = caStructures[tierKey].components.length > 0;
            return (
              <button
                key={tierKey}
                type="button"
                onClick={() => setSelectedTierKey(tierKey)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brand-600 text-white border-brand-700 shadow-md ring-2 ring-accent-500/45"
                    : "bg-white text-slate-700 border-slate-200 hover:border-brand-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? "text-brand-200" : "text-slate-400"}`}>
                    Tier {CA_TIER_KEYS.indexOf(tierKey) + 1}
                  </span>
                  {isSelected && <Sparkles className="w-3.5 h-3.5 text-accent-300 flex-shrink-0" />}
                </div>
                <h4 className={`text-sm font-black leading-tight ${isSelected ? "text-white" : "text-slate-900"}`}>
                  {caStructures[tierKey].tierTitle}
                </h4>
                <p className={`text-[11px] mt-1 truncate ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                  {TIER_TAB_SUBTITLES[tierKey]}
                </p>
                <p className={`text-[10px] mt-1 font-bold ${isSelected ? "text-cyan-200" : filed ? "text-emerald-700" : "text-slate-400"}`}>
                  {filed
                    ? `${caStructures[tierKey].components.length} components filed`
                    : "Nothing filed for this tier"}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active Tier Summary Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider bg-blue-100 text-brand-600 border border-blue-200">
                  {activeStructure.tierKey}
                </span>
                <span className="text-xs text-slate-500">
                  Classes in this tier: <strong>{activeStructure.applicableClasses.join(", ")}</strong>
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 break-words">{activeStructure.tierTitle}</h2>
              {canEdit ? (
                <div className="mt-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    The school&apos;s note about this tier
                  </label>
                  <input
                    type="text"
                    value={currentNote}
                    onChange={(e) => setEditingNote(e.target.value)}
                    placeholder="How this tier is assessed, in the school's own words (left blank until now)"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-600"
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-600 mt-0.5">
                  {activeStructure.description ? (
                    activeStructure.description
                  ) : (
                    <em>No note has been filed for this tier.</em>
                  )}
                </p>
              )}
              {activeStructure.updatedBy && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Last filed on the school&apos;s records by {activeStructure.updatedBy}
                  {activeStructure.updatedAt ? ` on ${new Date(activeStructure.updatedAt).toLocaleDateString()}` : ""}.
                </p>
              )}
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
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-brand-600" />
                  <span>Add Assessment</span>
                </button>
              )}
            </div>
          </div>

          {/* Components List / Editable Rows */}
          {currentComponents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-1.5">
              <p className="text-sm font-bold text-slate-800">
                No structure has been filed for {activeStructure.tierTitle}.
              </p>
              <p className="text-xs text-slate-600 max-w-2xl mx-auto">
                {caStructuresSource === "server"
                  ? canEdit
                    ? "Add the components this tier is assessed by, or file the starting outline above and correct it. Until something is filed, this tier's assessment is simply not stated on the school's records."
                    : "The school has not filed one yet. Only a Super Admin or the Exam Office can."
                  : "This browser has no copy of it either. What is typed here stays on this machine until it can be filed on the school's records."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {currentComponents.map((comp, idx) => (
                <div
                  key={`${comp.key}-${idx}`}
                  className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black text-xs flex-shrink-0 shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      {canEdit ? (
                        <input
                          type="text"
                          value={comp.name}
                          onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 outline-none focus:border-brand-600"
                        />
                      ) : (
                        <h4 className="text-sm font-black text-slate-900 break-words">{comp.name}</h4>
                      )}
                      {canEdit ? (
                        <input
                          type="text"
                          value={comp.description}
                          onChange={(e) => handleComponentChange(idx, "description", e.target.value)}
                          placeholder="What this component is (optional)"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-600"
                        />
                      ) : (
                        <p className="text-xs text-slate-500">
                          {comp.description || <em>Not described.</em>}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500">Max Score:</span>
                      {canEdit ? (
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={comp.maxScore}
                          onChange={(e) => handleComponentChange(idx, "maxScore", e.target.value)}
                          className="w-14 font-mono font-black text-xs text-brand-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center outline-none focus:border-brand-600"
                        />
                      ) : (
                        <span className="font-mono font-black text-xs text-brand-600">{comp.maxScore}</span>
                      )}
                      <span className="text-xs font-bold text-slate-400">Marks</span>
                    </div>

                    {canEdit && currentComponents.length > 1 && (
                      <button
                        onClick={() => handleDeleteComponent(idx)}
                        className="text-slate-300 hover:text-accent-600 p-2 transition-colors rounded-lg hover:bg-rose-50"
                        title="Remove Component"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Bar */}
          {canEdit && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 max-w-xl">
                <Info className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                <span>
                  {caStructuresSource === "server"
                    ? "Save files this tier's structure on the school's records, replacing what was there. It changes what the school states, not how a mark is computed."
                    : "The school's records could not be read, so saving will not reach them. This screen is working from this browser's copy."}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isDraft && (
                  <button
                    onClick={() => {
                      setEditingComponents(null);
                      setEditingNote(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel Edits
                  </button>
                )}
                <button
                  onClick={handleSaveStructure}
                  disabled={isFiling}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-black text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-cyan-300" />
                  <span>{isFiling ? "Filing on the school's records…" : "File on the school's records"}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => void reloadCAStructures()}
              className="inline-flex min-h-6 items-center text-[11px] font-bold text-brand-600 hover:text-blue-800 cursor-pointer"
            >
              Read the school&apos;s filed structures again
            </button>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
