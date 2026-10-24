"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO, ALL_SCHOOL_SECTIONS } from "@/lib/constants";
import { useRealtimeSubjects, SubjectRecord } from "@/lib/realtime-store";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Layers,
  Sparkles,
  Upload,
  Download,
  CheckSquare,
  Square,
  FileText,
  AlertCircle,
  Tag,
} from "lucide-react";

// Master flat list of all official school classes
const ALL_CLASSES = [
  "Pre-Play Class",
  "Play Class",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SS 1",
  "SS 2",
  "SS 3",
];

const CATEGORIES = [
  "General / Core",
  "Early Childhood / Montessori",
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
];

export default function SetupSubjectsPage() {
  const { subjects, addSubject, bulkAddSubjects, deleteSubject, clearAllSubjects } = useRealtimeSubjects();

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for Single / Batch Add
  const [subjectName, setSubjectName] = useState("");
  const [batchNamesText, setBatchNamesText] = useState("");
  const [subjectCode, setSubjectCode] = useState(""); // Optional!
  const [category, setCategory] = useState("General / Core");
  const [creditUnits, setCreditUnits] = useState(3);
  const [isCompulsory, setIsCompulsory] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([...ALL_CLASSES]); // Default: All classes!

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to toggle a single class
  const toggleClass = (cls: string) => {
    if (selectedClasses.includes(cls)) {
      setSelectedClasses(selectedClasses.filter((c) => c !== cls));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  // Preset Selectors
  const selectAllClasses = () => setSelectedClasses([...ALL_CLASSES]);
  const clearAllClassSelections = () => setSelectedClasses([]);
  const selectEarlyYears = () => setSelectedClasses(["Pre-Play Class", "Play Class"]);
  const selectNursery = () => setSelectedClasses(["Nursery 1", "Nursery 2"]);
  const selectPrimary = () => setSelectedClasses(["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"]);
  const selectJSS = () => setSelectedClasses(["JSS 1", "JSS 2", "JSS 3"]);
  const selectSSS = () => setSelectedClasses(["SS 1", "SS 2", "SS 3"]);

  // Submit Handler
  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedClasses.length === 0) {
      alert("Please select at least one class for this subject.");
      return;
    }

    if (isBatchMode) {
      const names = batchNamesText
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (names.length === 0) {
        alert("Please enter at least one subject title.");
        return;
      }

      const newBatch = names.map((name) => ({
        name,
        code: undefined, // Code is optional in batch mode
        category,
        applicableClasses: selectedClasses,
        creditUnits,
        isCompulsory,
        assignedTeachersCount: 0,
      }));

      bulkAddSubjects(newBatch);
      showToast(`Successfully added ${names.length} subjects to ${selectedClasses.length} selected classes.`);
    } else {
      if (!subjectName.trim()) {
        alert("Please enter the subject title.");
        return;
      }

      addSubject({
        name: subjectName.trim(),
        code: subjectCode.trim() || undefined,
        category,
        applicableClasses: selectedClasses,
        creditUnits,
        isCompulsory,
        assignedTeachersCount: 0,
      });

      showToast(`Subject "${subjectName.trim()}" added to ${selectedClasses.length} classes.`);
    }

    // Reset Form
    setIsModalOpen(false);
    setSubjectName("");
    setSubjectCode("");
    setBatchNamesText("");
  };

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const headers = ["Subject Title", "Subject Code (Optional)", "Category", "Compulsory (YES/NO)", "Classes (Comma-Separated)"];
    const sampleRow = [
      "Mathematics",
      "MTH 101",
      "Mathematical Sciences",
      "YES",
      `"${ALL_CLASSES.join(";")}"`,
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

        // Parse from line 1
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          if (row.length < 1) continue;
          const name = row[0]?.replace(/^"|"$/g, "").trim();
          if (!name) continue;
          const code = row[1]?.replace(/^"|"$/g, "").trim() || undefined;
          const cat = row[2]?.replace(/^"|"$/g, "").trim() || "General / Core";
          const comp = row[3]?.replace(/^"|"$/g, "").trim().toUpperCase() !== "NO";
          const classesStr = row[4]?.replace(/^"|"$/g, "").trim();
          const parsedClasses = classesStr ? classesStr.split(";").map((c) => c.trim()).filter(Boolean) : [...ALL_CLASSES];

          imported.push({
            name,
            code,
            category: cat,
            isCompulsory: comp,
            applicableClasses: parsedClasses.length > 0 ? parsedClasses : [...ALL_CLASSES],
            creditUnits: 3,
            assignedTeachersCount: 0,
          });
        }

        if (imported.length > 0) {
          bulkAddSubjects(imported);
          showToast(`Imported ${imported.length} subjects from CSV.`);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Filtered list
  const filtered = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;

    const matchesClass =
      classFilter === "all" ||
      s.applicableClasses.includes(classFilter) ||
      s.applicableClasses.length === ALL_CLASSES.length;

    return matchesSearch && matchesCategory && matchesClass;
  });

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
              <span className="text-slate-800 font-semibold">Subjects</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Curriculum Subjects Setup
              </h1>
              <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                Pre-Play to Primary 5 &amp; Secondary
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Easily register and assign subjects to one, several, or all school classes seamlessly. Subject codes are optional.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Template
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Import CSV
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
                setSelectedClasses([...ALL_CLASSES]);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search subject title or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Filter by Target Class */}
            <div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">🎓 All School Classes ({ALL_CLASSES.length} Classes)</option>
                {ALL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Category */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">📁 All Categories / Departments</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Subjects Table or Empty State */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-800">Curriculum Subjects Catalogue</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
                {filtered.length} Subjects Active
              </span>
              {subjects.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to clear all registered subjects?")) {
                      clearAllSubjects();
                      showToast("All subjects cleared.");
                    }
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {subjects.length === 0 ? (
            /* Clean Empty State */
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-extrabold text-slate-900">No Subjects Registered Yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Get started by adding subjects for your classes. You can add subjects individually, enter multiple subjects at once, or import via CSV.
                </p>
              </div>
              <div className="flex justify-center gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setIsBatchMode(false);
                    setSelectedClasses([...ALL_CLASSES]);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add First Subject
                </button>
                <button
                  onClick={() => {
                    setIsBatchMode(true);
                    setSelectedClasses([...ALL_CLASSES]);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-blue-600" />
                  Batch Add Multiple
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4">Subject Title</th>
                    <th className="py-3 px-3">Code (Optional)</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Assigned Classes</th>
                    <th className="py-3 px-3 text-center">Type</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => {
                    const isAllClasses = s.applicableClasses.length === ALL_CLASSES.length;
                    return (
                      <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{s.name}</p>
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
                          <span className="text-slate-700 font-semibold">{s.category || "General / Core"}</span>
                        </td>
                        <td className="py-3 px-3">
                          {isAllClasses ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                              All Classes (Pre-Play – SS3)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {s.applicableClasses.slice(0, 3).map((cls) => (
                                <span
                                  key={cls}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  {cls}
                                </span>
                              ))}
                              {s.applicableClasses.length > 3 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  +{s.applicableClasses.length - 3} more
                                </span>
                              )}
                            </div>
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
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Delete subject "${s.name}"?`)) {
                                deleteSubject(s.id);
                                showToast(`Subject "${s.name}" deleted.`);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
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
          )}
        </div>

        {/* Modal: Seamless Subject Addition (Single & Batch Modes) */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full border shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {isBatchMode ? "Batch Add Multiple Subjects" : "Register Academic Subject"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setIsBatchMode(false)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isBatchMode ? "bg-white text-blue-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Single Subject Entry
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchMode(true)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isBatchMode ? "bg-white text-blue-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Batch Multi-Subject Entry
                </button>
              </div>

              <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
                {/* Single Subject Inputs */}
                {!isBatchMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-800 mb-1">
                        Subject Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mathematics, English Language, Basic Science, Rhymes"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Subject Code <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MTH 101, ENG 100 (Optional)"
                        value={subjectCode}
                        onChange={(e) => setSubjectCode(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Category / Department</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                  /* Batch Multi-Subject Inputs */
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Enter Subject Titles (One per line) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        placeholder={"Mathematics\nEnglish Language\nBasic Science & Technology\nQuantitative Reasoning\nVerbal Reasoning\nSocial Studies\nChristian Religious Studies"}
                        value={batchNamesText}
                        onChange={(e) => setBatchNamesText(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Each line will be added as a separate subject and assigned to all selected classes below.
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Category for this batch</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Seamless Class Assignment Section */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">Assign to Classes</p>
                      <p className="text-[10px] text-slate-500">
                        {selectedClasses.length} of {ALL_CLASSES.length} classes selected
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={selectAllClasses}
                        className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 hover:bg-blue-200 rounded cursor-pointer"
                      >
                        All Classes
                      </button>
                      <button
                        type="button"
                        onClick={selectEarlyYears}
                        className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 hover:bg-rose-200 rounded cursor-pointer"
                      >
                        Early Years
                      </button>
                      <button
                        type="button"
                        onClick={selectNursery}
                        className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 rounded cursor-pointer"
                      >
                        Nursery
                      </button>
                      <button
                        type="button"
                        onClick={selectPrimary}
                        className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded cursor-pointer"
                      >
                        Primary 1–5
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
                      <button
                        type="button"
                        onClick={clearAllClassSelections}
                        className="px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Interactive Checkbox Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 max-h-40 overflow-y-auto">
                    {ALL_CLASSES.map((cls) => {
                      const isSelected = selectedClasses.includes(cls);
                      return (
                        <button
                          type="button"
                          key={cls}
                          onClick={() => toggleClass(cls)}
                          className={`flex items-center gap-1.5 p-2 rounded-lg text-left transition-all cursor-pointer border ${
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

                {/* Compulsory Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="compulsoryCheck"
                    checked={isCompulsory}
                    onChange={(e) => setIsCompulsory(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="compulsoryCheck" className="font-semibold text-slate-700 cursor-pointer">
                    Compulsory core subject for assigned classes
                  </label>
                </div>

                {/* Modal Footer */}
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
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    {isBatchMode ? "Save All Subjects" : "Save Subject"}
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
