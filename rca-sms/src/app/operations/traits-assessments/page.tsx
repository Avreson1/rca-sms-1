"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeStudents,
  useRealtimeClasses,
  useRealtimeTraits,
  useRealtimePsychomotor,
  useRealtimeAuth,
  PsychomotorRecord,
} from "@/lib/realtime-store";
import {
  Heart,
  Activity,
  ArrowLeft,
  Save,
  CheckCircle2,
  Users,
  Sparkles,
  Calendar,
  Award,
  Search,
  Sliders,
  Printer,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  FileCheck,
} from "lucide-react";

// Standard teacher and principal remark templates for rapid auto-selection
const FORM_TEACHER_REMARKS_PRESETS = [
  "An exceptionally diligent, brilliant, and well-behaved pupil with commendable character.",
  "Very good academic performance and commendable conduct throughout the term.",
  "A dedicated and attentive learner. Capable of even greater heights with sustained focus.",
  "Good effort shown this term. Needs to improve punctuality and class participation.",
  "Satisfactory performance. Encouraged to take studies and homework more seriously.",
  "A quiet and polite pupil. Shows remarkable progress in psychomotor and practical tasks.",
  "Demonstrates high moral integrity, great leadership initiative, and teamwork.",
];

const PRINCIPAL_REMARKS_PRESETS = [
  "Outstanding academic accomplishment and exemplary conduct. Highly commended.",
  "Very good result. Keep up the high standard in the coming term.",
  "Good result with room for improvement. Approved for terminal advancement.",
  "Satisfactory progress. Encouraged to maintain consistency in all subjects.",
  "A promising student. More effort required in analytical and numeracy subjects.",
  "Approved for promotion to the next tier with honors.",
];

export default function TraitsAssessmentsPage() {
  const { students } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const { traits } = useRealtimeTraits();
  const { psychomotorList, savePsychomotorAssessment } = useRealtimePsychomotor();
  const { currentUser } = useRealtimeAuth();

  const currentRole = currentUser?.role || "SUPER_ADMIN";
  const isTeacher = currentRole === "TEACHER";

  const accessibleClasses = useMemo(() => {
    if (isTeacher && currentUser?.assignedClass) {
      return classes.filter((c) => c.name === currentUser.assignedClass || c.name === "Primary 1");
    }
    return classes;
  }, [isTeacher, currentUser, classes]);

  // Filter & Selector State
  const [selectedSession, setSelectedSession] = useState<string>(SCHOOL_INFO.currentSession || "2025/2026");
  const [selectedTerm, setSelectedTerm] = useState<"First Term" | "Second Term" | "Third Term">("First Term");
  const [selectedClass, setSelectedClass] = useState<string>(
    isTeacher && currentUser?.assignedClass ? currentUser.assignedClass : classes[0]?.name || "Primary 1"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Separate traits into Affective and Psychomotor
  const affectiveTraits = useMemo(() => {
    return traits.filter((t) => t.category.toLowerCase().includes("affective"));
  }, [traits]);

  const psychomotorTraits = useMemo(() => {
    return traits.filter((t) => t.category.toLowerCase().includes("psychomotor"));
  }, [traits]);

  // Students in selected class
  const classStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesClass = s.className === selectedClass;
      const matchesSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [students, selectedClass, searchQuery]);

  // Helper to fetch or get default assessment record for a student
  const getStudentAssessment = (studentId: string, admissionNo: string): PsychomotorRecord => {
    const existing = psychomotorList.find(
      (p) => p.studentId === studentId && p.session === selectedSession && p.term === selectedTerm
    );

    if (existing) return existing;

    const defaultAffective: Record<string, number> = {};
    affectiveTraits.forEach((t) => (defaultAffective[t.id] = 4));

    const defaultPsychomotor: Record<string, number> = {};
    psychomotorTraits.forEach((t) => (defaultPsychomotor[t.id] = 4));

    return {
      id: `psy-${studentId}-${selectedSession}-${selectedTerm}`,
      studentId,
      admissionNo,
      className: selectedClass,
      session: selectedSession,
      term: selectedTerm,
      affectiveRatings: defaultAffective,
      psychomotorRatings: defaultPsychomotor,
      attendance: {
        daysOpened: 115,
        daysPresent: 112,
        daysAbsent: 3,
      },
      formTeacherRemark: FORM_TEACHER_REMARKS_PRESETS[0],
      principalRemark: PRINCIPAL_REMARKS_PRESETS[0],
      nextTermBegins: "2026-01-12",
    };
  };

  // Handle single trait change
  const handleTraitScoreChange = (
    studentId: string,
    admissionNo: string,
    traitCategory: "affective" | "psychomotor",
    traitId: string,
    score: number
  ) => {
    const current = getStudentAssessment(studentId, admissionNo);
    const updated = {
      ...current,
      [traitCategory === "affective" ? "affectiveRatings" : "psychomotorRatings"]: {
        ...(traitCategory === "affective" ? current.affectiveRatings : current.psychomotorRatings),
        [traitId]: score,
      },
    };
    savePsychomotorAssessment(updated);
    showTempSaved("Rating updated");
  };

  // Handle attendance change
  const handleAttendanceChange = (
    studentId: string,
    admissionNo: string,
    field: "daysOpened" | "daysPresent",
    val: number
  ) => {
    const current = getStudentAssessment(studentId, admissionNo);
    const opened = field === "daysOpened" ? Math.max(0, val) : current.attendance.daysOpened;
    const present = field === "daysPresent" ? Math.max(0, Math.min(val, opened)) : current.attendance.daysPresent;
    const absent = Math.max(0, opened - present);

    const updated = {
      ...current,
      attendance: {
        daysOpened: opened,
        daysPresent: present,
        daysAbsent: absent,
      },
    };
    savePsychomotorAssessment(updated);
    showTempSaved("Attendance updated");
  };

  // Handle remarks change
  const handleRemarkChange = (
    studentId: string,
    admissionNo: string,
    field: "formTeacherRemark" | "principalRemark" | "nextTermBegins",
    value: string
  ) => {
    const current = getStudentAssessment(studentId, admissionNo);
    const updated = {
      ...current,
      [field]: value,
    };
    savePsychomotorAssessment(updated);
    showTempSaved("Remark saved");
  };

  // Quick Batch Fill for All Students in Selected Class
  const handleBatchPreset = (ratingValue: number) => {
    if (classStudents.length === 0) return;

    classStudents.forEach((student) => {
      const current = getStudentAssessment(student.id, student.admissionNo);
      const newAffective: Record<string, number> = {};
      affectiveTraits.forEach((t) => (newAffective[t.id] = ratingValue));

      const newPsychomotor: Record<string, number> = {};
      psychomotorTraits.forEach((t) => (newPsychomotor[t.id] = ratingValue));

      savePsychomotorAssessment({
        ...current,
        affectiveRatings: newAffective,
        psychomotorRatings: newPsychomotor,
      });
    });

    showTempSaved(`All students in ${selectedClass} set to rating ${ratingValue}!`);
  };

  const showTempSaved = (msg: string) => {
    setSaveMessage(msg);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Psychomotor Engine</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Affective &amp; Psychomotor Assessment Engine
              </h1>
              <span className="bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Heart className="w-3 h-3 text-purple-600" />
                Live Scorecard Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluate student behavioral character, dexterity skills, attendance, and form teacher remarks for terminal scorecards.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/setup/traits"
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Sliders className="w-4 h-4 text-purple-600" />
              Configure Traits
            </Link>

            <Link
              href="/operations/score-card"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Preview Terminal Score Cards →
            </Link>
          </div>
        </div>

        {/* Saved Alert Toast */}
        {isSaved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{saveMessage || "Assessments updated and synchronized with official Score Cards."}</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-mono">Auto-saved to store</span>
          </div>
        )}

        {/* Global Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="2025/2026">2025/2026 Academic Session</option>
              <option value="2024/2025">2024/2025 Academic Session</option>
              <option value="2026/2027">2026/2027 Academic Session</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Terminal Period
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value as any)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term (Promotion Term)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Class Arm
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden"
            >
              {accessibleClasses.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.section})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Quick Batch Toolbar & Rating Scale Guide */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Rating Scale Keys (Standard 5-Point System)
            </h3>
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded font-semibold">5 = Excellent / Exemplary</span>
              <span className="bg-blue-950/80 text-blue-300 border border-blue-700/60 px-2 py-0.5 rounded font-semibold">4 = Very Good / Proficient</span>
              <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded font-semibold">3 = Good / Satisfactory</span>
              <span className="bg-amber-950/80 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded font-semibold">2 = Fair / Developing</span>
              <span className="bg-rose-950/80 text-rose-300 border border-rose-700/60 px-2 py-0.5 rounded font-semibold">1 = Poor / Needs Support</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <span className="text-xs text-slate-400 font-semibold">Quick Batch:</span>
            <button
              type="button"
              onClick={() => handleBatchPreset(5)}
              className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
              title="Set all students in this class to 5 (Excellent)"
            >
              All 5 (Excellent)
            </button>
            <button
              type="button"
              onClick={() => handleBatchPreset(4)}
              className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
              title="Set all students in this class to 4 (Very Good)"
            >
              All 4 (Very Good)
            </button>
          </div>
        </div>

        {/* Student Assessment Cards / Accordion */}
        {classStudents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">No Students Enrolled in {selectedClass}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no students registered in this class tier. Add students or import a class roster from the Students directory.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/operations/students"
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs"
              >
                Go to Students Registry →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Showing {classStudents.length} Students in <strong>{selectedClass}</strong></span>
              <button
                type="button"
                onClick={() => setExpandedStudentId(expandedStudentId ? null : classStudents[0]?.id)}
                className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                {expandedStudentId ? "Collapse All" : "Expand First Student"}
              </button>
            </div>

            {classStudents.map((student, idx) => {
              const assessment = getStudentAssessment(student.id, student.admissionNo);
              const isExpanded = expandedStudentId === student.id || (!expandedStudentId && idx === 0);

              // Calculate average affective score
              const affValues = Object.values(assessment.affectiveRatings);
              const affAvg = affValues.length ? (affValues.reduce((a, b) => a + b, 0) / affValues.length).toFixed(1) : "4.0";

              // Calculate average psychomotor score
              const psyValues = Object.values(assessment.psychomotorRatings);
              const psyAvg = psyValues.length ? (psyValues.reduce((a, b) => a + b, 0) / psyValues.length).toFixed(1) : "4.0";

              return (
                <div
                  key={student.id}
                  className={`bg-white border rounded-2xl shadow-xs transition-all overflow-hidden ${
                    isExpanded ? "border-blue-300 ring-2 ring-blue-500/10" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Student Accordion Header */}
                  <div
                    onClick={() => setExpandedStudentId(isExpanded ? "" : student.id)}
                    className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                        {student.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900 truncate">{student.fullName}</h3>
                          <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                            {student.admissionNo}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {student.gender} • House: <strong className="text-slate-700">{student.house}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="hidden sm:flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Affective: {affAvg} / 5
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Psychomotor: {psyAvg} / 5
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Att: {assessment.attendance.daysPresent}/{assessment.attendance.daysOpened}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Evaluation Body */}
                  {isExpanded && (
                    <div className="p-5 md:p-6 space-y-6">
                      
                      {/* 2-Column Traits Grid (Affective vs Psychomotor) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Column 1: Affective Domain */}
                        <div className="bg-slate-50/50 border border-purple-100 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                            <h4 className="font-extrabold text-xs text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                              <Heart className="w-3.5 h-3.5 text-purple-600" />
                              Affective (Behavioral &amp; Character Domain)
                            </h4>
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                              Avg: {affAvg} / 5
                            </span>
                          </div>

                          <div className="space-y-2.5 divide-y divide-slate-100 text-xs">
                            {affectiveTraits.map((t) => {
                              const score = assessment.affectiveRatings[t.id] ?? 4;
                              return (
                                <div key={t.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-[11px] truncate">{t.name}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{t.description}</p>
                                  </div>

                                  {/* 1-5 Score Selector Buttons */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {[1, 2, 3, 4, 5].map((val) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleTraitScoreChange(student.id, student.admissionNo, "affective", t.id, val)}
                                        className={`w-6 h-6 rounded-md font-extrabold text-xs transition-all cursor-pointer ${
                                          score === val
                                            ? val === 5
                                              ? "bg-emerald-600 text-white shadow-xs scale-105"
                                              : val === 4
                                              ? "bg-blue-600 text-white shadow-xs scale-105"
                                              : val === 3
                                              ? "bg-indigo-600 text-white shadow-xs scale-105"
                                              : val === 2
                                              ? "bg-amber-600 text-white shadow-xs scale-105"
                                              : "bg-rose-600 text-white shadow-xs scale-105"
                                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Column 2: Psychomotor Domain */}
                        <div className="bg-slate-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                            <h4 className="font-extrabold text-xs text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-blue-600" />
                              Psychomotor (Skills &amp; Dexterity Domain)
                            </h4>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                              Avg: {psyAvg} / 5
                            </span>
                          </div>

                          <div className="space-y-2.5 divide-y divide-slate-100 text-xs">
                            {psychomotorTraits.map((t) => {
                              const score = assessment.psychomotorRatings[t.id] ?? 4;
                              return (
                                <div key={t.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-[11px] truncate">{t.name}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{t.description}</p>
                                  </div>

                                  {/* 1-5 Score Selector Buttons */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {[1, 2, 3, 4, 5].map((val) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => handleTraitScoreChange(student.id, student.admissionNo, "psychomotor", t.id, val)}
                                        className={`w-6 h-6 rounded-md font-extrabold text-xs transition-all cursor-pointer ${
                                          score === val
                                            ? val === 5
                                              ? "bg-emerald-600 text-white shadow-xs scale-105"
                                              : val === 4
                                              ? "bg-blue-600 text-white shadow-xs scale-105"
                                              : val === 3
                                              ? "bg-indigo-600 text-white shadow-xs scale-105"
                                              : val === 2
                                              ? "bg-amber-600 text-white shadow-xs scale-105"
                                              : "bg-rose-600 text-white shadow-xs scale-105"
                                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>

                      {/* Attendance & Next Term Schedule */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Days School Opened
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="200"
                            value={assessment.attendance.daysOpened}
                            onChange={(e) => handleAttendanceChange(student.id, student.admissionNo, "daysOpened", parseInt(e.target.value, 10) || 0)}
                            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Days Present
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={assessment.attendance.daysOpened}
                            value={assessment.attendance.daysPresent}
                            onChange={(e) => handleAttendanceChange(student.id, student.admissionNo, "daysPresent", parseInt(e.target.value, 10) || 0)}
                            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2 text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Days Absent
                          </label>
                          <div className="w-full text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg p-2 text-amber-700">
                            {assessment.attendance.daysAbsent} Days
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Next Term Resumption
                          </label>
                          <input
                            type="date"
                            value={assessment.nextTermBegins || "2026-01-12"}
                            onChange={(e) => handleRemarkChange(student.id, student.admissionNo, "nextTermBegins", e.target.value)}
                            className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Form Master & Principal Remarks Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        
                        {/* Form Teacher Remark */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-700">Form Teacher&apos;s Appraisal Remark</label>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleRemarkChange(student.id, student.admissionNo, "formTeacherRemark", e.target.value);
                                }
                              }}
                              className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer"
                            >
                              <option value="">Choose Preset Remark...</option>
                              {FORM_TEACHER_REMARKS_PRESETS.map((r, i) => (
                                <option key={i} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            rows={2}
                            value={assessment.formTeacherRemark}
                            onChange={(e) => handleRemarkChange(student.id, student.admissionNo, "formTeacherRemark", e.target.value)}
                            placeholder="Enter form master appraisal remark..."
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                          />
                        </div>

                        {/* Principal Endorsement */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-700">Principal / Head of School Endorsement</label>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleRemarkChange(student.id, student.admissionNo, "principalRemark", e.target.value);
                                }
                              }}
                              className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 cursor-pointer"
                            >
                              <option value="">Choose Preset Endorsement...</option>
                              {PRINCIPAL_REMARKS_PRESETS.map((r, i) => (
                                <option key={i} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            rows={2}
                            value={assessment.principalRemark}
                            onChange={(e) => handleRemarkChange(student.id, student.admissionNo, "principalRemark", e.target.value)}
                            placeholder="Enter principal official endorsement remark..."
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                          />
                        </div>

                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
