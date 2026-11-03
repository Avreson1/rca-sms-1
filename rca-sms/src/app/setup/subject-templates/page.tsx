"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeSubjectTemplates,
  SubjectTemplateRecord,
} from "@/lib/realtime-store";
import {
  Layers,
  Plus,
  Search,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Copy,
  Sparkles,
  Trash2,
  Baby,
  GraduationCap,
} from "lucide-react";

export default function SubjectTemplatesPage() {
  const { templates, addTemplate, deleteTemplate, clearAllTemplates } =
    useRealtimeSubjectTemplates();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [department, setDepartment] =
    useState<SubjectTemplateRecord["department"]>("Primary");
  const [targetClass, setTargetClass] = useState("Primary 1 - Primary 5");
  const [subjectListText, setSubjectListText] = useState("");

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subjectListText.trim()) return;

    const parsedSubjects = subjectListText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    addTemplate({
      name: name.trim(),
      department,
      targetClass,
      subjects: parsedSubjects,
      enrolledStudentsCount: 0,
    });

    setIsModalOpen(false);
    setName("");
    setSubjectListText("");
  };

  const handleSeedStandardCurricula = () => {
    const defaultPackages: Omit<SubjectTemplateRecord, "id">[] = [
      {
        name: "Creche & Playgroup Early Development Package",
        department: "Early Years",
        targetClass: "Pre-Play Class & Play Class",
        subjects: [
          "Sensory & Practical Life Skills",
          "Habit Formation & Rhymes",
          "Social Interaction & Gross Motor Play",
          "Early Oral Expression & Storytime",
        ],
        enrolledStudentsCount: 0,
      },
      {
        name: "Nursery 1 & 2 Foundational Phonics Package",
        department: "Nursery",
        targetClass: "Nursery 1 & Nursery 2",
        subjects: [
          "Early Phonics & Reading Readiness",
          "Number Work & Counting",
          "Handwriting & Letter Work",
          "Basic Science & Nature Study",
          "Creative Arts & Colouring",
          "Moral Habits & Rhymes",
        ],
        enrolledStudentsCount: 0,
      },
      {
        name: "Primary 1 - 5 Universal Basic Education Package",
        department: "Primary",
        targetClass: "Primary 1 - Primary 5",
        subjects: [
          "Primary Mathematics",
          "English Language & Grammar",
          "Basic Science & Technology",
          "Quantitative Reasoning",
          "Verbal Reasoning",
          "Social Studies & Civic Education",
          "Agricultural Science",
          "Computer Studies & Coding Basics",
          "Christian Religious Studies",
          "Creative & Cultural Arts",
        ],
        enrolledStudentsCount: 0,
      },
      {
        name: "Junior Secondary Universal Curriculum (BECE Standard)",
        department: "General",
        targetClass: "JSS 1 - JSS 3",
        subjects: [
          "General Mathematics",
          "English Language",
          "Basic Science & Technology",
          "National Values & Civic Education",
          "Information & Communication Technology",
          "Business Studies",
          "Cultural & Creative Arts",
          "Agricultural Science",
          "Christian Religious Studies",
        ],
        enrolledStudentsCount: 0,
      },
      {
        name: "Senior Science Standard Package (WAEC/NECO)",
        department: "Science",
        targetClass: "SS 1 - SS 3",
        subjects: [
          "General Mathematics",
          "English Language",
          "Physics",
          "Chemistry",
          "Biology",
          "Information & Communication Technology",
          "Civic Education",
          "Data Processing",
          "Economics",
        ],
        enrolledStudentsCount: 0,
      },
      {
        name: "Senior Arts & Humanities Package (WAEC/NECO)",
        department: "Arts",
        targetClass: "SS 1 - SS 3",
        subjects: [
          "General Mathematics",
          "English Language",
          "Literature in English",
          "Government",
          "Christian Religious Studies (CRS)",
          "Civic Education",
          "Biology",
          "Information & Communication Technology",
        ],
        enrolledStudentsCount: 0,
      },
      {
        name: "Senior Commercial & Business Package (WAEC/NECO)",
        department: "Commercial",
        targetClass: "SS 1 - SS 3",
        subjects: [
          "General Mathematics",
          "English Language",
          "Financial Accounting",
          "Commerce",
          "Economics",
          "Civic Education",
          "Information & Communication Technology",
          "Data Processing",
        ],
        enrolledStudentsCount: 0,
      },
    ];

    defaultPackages.forEach((pkg) => addTemplate(pkg));
  };

  const filtered = templates.filter((t) => {
    const matchesDept = deptFilter === "all" || t.department === deptFilter;
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.targetClass.toLowerCase().includes(search.toLowerCase()) ||
      t.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    return matchesDept && matchesSearch;
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
              <span className="text-slate-800 font-semibold">Subject Templates</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Curriculum &amp; Subject Packages
              </h1>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                Pre-Play to SS 3 Single Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Build dynamic curriculum packages for **Pre-Play, Play, Nursery 1-2, Primary 1-5, JSS, and SSS** for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {templates.length === 0 && (
              <button
                onClick={handleSeedStandardCurricula}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Populate Nigerian Standard Packages
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Custom Package
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "all", label: "All Tiers" },
              { id: "Early Years", label: "Early Years / Play" },
              { id: "Nursery", label: "Nursery 1 & 2" },
              { id: "Primary", label: "Primary 1 - 5" },
              { id: "General", label: "Junior Secondary (JSS)" },
              { id: "Science", label: "Senior Science" },
              { id: "Arts", label: "Senior Arts" },
              { id: "Commercial", label: "Senior Commercial" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDeptFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  deptFilter === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search packages or subjects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Template Cards Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
            <div className="text-sm font-semibold text-slate-600">No Subject Packages Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No packages match your search or filter. Create a custom package or click &apos;Populate Nigerian Standard Packages&apos;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        tpl.department === "Early Years"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : tpl.department === "Nursery"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : tpl.department === "Primary"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : tpl.department === "Science"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : tpl.department === "Arts"
                          ? "bg-purple-50 text-purple-800 border-purple-200"
                          : "bg-indigo-50 text-indigo-800 border-indigo-200"
                      }`}
                    >
                      {tpl.department}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">{tpl.targetClass}</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-tight">{tpl.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{tpl.subjects.length} Bundled Subjects</p>
                  </div>

                  {/* Subject Badges */}
                  <div className="flex flex-wrap gap-1 pt-1 max-h-36 overflow-y-auto">
                    {tpl.subjects.map((sub, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">Ready for Class Assignment</span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${tpl.name}?`)) {
                        deleteTemplate(tpl.id);
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    title="Delete package"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Template */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Create Classroom Subject Package
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTemplate} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Package Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary 3 Core Curriculum, Nursery 1 Package, SS 2 Science"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tier / Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      <option value="Early Years">Creche &amp; Playgroup</option>
                      <option value="Nursery">Nursery School (1 &amp; 2)</option>
                      <option value="Primary">Basic Primary (1 - 5)</option>
                      <option value="General">Junior Secondary (JSS 1-3)</option>
                      <option value="Science">Senior Science (SS 1-3)</option>
                      <option value="Arts">Senior Arts (SS 1-3)</option>
                      <option value="Commercial">Senior Commercial (SS 1-3)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Class Level</label>
                    <select
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      <option value="Pre-Play Class">Pre-Play Class</option>
                      <option value="Play Class">Play Class</option>
                      <option value="Nursery 1">Nursery 1</option>
                      <option value="Nursery 2">Nursery 2</option>
                      <option value="Primary 1">Primary 1</option>
                      <option value="Primary 2">Primary 2</option>
                      <option value="Primary 3">Primary 3</option>
                      <option value="Primary 4">Primary 4</option>
                      <option value="Primary 5">Primary 5</option>
                      <option value="Primary 1 - Primary 5">Primary 1 - Primary 5 (All)</option>
                      <option value="JSS 1 - JSS 3">JSS 1 - JSS 3</option>
                      <option value="SS 1 - SS 3">SS 1 - SS 3</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Subject List (One per line)
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder={"Primary Mathematics\nEnglish Language\nBasic Science\nQuantitative Reasoning\nVerbal Reasoning"}
                    value={subjectListText}
                    onChange={(e) => setSubjectListText(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Enter each subject on a separate line.</p>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Save Package
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
