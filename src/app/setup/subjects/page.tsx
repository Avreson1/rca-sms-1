"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeClasses, useRealtimeSubjects, SubjectRecord } from "@/lib/realtime-store";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import {
  BookOpen,
  Plus,
  Search,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Layers,
  Sparkles,
  Upload,
  Download,
  CheckSquare,
  Square,
  TriangleAlert,
  Pencil,
  Check,
  X,
  Loader2,
  Archive,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

const CATEGORIES = [
  "General / Core",
  "Language & Literacy",
  "Mathematical Sciences",
  "Basic Sciences & Technology",
  "Social & Civic Studies",
  "Creative & Cultural Arts",
  "Religious & Moral Studies",
  "Vocational & Agricultural",
  "Senior Science",
  "Senior Arts & Humanities",
  "Senior Commercial & Business",
  "Early Childhood / Montessori",
];

export default function SetupSubjectsPage() {
  const { subjects, subjectsSource, addSubjects, updateSubject, deleteSubject, clearAllSubjects } = useRealtimeSubjects();
  const { classes } = useRealtimeClasses();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "PRIMARY" | "SECONDARY">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "archived">("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  // Quick-Add Bar State (Single & Comma-Separated Batch)
  const [quickNames, setQuickNames] = useState("");
  const [quickLevel, setQuickLevel] = useState<"PRIMARY" | "SECONDARY" | "ALL">("PRIMARY");
  const [quickCategory, setQuickCategory] = useState("General / Core");
  const [quickIsCore, setQuickIsCore] = useState(true);
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Direct Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<Partial<SubjectRecord>>({});
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Modal Form State
  const [subjectName, setSubjectName] = useState("");
  const [batchNamesText, setBatchNamesText] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [category, setCategory] = useState("General / Core");
  const [isCompulsory, setIsCompulsory] = useState(true);
  const [isCore, setIsCore] = useState(false);
  const [schoolLevel, setSchoolLevel] = useState<"PRIMARY" | "SECONDARY" | "ALL">("PRIMARY");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const armNames = classes.map((c) => c.name);
  const armsInSection = (section: string) =>
    classes.filter((c) => c.section === section).map((c) => c.name);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Instant Quick-Add Handler (supports comma-separated batch input)
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = quickNames.trim();
    if (!raw) return;

    const names = raw.includes(",")
      ? raw.split(",").map((s) => s.trim()).filter((s) => s.length >= 2)
      : [raw];

    if (names.length === 0) return;

    setIsQuickAdding(true);
    setRefusal(null);

    // Auto-assign classes based on school level
    const targetClasses =
      quickLevel === "PRIMARY"
        ? armsInSection("Basic Primary")
        : quickLevel === "SECONDARY"
        ? [...armsInSection("Junior Secondary"), ...armsInSection("Senior Secondary")]
        : [];

    const payload = names.map((name) => {
      const coreDetected =
        quickIsCore ||
        name.toLowerCase().includes("mathematics") ||
        name.toLowerCase().includes("english language") ||
        name.toLowerCase() === "english" ||
        name.toLowerCase() === "maths";

      return {
        name,
        code: undefined,
        category: quickCategory,
        applicableClasses: targetClasses,
        isCompulsory: true,
        isCore: coreDetected,
        schoolLevel: quickLevel,
        isActive: true,
      };
    });

    const outcome = await addSubjects(payload);
    setIsQuickAdding(false);

    if (outcome.ok) {
      setQuickNames("");
      showToast(
        names.length === 1
          ? `Subject “${names[0]}” added successfully.`
          : `${names.length} subjects registered in catalog.`
      );
    } else {
      setRefusal(outcome.reason ?? "Failed to add subjects.");
    }
  };

  // Direct Inline Edit Handlers
  const startInlineEdit = (s: SubjectRecord) => {
    setEditingId(s.id);
    setInlineForm({
      name: s.name,
      code: s.code || "",
      category: s.category || "General / Core",
      schoolLevel: s.schoolLevel || "PRIMARY",
      isCore: Boolean(s.isCore),
      isCompulsory: s.isCompulsory !== false,
      isActive: s.isActive !== false,
      applicableClasses: s.applicableClasses,
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
      setInlineError("Subject title must be at least 2 characters.");
      return;
    }

    setIsInlineSaving(true);
    setInlineError(null);

    const outcome = await updateSubject(editingId, {
      name,
      code: inlineForm.code?.trim() || "",
      category: inlineForm.category || "General / Core",
      schoolLevel: inlineForm.schoolLevel || "PRIMARY",
      isCore: Boolean(inlineForm.isCore),
      isCompulsory: inlineForm.isCompulsory !== false,
      isActive: inlineForm.isActive !== false,
      applicableClasses: inlineForm.applicableClasses || [],
    });

    setIsInlineSaving(false);

    if (!outcome.ok) {
      setInlineError(outcome.reason ?? "Failed to save subject update.");
      return;
    }

    setEditingId(null);
    setInlineForm({});
    showToast(`Subject “${name}” updated successfully.`);
  };

  // 1-Click Toggle Active / Archive
  const toggleArchive = async (s: SubjectRecord) => {
    const nextActive = s.isActive === false;
    const actionLabel = nextActive ? "restore" : "archive";
    if (
      !confirm(
        `${actionLabel.toUpperCase()} subject “${s.name}”? ${
          nextActive
            ? "It will be active on the CA entry grid and timetable again."
            : "It will be hidden from new CA score entry, but all existing student scores on past report cards are fully preserved."
        }`
      )
    ) {
      return;
    }

    const outcome = await updateSubject(s.id, { isActive: nextActive });
    if (outcome.ok) {
      showToast(`Subject “${s.name}” ${nextActive ? "restored to active" : "archived"}.`);
    } else {
      setRefusal(outcome.reason ?? `Failed to ${actionLabel} subject.`);
    }
  };

  // Delete Handler with Referential Protection
  const handleDeleteSubject = async (s: SubjectRecord) => {
    if (
      !confirm(
        `Permanently delete “${s.name}” from the school's catalog? WARNING: If students already have CA marks or timetable slots for this subject, deletion will be blocked by the server.`
      )
    ) {
      return;
    }

    const outcome = await deleteSubject(s.id);
    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "The subject could not be deleted.");
    } else {
      setRefusal(null);
      showToast(`Subject “${s.name}” deleted from database.`);
    }
  };

  // Helper to toggle a single class in modal
  const toggleClass = (cls: string) => {
    if (selectedClasses.includes(cls)) {
      setSelectedClasses(selectedClasses.filter((c) => c !== cls));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  // Modal Preset Selectors
  const selectEveryArm = () => setSelectedClasses([]);
  const selectEarlyYears = () => setSelectedClasses(armsInSection("Creche & Playgroup"));
  const selectNursery = () => setSelectedClasses(armsInSection("Nursery School"));
  const selectPrimary = () => setSelectedClasses(armsInSection("Basic Primary"));
  const selectJSS = () => setSelectedClasses(armsInSection("Junior Secondary"));
  const selectSSS = () => setSelectedClasses(armsInSection("Senior Secondary"));

  /** Posts the batch and shows feedback */
  const fileSubjects = async (list: Omit<SubjectRecord, "id">[]) => {
    setIsSaving(true);
    const outcome = await addSubjects(list);
    setIsSaving(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the subject list was not filed");
      return false;
    }

    setRefusal(null);
    showToast(`${outcome.saved} subject${outcome.saved === 1 ? "" : "s"} filed on the school's subject list.`);
    return true;
  };

  const handleSaveModalSubject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBatchMode) {
      const names = batchNamesText
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (names.length === 0) {
        alert("Please enter at least one subject title.");
        return;
      }

      if (
        await fileSubjects(
          names.map((name) => ({
            name,
            code: undefined,
            category,
            applicableClasses: selectedClasses,
            isCompulsory,
            isCore:
              isCore ||
              name.toLowerCase().includes("mathematics") ||
              name.toLowerCase().includes("english language") ||
              name.toLowerCase() === "english" ||
              name.toLowerCase() === "maths",
            schoolLevel,
            isActive: true,
          }))
        )
      ) {
        setIsModalOpen(false);
        setBatchNamesText("");
      }
      return;
    }

    if (!subjectName.trim()) {
      alert("Please enter the subject title.");
      return;
    }

    if (
      await fileSubjects([
        {
          name: subjectName.trim(),
          code: subjectCode.trim() || undefined,
          category,
          applicableClasses: selectedClasses,
          isCompulsory,
          isCore,
          schoolLevel,
          isActive: true,
        },
      ])
    ) {
      setIsModalOpen(false);
      setSubjectName("");
      setSubjectCode("");
    }
  };

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const headers = ["Subject Title", "Subject Code (Optional)", "Category", "Compulsory (YES/NO)", "Classes (Semicolon-Separated)"];
    const sampleRow = [
      "Mathematics",
      "MTH 101",
      "Mathematical Sciences",
      "YES",
      armNames.length > 0 ? `"${armNames.slice(0, 3).join(";")}"` : `""`,
    ];
    const csvContent = "\uFEFF" + [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RCA_Subjects_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Subject CSV template downloaded.");
  };

  // CSV Import
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          alert("CSV is empty or only contains headers.");
          return;
        }

        const imported: Omit<SubjectRecord, "id">[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          if (row.length < 1) continue;
          const name = row[0]?.replace(/^"|"$/g, "").trim();
          if (!name) continue;
          const code = row[1]?.replace(/^"|"$/g, "").trim() || undefined;
          const cat = row[2]?.replace(/^"|"$/g, "").trim() || "General / Core";
          const comp = row[3]?.replace(/^"|"$/g, "").trim().toUpperCase() !== "NO";
          const classesStr = row[4]?.replace(/^"|"$/g, "").trim();
          const parsedClasses = classesStr ? classesStr.split(";").map((c) => c.trim()).filter(Boolean) : [];
          const knownClasses = parsedClasses.filter((cls) => armNames.includes(cls));

          imported.push({
            name,
            code,
            category: cat,
            isCompulsory: comp,
            isCore: name.toLowerCase().includes("math") || name.toLowerCase().includes("english"),
            schoolLevel: "PRIMARY",
            isActive: true,
            applicableClasses: knownClasses.length > 0 ? knownClasses : [],
          });
        }

        if (imported.length > 0) {
          void fileSubjects(imported);
        }
      } catch (err) {
        alert("Failed to parse CSV file: " + String(err));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Filtered Subjects
  const filtered = subjects.filter((s) => {
    const matchesLevel =
      levelFilter === "all"
        ? true
        : s.schoolLevel === levelFilter || s.schoolLevel === "ALL" || !s.schoolLevel;

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? s.isActive !== false
        : s.isActive === false;

    const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;

    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

    return matchesLevel && matchesStatus && matchesCategory && matchesSearch;
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
              <span className="text-slate-800 font-semibold">Subjects</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Academic Subjects Catalogue
              </h1>
              <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                {subjects.filter((s) => s.isActive !== false).length} Active Subjects
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Academic master curriculum catalog for {SCHOOL_INFO.name}. Fast batch creation, core subject tagging, and direct inline corrections.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              CSV Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Upload CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              onClick={() => {
                setIsBatchMode(false);
                setSelectedClasses([]);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold bg-[#4169E1] hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Advanced Subject Dialog
            </button>
          </div>
        </div>

        {subjectsSource === "device" && <DeviceOnlyNotice what="The subject list" />}

        {/* Feedback Alerts */}
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

        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-950 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. INSTANT INLINE QUICK-ADD BAR (Single & Comma-Separated Batch) */}
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-[#4169E1]" />
              <span>Instant Quick-Add Subjects (Single or Comma-Separated Batch)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Press Enter to Add</span>
          </div>

          <form onSubmit={handleQuickAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
            <div className="sm:col-span-5">
              <input
                type="text"
                placeholder="e.g. Mathematics, English Language, Basic Science, Civic Education"
                value={quickNames}
                onChange={(e) => setQuickNames(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={quickLevel}
                onChange={(e) => setQuickLevel(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
              >
                <option value="PRIMARY">Primary School</option>
                <option value="SECONDARY">Secondary School</option>
                <option value="ALL">Cross-Section (All)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1 flex items-center justify-center">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={quickIsCore}
                  onChange={(e) => setQuickIsCore(e.target.checked)}
                  className="rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
                <span>Core</span>
              </label>
            </div>

            <div className="sm:col-span-2 flex gap-1.5">
              <button
                type="submit"
                disabled={isQuickAdding || !quickNames.trim()}
                className="w-full px-4 py-2 bg-[#4169E1] hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isQuickAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Subjects
              </button>
            </div>
          </form>
          <p className="text-[10px] text-slate-400">
            Batch mode active: typing comma-separated names registers all subjects in one submission without wizards or account creation.
          </p>
        </div>

        {/* 2. FILTER CONTROLS */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search subject title or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 focus:outline-hidden"
            />
          </div>

          <div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800"
            >
              <option value="all">All School Levels</option>
              <option value="PRIMARY">Primary School (RCA)</option>
              <option value="SECONDARY">Secondary School (RCHS)</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800"
            >
              <option value="all">All Departments / Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800"
            >
              <option value="active">Active Subjects Only</option>
              <option value="all">All (Active &amp; Archived)</option>
              <option value="archived">Archived Subjects Only</option>
            </select>
          </div>
        </div>

        {/* 3. DIRECT INLINE EDITING TABLE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-800">Curriculum Subjects Catalogue</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                {filtered.length} Subjects Listed
              </span>
              {subjects.length > 0 && subjectsSource === "server" && (
                <button
                  onClick={async () => {
                    if (!confirm(`Clear all ${subjects.length} subjects from the school's list? Historical CA scores will be preserved.`)) return;
                    const outcome = await clearAllSubjects();
                    if (!outcome.ok) setRefusal(outcome.reason);
                    else showToast("Subject catalog cleared.");
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Subject Title</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Level</th>
                  <th className="py-3 px-3">Department / Category</th>
                  <th className="py-3 px-3 text-center">Core Rule</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-xs text-slate-500">
                      {subjects.length === 0
                        ? "No subjects registered yet. Use the quick-add bar above to create subjects."
                        : "No subject matches your active filters."}
                    </td>
                  </tr>
                )}

                {filtered.map((s) => {
                  const isEditing = editingId === s.id;

                  if (isEditing) {
                    return (
                      <React.Fragment key={s.id}>
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
                            <input
                              type="text"
                              placeholder="Code"
                              value={inlineForm.code ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, code: e.target.value }))}
                              className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold text-blue-900"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={inlineForm.schoolLevel ?? "PRIMARY"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, schoolLevel: e.target.value as any }))}
                              className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                            >
                              <option value="PRIMARY">PRIMARY</option>
                              <option value="SECONDARY">SECONDARY</option>
                              <option value="ALL">ALL</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={inlineForm.category ?? "General / Core"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, category: e.target.value }))}
                              className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(inlineForm.isCore)}
                                onChange={(e) => setInlineForm((prev) => ({ ...prev, isCore: e.target.checked }))}
                                className="rounded text-[#4169E1]"
                              />
                              <span className="text-[11px] font-bold">Core</span>
                            </label>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={inlineForm.isCompulsory !== false ? "compulsory" : "elective"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, isCompulsory: e.target.value === "compulsory" }))}
                              className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                            >
                              <option value="compulsory">Compulsory</option>
                              <option value="elective">Elective</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={inlineForm.isActive !== false ? "active" : "archived"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, isActive: e.target.value === "active" }))}
                              className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
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
                            <td colSpan={8} className="py-2 px-4 text-rose-800 text-[11px] font-semibold flex items-center gap-2">
                              <TriangleAlert className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                              <span>{inlineError}</span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }

                  const isArchived = s.isActive === false;

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-blue-50/20 transition-colors ${isArchived ? "opacity-60 bg-slate-50/50" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{s.name}</p>
                          {isArchived && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {s.code ? (
                          <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {s.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            s.schoolLevel === "SECONDARY"
                              ? "bg-purple-100 text-purple-800"
                              : s.schoolLevel === "ALL"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {s.schoolLevel || "PRIMARY"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-700 font-semibold">{s.category || "General / Core"}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {s.isCore ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Core Requirement
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Standard</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {s.isCompulsory ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            Compulsory
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            Elective
                          </span>
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
                          onClick={() => startInlineEdit(s)}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Direct inline edit"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>

                        <button
                          onClick={() => void toggleArchive(s)}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            isArchived
                              ? "text-emerald-700 hover:bg-emerald-100"
                              : "text-slate-400 hover:text-amber-700 hover:bg-amber-50"
                          }`}
                          title={isArchived ? "Restore to active" : "Archive subject"}
                        >
                          {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => void handleDeleteSubject(s)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete Subject"
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

        {/* Modal: Advanced Subject Dialog */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full border shadow-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {isBatchMode ? "Batch Multi-Subject Curriculum Entry" : "Register Academic Subject"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setIsBatchMode(false)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isBatchMode ? "bg-white text-blue-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Single Subject
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchMode(true)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isBatchMode ? "bg-white text-blue-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Multi-Line Batch
                </button>
              </div>

              <form onSubmit={handleSaveModalSubject} className="space-y-4 text-xs">
                {!isBatchMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-800 mb-1">Subject Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Further Mathematics"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Subject Code</label>
                      <input
                        type="text"
                        placeholder="e.g. MTH 201"
                        value={subjectCode}
                        onChange={(e) => setSubjectCode(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">School Level</label>
                      <select
                        value={schoolLevel}
                        onChange={(e) => setSchoolLevel(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                      >
                        <option value="PRIMARY">Primary School (RCA)</option>
                        <option value="SECONDARY">Secondary School (RCHS)</option>
                        <option value="ALL">Cross-Section (All)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-800 mb-1">Department</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Enter Subject Titles (One per line) *
                      </label>
                      <textarea
                        required
                        rows={5}
                        placeholder={"General Mathematics\nEnglish Language\nBiology\nChemistry\nPhysics"}
                        value={batchNamesText}
                        onChange={(e) => setBatchNamesText(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono leading-relaxed"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">School Level</label>
                        <select
                          value={schoolLevel}
                          onChange={(e) => setSchoolLevel(e.target.value as any)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                        >
                          <option value="PRIMARY">Primary School (RCA)</option>
                          <option value="SECONDARY">Secondary School (RCHS)</option>
                          <option value="ALL">Cross-Section (All)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Department</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Class Assignment */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">Assign to Classes</p>
                      <p className="text-[10px] text-slate-500">
                        {selectedClasses.length === 0
                          ? `Every arm the school runs (${armNames.length} on file)`
                          : `${selectedClasses.length} of ${armNames.length} arms selected`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={selectEveryArm}
                        className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 hover:bg-blue-200 rounded cursor-pointer"
                      >
                        Every arm
                      </button>
                      <button
                        type="button"
                        onClick={selectPrimary}
                        className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded cursor-pointer"
                      >
                        Primary
                      </button>
                      <button
                        type="button"
                        onClick={selectJSS}
                        className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 hover:bg-teal-200 rounded cursor-pointer"
                      >
                        JSS
                      </button>
                      <button
                        type="button"
                        onClick={selectSSS}
                        className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 hover:bg-purple-200 rounded cursor-pointer"
                      >
                        SSS
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 max-h-36 overflow-y-auto">
                    {armNames.map((cls) => {
                      const isSelected = selectedClasses.includes(cls);
                      return (
                        <button
                          type="button"
                          key={cls}
                          onClick={() => toggleClass(cls)}
                          className={`flex items-center gap-1.5 p-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-700 font-bold"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-medium"
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                          ) : (
                            <Square className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                          )}
                          <span className="truncate text-[11px]">{cls}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isCompulsory}
                      onChange={(e) => setIsCompulsory(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Compulsory Subject</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800">
                    <input
                      type="checkbox"
                      checked={isCore}
                      onChange={(e) => setIsCore(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Core Promotion Condition Rule</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-[#4169E1] hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? "Saving…" : "Save to Catalog"}
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
