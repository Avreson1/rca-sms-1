"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeClasses,
  useRealtimeStudents,
  useRealtimeStaff,
  ClassArmRecord,
} from "@/lib/realtime-store";
import {
  School,
  Plus,
  Users,
  BookOpen,
  ArrowLeft,
  Search,
  CheckCircle2,
  Trash2,
  Filter,
  Edit2,
} from "lucide-react";

export default function SetupClassesPage() {
  const { classes, addClass, deleteClass, updateClass } = useRealtimeClasses();
  const { students } = useRealtimeStudents();
  const { staff } = useRealtimeStaff();

  const [sectionFilter, setSectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassSection, setNewClassSection] = useState<ClassArmRecord["section"]>("Basic Primary");
  const [newClassTeacher, setNewClassTeacher] = useState("");
  const [newClassCapacity, setNewClassCapacity] = useState<number>(0);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    addClass({
      name: newClassName.trim(),
      section: newClassSection,
      formTeacher: newClassTeacher.trim() || "Unassigned",
      formTeacherId: "RCA/PERS/NEW",
      studentsCount: 0,
      capacity: newClassCapacity >= 0 ? newClassCapacity : 0,
    });

    setIsModalOpen(false);
    setNewClassName("");
    setNewClassTeacher("");
    setNewClassCapacity(0);
  };

  const filtered = classes.filter((c) => {
    const matchesSection = sectionFilter === "all" || c.section === sectionFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.formTeacher.toLowerCase().includes(search.toLowerCase());
    return matchesSection && matchesSearch;
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
              <span className="text-slate-800 font-semibold">Classes</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Class Arms &amp; Form Master Roster
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configured with single stream secondary tiers (JSS 1-3, SS 1-3), primary (1-5), nursery (1-2), and pre-play for {SCHOOL_INFO.name}.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Class Arm
          </button>
        </div>

        {/* Section Tabs */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {["all", "Creche & Playgroup", "Nursery School", "Basic Primary", "Junior Secondary", "Senior Secondary"].map(
              (sec) => (
                <button
                  key={sec}
                  onClick={() => setSectionFilter(sec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sectionFilter === sec
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {sec === "all" ? "All Class Arms" : sec}
                </button>
              )
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search class or teacher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Class Arms Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Class Arm Directory</h3>
            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
              {filtered.length} Classes Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Class Arm</th>
                  <th className="py-3 px-4">Section Tier</th>
                  <th className="py-3 px-4">Assigned Form Master</th>
                  <th className="py-3 px-3 text-center">Enrolled Pupils</th>
                  <th className="py-3 px-3 text-center">Room Capacity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const enrolledCount = students.filter((s) => s.className === c.name).length;
                  return (
                    <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3 px-4 font-extrabold text-blue-900 text-sm">{c.name}</td>
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
                          {enrolledCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 font-mono">
                        {c.capacity === 0 ? (
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                            Dynamic ({enrolledCount})
                          </span>
                        ) : (
                          <span>{c.capacity}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                        <Link
                          href="/operations/score-card"
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px]"
                        >
                          Score Cards
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(`Delete class arm ${c.name}?`)) {
                              deleteClass(c.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
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

        {/* Modal: Add Class Arm */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <School className="w-4 h-4 text-blue-600" />
                  Add New Class Arm
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddClass} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pre-Play Class, Play Class, Nursery 1, Primary 5, JSS 1, SS 1"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Educational Section</label>
                  <select
                    value={newClassSection}
                    onChange={(e) => setNewClassSection(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Creche & Playgroup">Creche & Playgroup (Pre-Play &amp; Play)</option>
                    <option value="Nursery School">Nursery School (Nursery 1 &amp; 2)</option>
                    <option value="Basic Primary">Basic Primary (Primary 1 - 5)</option>
                    <option value="Junior Secondary">Junior Secondary (JSS 1 - 3)</option>
                    <option value="Senior Secondary">Senior Secondary (SS 1 - 3)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Form Teacher / Master Name</label>
                  <select
                    value={newClassTeacher}
                    onChange={(e) => setNewClassTeacher(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Unassigned">-- Select or Assign Teacher --</option>
                    <option value="Dominic Mark">Dominic Mark (Super Admin)</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.fullName}>
                        {st.fullName} ({st.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Room Capacity (Set 0 for Dynamic Onboarding Capacity)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={newClassCapacity}
                    onChange={(e) => setNewClassCapacity(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Default 0 allows unrestricted dynamic onboarding relative to actual enrolled students.
                  </p>
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
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Save Class
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
