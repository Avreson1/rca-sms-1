"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO, ROLES } from "@/lib/constants";
import {
  useRealtimeStaff,
  useRealtimeClasses,
  useRealtimeTimetable,
  useRealtimeAuth,
  useRealtimeSubjects,
} from "@/lib/realtime-store";
import {
  GraduationCap,
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  Layers,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function OperationsAcademicsPage() {
  const { staff } = useRealtimeStaff();
  const { classes } = useRealtimeClasses();
  const { subjects } = useRealtimeSubjects();
  const { timetable, addEntry, removeEntry, clearClassTimetable } = useRealtimeTimetable();
  const { currentUser } = useRealtimeAuth();

  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || "Primary 1");
  const [activeTab, setActiveTab] = useState<"class" | "master" | "workload">("class");

  // Modal State for Adding Timetable Period Entry
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [dayInput, setDayInput] = useState<"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday">("Monday");
  const [periodIdxInput, setPeriodIdxInput] = useState<number>(0);
  const [subjectInput, setSubjectInput] = useState<string>("");
  const [teacherInput, setTeacherInput] = useState<string>("");
  const [roomInput, setRoomInput] = useState<string>("");

  const isSuperOrExamOfficer =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  const standardPeriods = [
    { index: 0, label: "Period 1 (08:00 - 08:45 AM)" },
    { index: 1, label: "Period 2 (08:45 - 09:30 AM)" },
    { index: -1, label: "Short Break (09:30 - 10:00 AM)", isBreak: true },
    { index: 2, label: "Period 3 (10:00 - 10:45 AM)" },
    { index: 3, label: "Period 4 (10:45 - 11:30 AM)" },
    { index: -2, label: "Long Break & Lunch (11:30 - 12:15 PM)", isBreak: true },
    { index: 4, label: "Period 5 (12:15 - 01:00 PM)" },
    { index: 5, label: "Period 6 (01:00 - 01:45 PM)" },
  ];

  const days: ("Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday")[] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ];

  // Filter entries for selected class
  const classEntries = timetable.filter((t) => t.className === selectedClass);

  const getEntryForSlot = (day: string, periodIndex: number) => {
    return classEntries.find((e) => e.day === day && e.periodIndex === periodIndex);
  };

  const handleOpenAddModal = (day?: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday", periodIndex?: number) => {
    if (day) setDayInput(day);
    if (periodIndex !== undefined) setPeriodIdxInput(periodIndex);
    setSubjectInput(subjects[0]?.name || "General Mathematics");
    setTeacherInput(staff[0]?.fullName || "Unassigned");
    setRoomInput(selectedClass);
    setIsAddModalOpen(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectInput.trim()) return;

    const periodObj = standardPeriods.find((p) => p.index === periodIdxInput);
    addEntry({
      className: selectedClass,
      day: dayInput,
      periodIndex: periodIdxInput,
      periodLabel: periodObj?.label || `Period ${periodIdxInput + 1}`,
      subject: subjectInput.trim(),
      teacherName: teacherInput.trim() || "Unassigned",
      room: roomInput.trim() || selectedClass,
    });

    setIsAddModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Compute live workload metrics per staff member from timetable + assigned subjects
  const staffWorkload = staff.map((s) => {
    const scheduledPeriods = timetable.filter(
      (t) => t.teacherName.toLowerCase() === s.fullName.toLowerCase() || (t.teacherId && t.teacherId === s.staffId)
    ).length;

    return {
      staffMember: s,
      assignedSubjectsCount: s.assignedSubjects.length,
      scheduledPeriodsCount: scheduledPeriods,
      formClass: s.assignedClass || "None",
    };
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Academics &amp; Timetable</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Academic Operations &amp; Master Timetable
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live curriculum schedules, faculty workloads, and institutional class timetables for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              Print Schedule
            </button>
            {isSuperOrExamOfficer && (
              <button
                onClick={() => handleOpenAddModal()}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Schedule Class Period
              </button>
            )}
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
          <button
            onClick={() => setActiveTab("class")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "class"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Class Arm Timetable ({classEntries.length} Scheduled)
          </button>
          {isSuperOrExamOfficer && (
            <button
              onClick={() => setActiveTab("master")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "master"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              🏛️ Master Institutional Schedule ({timetable.length} Total)
            </button>
          )}
          <button
            onClick={() => setActiveTab("workload")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "workload"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Faculty Workload Matrix ({staff.length} Instructors)
          </button>
        </div>

        {/* Tab 1: Class Arm Timetable */}
        {activeTab === "class" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-xl shadow-xs print:hidden">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">Select Class Arm:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-blue-900 outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.section})
                    </option>
                  ))}
                </select>

                {isSuperOrExamOfficer && classEntries.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Clear all scheduled periods for ${selectedClass}?`)) {
                        clearClassTimetable(selectedClass);
                      }
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Class Schedule
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500">
                Session: <strong className="text-slate-800">{SCHOOL_INFO.currentSession}</strong> • Term:{" "}
                <strong className="text-blue-700">{SCHOOL_INFO.currentTerm}</strong>
              </div>
            </div>

            {/* Printable Class Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    Official Timetable: {selectedClass}
                  </h3>
                  <p className="text-[11px] text-slate-500">{SCHOOL_INFO.name} • Academic Year {SCHOOL_INFO.currentSession}</p>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {classEntries.length} Active Slots
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-3 px-4 w-48">Period / Time</th>
                      {days.map((day) => (
                        <th key={day} className="py-3 px-3">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {standardPeriods.map((p, pIdx) => {
                      if (p.isBreak) {
                        return (
                          <tr key={pIdx} className="bg-amber-50/50 font-semibold text-amber-900 text-center">
                            <td className="py-2.5 px-4 font-mono text-left">{p.label}</td>
                            <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-amber-800">
                              Intermission / Break
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={pIdx} className="hover:bg-blue-50/20">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-600">{p.label}</td>
                          {days.map((day) => {
                            const entry = getEntryForSlot(day, p.index);
                            return (
                              <td key={day} className="py-2.5 px-3">
                                {entry ? (
                                  <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-200/80 space-y-0.5 relative group">
                                    <p className="font-bold text-blue-950 text-xs">{entry.subject}</p>
                                    <p className="text-[10px] text-slate-600 font-medium">{entry.teacherName}</p>
                                    {isSuperOrExamOfficer && (
                                      <button
                                        onClick={() => removeEntry(entry.id)}
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-rose-600 hover:text-rose-800 transition-opacity"
                                        title="Remove period"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ) : isSuperOrExamOfficer ? (
                                  <button
                                    onClick={() => handleOpenAddModal(day, p.index)}
                                    className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Assign</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300 font-mono text-[11px]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {classEntries.length === 0 && (
                <div className="p-8 text-center bg-slate-50/50 border-t border-slate-100">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No Timetable Periods Configured for {selectedClass}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isSuperOrExamOfficer
                      ? "Click on any empty slot or use the Schedule Class Period button above to build this class schedule."
                      : "The academic schedule for this class has not been published yet."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Master Institutional Schedule (Super Admin & Exam Officer) */}
        {activeTab === "master" && isSuperOrExamOfficer && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                  Institutional Master Schedule
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Master Allocation Matrix Across All Class Arms
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Universal timetable view across Creche, Nursery, Primary 1-5, JSS 1-3, and SS 1-3 for {SCHOOL_INFO.name}.
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Master Matrix
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-3 px-4">Class Arm</th>
                      <th className="py-3 px-3">Section Tier</th>
                      <th className="py-3 px-3">Assigned Form Master</th>
                      <th className="py-3 px-3 text-center">Scheduled Periods</th>
                      <th className="py-3 px-3">Primary Subjects Scheduled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((c) => {
                      const cEntries = timetable.filter((t) => t.className === c.name);
                      const uniqueSubjects = Array.from(new Set(cEntries.map((e) => e.subject)));

                      return (
                        <tr key={c.id} className="hover:bg-blue-50/20">
                          <td className="py-3 px-4 font-bold text-blue-900">{c.name}</td>
                          <td className="py-3 px-3 text-slate-600">{c.section}</td>
                          <td className="py-3 px-3 font-medium text-slate-800">{c.formTeacher}</td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                              cEntries.length > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                            }`}>
                              {cEntries.length} Periods
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {uniqueSubjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {uniqueSubjects.map((sub, i) => (
                                  <span key={i} className="text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">No periods assigned yet</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Faculty Workload Matrix */}
        {activeTab === "workload" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800">
                Staff Workload &amp; Classroom Allocations ({staff.length} Instructors)
              </h3>
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
                {SCHOOL_INFO.currentSession} Session
              </span>
            </div>

            {staff.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <div className="text-sm font-semibold text-slate-600">No Staff Workloads Active</div>
                <p className="text-xs text-slate-400">
                  Onboard staff members in <Link href="/operations/staff" className="text-blue-600 font-bold">Staff Management</Link> to view dynamic workloads.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-3">Role Tier</th>
                      <th className="py-3 px-4">Assigned Subjects</th>
                      <th className="py-3 px-3">Form Class</th>
                      <th className="py-3 px-3 text-center">Scheduled Periods / Wk</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffWorkload.map(({ staffMember: s, scheduledPeriodsCount, formClass }) => (
                      <tr key={s.id} className="hover:bg-blue-50/20">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {s.fullName}
                          <span className="block text-[10px] text-slate-400 font-mono">{s.staffId}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {s.assignedSubjects.length > 0 ? (
                              s.assignedSubjects.map((sub, i) => (
                                <span key={i} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  {sub}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">None assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{formClass}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            scheduledPeriodsCount > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
                          }`}>
                            {scheduledPeriodsCount} Periods
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            scheduledPeriodsCount > 0
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}>
                            {scheduledPeriodsCount > 0 ? "Allocated" : "Awaiting Schedule"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Schedule Class Period */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Schedule Class Period</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  {selectedClass}
                </span>
              </div>

              <form onSubmit={handleSaveEntry} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Weekday</label>
                  <select
                    value={dayInput}
                    onChange={(e) => setDayInput(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Period Slot</label>
                  <select
                    value={periodIdxInput}
                    onChange={(e) => setPeriodIdxInput(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    {standardPeriods.filter((p) => !p.isBreak).map((p) => (
                      <option key={p.index} value={p.index}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Curricular Subject</label>
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="e.g. English Language, Mathematics, ICT"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Instructor / Teacher</label>
                  <select
                    value={teacherInput}
                    onChange={(e) => setTeacherInput(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="Unassigned">Unassigned / Subject Teacher</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.fullName}>
                        {s.fullName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs"
                  >
                    Save Period
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
