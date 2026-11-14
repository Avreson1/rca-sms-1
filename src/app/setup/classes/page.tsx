"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeClasses,
  useRealtimeStaff,
  ClassArmRecord,
} from "@/lib/realtime-store";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import {
  School,
  Plus,
  ArrowLeft,
  Search,
  Trash2,
  TriangleAlert,
  Pencil,
  Check,
  X,
  Loader2,
  Archive,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const SECTIONS: ClassArmRecord["section"][] = [
  "Creche & Playgroup",
  "Nursery School",
  "Basic Primary",
  "Junior Secondary",
  "Senior Secondary",
];

export default function SetupClassesPage() {
  const { classes, classesSource, addClass, updateClass, deleteClass } = useRealtimeClasses();
  const { staff } = useRealtimeStaff();

  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Quick-Add Bar State (Single & Comma-Separated Batch)
  const [quickName, setQuickName] = useState("");
  const [quickSection, setQuickSection] = useState<ClassArmRecord["section"]>("Basic Primary");
  const [quickTeacher, setQuickTeacher] = useState("");
  const [quickCapacity, setQuickCapacity] = useState<number>(0);
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Direct Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<Partial<ClassArmRecord>>({});
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Instant Quick-Add Handler (supports comma-separated batch names)
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;

    const names = trimmed.includes(",")
      ? trimmed.split(",").map((s) => s.trim()).filter((s) => s.length >= 2)
      : [trimmed];

    if (names.length === 0) return;

    setIsQuickAdding(true);
    setRefusal(null);

    const chosenTeacher = staff.find((st) => st.fullName === quickTeacher.trim());
    let addedCount = 0;
    let lastError: string | null = null;

    for (const name of names) {
      const outcome = await addClass({
        name,
        section: quickSection,
        formTeacher: chosenTeacher?.fullName ?? "Unassigned",
        formTeacherId: chosenTeacher?.staffId ?? "",
        capacity: quickCapacity >= 0 ? quickCapacity : 0,
        isActive: true,
      });

      if (outcome.ok) {
        addedCount++;
      } else {
        lastError = outcome.reason;
      }
    }

    setIsQuickAdding(false);

    if (addedCount > 0) {
      setQuickName("");
      showToast(
        addedCount === 1
          ? `Class arm “${names[0]}” added successfully.`
          : `${addedCount} class arms added in catalog.`
      );
    }
    if (lastError && addedCount === 0) {
      setRefusal(lastError);
    }
  };

  // Inline Edit Handlers
  const startInlineEdit = (arm: ClassArmRecord) => {
    setEditingId(arm.id);
    setInlineForm({
      name: arm.name,
      section: arm.section,
      formTeacher: arm.formTeacher,
      formTeacherId: arm.formTeacherId,
      capacity: arm.capacity,
      isActive: arm.isActive !== false,
    });
    setInlineError(null);
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setInlineForm({});
    setInlineError(null);
  };

  const saveInlineEdit = async () => {
    if (!editingId) return;
    const name = inlineForm.name?.trim();
    if (!name || name.length < 2) {
      setInlineError("Class name must be at least 2 characters.");
      return;
    }

    setIsInlineSaving(true);
    setInlineError(null);

    const chosenTeacher = staff.find((st) => st.fullName === inlineForm.formTeacher?.trim());

    const outcome = await updateClass(editingId, {
      name,
      section: inlineForm.section,
      formTeacher: inlineForm.formTeacher || "Unassigned",
      formTeacherId: chosenTeacher?.staffId || inlineForm.formTeacherId || "",
      capacity: typeof inlineForm.capacity === "number" && inlineForm.capacity >= 0 ? inlineForm.capacity : 0,
      isActive: inlineForm.isActive !== false,
    });

    setIsInlineSaving(false);

    if (!outcome.ok) {
      setInlineError(outcome.reason ?? "Failed to update class arm.");
      return;
    }

    setEditingId(null);
    setInlineForm({});
    showToast(`Class arm “${name}” updated successfully.`);
  };

  // Toggle Active / Archive Status
  const toggleArchive = async (arm: ClassArmRecord) => {
    const nextActive = arm.isActive === false;
    const actionLabel = nextActive ? "restore" : "archive";
    if (
      !confirm(
        `${actionLabel.toUpperCase()} class arm “${arm.name}”? ${
          nextActive
            ? "It will be active on the school roster again."
            : "It will be hidden from new admissions but its historical student scores and records remain intact."
        }`
      )
    ) {
      return;
    }

    const outcome = await updateClass(arm.id, { isActive: nextActive });
    if (outcome.ok) {
      showToast(`Class arm “${arm.name}” ${nextActive ? "restored to active" : "archived"}.`);
    } else {
      setRefusal(outcome.reason ?? `Failed to ${actionLabel} class arm.`);
    }
  };

  // Delete Handler with Referential Integrity Notification
  const handleDeleteClass = async (arm: ClassArmRecord) => {
    if (
      !confirm(
        `Permanently remove ${arm.name} from the school's class list?` +
          (arm.studentsCount > 0
            ? ` WARNING: ${arm.name} still has ${arm.studentsCount} pupil(s) enrolled. Deleting will be refused by the server.`
            : "")
      )
    ) {
      return;
    }

    const outcome = await deleteClass(arm.id);
    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "The class arm could not be removed.");
    } else {
      setRefusal(null);
      showToast(`Class arm “${arm.name}” removed from database.`);
    }
  };

  // Filtered List
  const filtered = classes.filter((c) => {
    const matchesSection = sectionFilter === "all" || c.section === sectionFilter;
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? c.isActive !== false
        : c.isActive === false;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.formTeacher.toLowerCase().includes(search.toLowerCase());
    return matchesSection && matchesStatus && matchesSearch;
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="flex min-h-6 items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Setup</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Classes &amp; Arms</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Academic Classes &amp; Arms Catalog
              </h1>
              <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                {classes.filter((c) => c.isActive !== false).length} Active Arms
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Academic master configuration for {SCHOOL_INFO.name}. Fast inline additions and corrections without account-creation wizards.
            </p>
          </div>
        </div>

        {classesSource === "device" && <DeviceOnlyNotice what="The class list" />}

        {/* Feedback Messages */}
        {refusal && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-950 flex items-start justify-between gap-2 print:hidden animate-in fade-in">
            <div className="flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Action Blocked:</strong> {refusal}
              </div>
            </div>
            <button
              onClick={() => setRefusal(null)}
              className="text-rose-700 font-bold hover:text-rose-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successToast && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* 1. INSTANT INLINE QUICK-ADD BAR (Single & Comma-Separated Batch) */}
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-[#4169E1]" />
              <span>Instant Quick-Add Class Arm (Single or Comma-Separated Batch)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Press Enter to Add</span>
          </div>

          <form onSubmit={handleQuickAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
            <div className="sm:col-span-4">
              <input
                type="text"
                placeholder="Class name(s) e.g. Primary 1A, Primary 1B"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={quickSection}
                onChange={(e) => setQuickSection(e.target.value as ClassArmRecord["section"])}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
              >
                {SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={quickTeacher}
                onChange={(e) => setQuickTeacher(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium"
              >
                <option value="">Form Master: Unassigned</option>
                {staff.map((st) => (
                  <option key={st.id} value={st.fullName}>
                    {st.fullName} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex gap-1.5">
              <button
                type="submit"
                disabled={isQuickAdding || !quickName.trim()}
                className="w-full px-4 py-2 bg-[#4169E1] hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isQuickAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Arm
              </button>
            </div>
          </form>
          <p className="text-[10px] text-slate-400">
            Tip: Enter multiple arms separated by commas (e.g. <code>JSS 1A, JSS 1B, JSS 1C</code>) to batch create in one click without wizards.
          </p>
        </div>

        {/* 2. FILTER & SEARCH TOOLBAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <span className="font-bold text-slate-500 text-[11px] uppercase mr-1">Section:</span>
            {["all", ...SECTIONS].map((sec) => (
              <button
                key={sec}
                onClick={() => setSectionFilter(sec)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  sectionFilter === sec
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {sec === "all" ? "All Sections" : sec}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            >
              <option value="active">Active Arms Only</option>
              <option value="all">All (Active &amp; Archived)</option>
              <option value="archived">Archived Arms Only</option>
            </select>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search class or teacher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* 3. DIRECT INLINE EDITING TABLE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-800">Academic Class Register</h3>
            </div>
            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
              {filtered.length} Classes Listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Class Arm Name</th>
                  <th className="py-3 px-4">Section Tier</th>
                  <th className="py-3 px-4">Assigned Form Master</th>
                  <th className="py-3 px-3 text-center">Enrolled Pupils</th>
                  <th className="py-3 px-3 text-center">Room Cap</th>
                  <th className="py-3 px-3 text-center">Catalog Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-500">
                      {classes.length === 0
                        ? "No class arm registered yet. Use the quick-add bar above to create one."
                        : "No class matches your active filters."}
                    </td>
                  </tr>
                )}

                {filtered.map((c) => {
                  const isEditing = editingId === c.id;

                  if (isEditing) {
                    return (
                      <React.Fragment key={c.id}>
                        <tr className="bg-blue-50/50 border-y-2 border-[#4169E1]">
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={inlineForm.name ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, name: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveInlineEdit();
                                if (e.key === "Escape") cancelInlineEdit();
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-blue-400 rounded-lg font-bold text-slate-900 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={inlineForm.section ?? c.section}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, section: e.target.value as any }))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                            >
                              {SECTIONS.map((sec) => (
                                <option key={sec} value={sec}>
                                  {sec}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={inlineForm.formTeacher ?? c.formTeacher}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, formTeacher: e.target.value }))}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                            >
                              <option value="Unassigned">Unassigned</option>
                              {staff.map((st) => (
                                <option key={st.id} value={st.fullName}>
                                  {st.fullName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                            {c.studentsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={inlineForm.capacity ?? c.capacity}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, capacity: parseInt(e.target.value, 10) || 0 }))}
                              className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={inlineForm.isActive !== false ? "active" : "archived"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, isActive: e.target.value === "active" }))}
                              className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                            >
                              <option value="active">Active</option>
                              <option value="archived">Archived</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => void saveInlineEdit()}
                                disabled={isInlineSaving}
                                className="px-3 py-1.5 bg-[#4169E1] hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                {isInlineSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelInlineEdit}
                                disabled={isInlineSaving}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                        {inlineError && (
                          <tr className="bg-rose-50 border-b border-rose-200">
                            <td colSpan={7} className="py-2 px-4 text-rose-800 text-[11px] font-semibold flex items-center gap-2">
                              <TriangleAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                              <span>{inlineError}</span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }

                  const isArchived = c.isActive === false;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-blue-50/20 transition-colors ${isArchived ? "opacity-60 bg-slate-50/50" : ""}`}
                    >
                      <td className="py-3 px-4 font-extrabold text-blue-900 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{c.name}</span>
                          {isArchived && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.section === "Creche & Playgroup"
                              ? "bg-purple-100 text-purple-800"
                              : c.section === "Nursery School"
                              ? "bg-pink-100 text-pink-800"
                              : c.section === "Basic Primary"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.section === "Junior Secondary"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {c.section}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{c.formTeacher}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        <span className="bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 rounded font-mono font-bold">
                          {c.studentsCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 font-mono">
                        {c.capacity === 0 ? (
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                            Dynamic
                          </span>
                        ) : (
                          <span>{c.capacity}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isArchived
                              ? "bg-slate-200 text-slate-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isArchived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => startInlineEdit(c)}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Direct inline edit"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>

                        <button
                          onClick={() => void toggleArchive(c)}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            isArchived
                              ? "text-emerald-700 hover:bg-emerald-100"
                              : "text-slate-400 hover:text-amber-700 hover:bg-amber-50"
                          }`}
                          title={isArchived ? "Restore to active" : "Archive class arm"}
                        >
                          {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => void handleDeleteClass(c)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete class arm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
