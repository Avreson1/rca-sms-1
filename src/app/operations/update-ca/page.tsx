"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeStudents,
  useRealtimeClasses,
  useRealtimeSubjectTemplates,
  useRealtimeGradingScales,
  useRealtimeSubjectScores,
  useRealtimeAuth,
  calculateGradeForClass,
  StudentRecord,
} from "@/lib/realtime-store";
import { ALL_CLASSES } from "@/lib/constants";
import { useSchoolConfig, effectiveScope } from "@/lib/school-config";
import { exportToCSV, parseCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import {
  BookOpen,
  Users,
  Save,
  CheckCircle2,
  Download,
  Upload,
  Search,
  ArrowLeft,
  Filter,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  Cpu,
  Sliders,
  FileDown,
  UserCheck,
} from "lucide-react";

export default function UpdateCAPage() {
  const { students, updateStudentScore, bulkUpdateScores, saveCaScores, overlayFiledScores } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const { templates } = useRealtimeSubjectTemplates();
  const { gradingTiers } = useRealtimeGradingScales();
  const { currentUser } = useRealtimeAuth();

  // The session and term the school says it is in. This screen read one session
  // and filed into another: the grid pulled the marks of a date compiled into the
  // portal while the Save button filed under the school's own record, so a class
  // marked after the office moved into a new session read back empty and the
  // teacher typed the same marks a second time.
  const { config: school } = useSchoolConfig();
  const schoolScope = effectiveScope(school, {
    session: SCHOOL_INFO.currentSession,
    term: SCHOOL_INFO.currentTerm,
  });

  const currentRole = currentUser?.role || "SUPER_ADMIN";
  const isTeacher = currentRole === "TEACHER";

  const allClassesList = classes.length > 0 ? classes.map((c) => c.name) : ALL_CLASSES;
  const availableClasses = useMemo(() => {
    // A teacher marks the arm they are assigned to. "Primary 1" used to be
    // added to every teacher's list here, so a teacher assigned to SS 2 could
    // open and file Primary 1's gradebook too.
    if (isTeacher && currentUser?.assignedClass) {
      return allClassesList.filter((c) => c === currentUser.assignedClass);
    }
    return allClassesList;
  }, [isTeacher, currentUser, allClassesList]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    if (isTeacher && currentUser?.assignedSubject) {
      set.add(currentUser.assignedSubject);
    }
    templates.forEach((t) => t.subjects.forEach((s) => set.add(s)));
    if (set.size === 0) {
      ["Information & Communication Technology", "General Mathematics", "English Language", "Basic Science", "Sensory Development", "Data Processing"].forEach((s) => set.add(s));
    }
    return Array.from(set);
  }, [templates, isTeacher, currentUser]);

  const [selectedClass, setSelectedClass] = useState<string>(
    isTeacher && currentUser?.assignedClass ? currentUser.assignedClass : availableClasses[0] || "Primary 1"
  );
  const [selectedSubject, setSelectedSubject] = useState(
    isTeacher && currentUser?.assignedSubject ? currentUser.assignedSubject : availableSubjects[0] || "Information & Communication Technology"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // The grid shows one subject's marks at a time, so it is filled from the
  // marks filed for this class, session and term. Until that read lands the
  // cells stay blank rather than carrying over whatever this browser held for
  // the previously selected subject, which Save would then file twice over.
  const { subjectScores: filedMarks, filedLoaded } = useRealtimeSubjectScores({
    session: schoolScope.session,
    terms: [schoolScope.term],
    className: selectedClass,
  });

  useEffect(() => {
    if (!filedLoaded) return;
    overlayFiledScores(selectedSubject, selectedClass, filedMarks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filedLoaded, selectedSubject, selectedClass, filedMarks]);

  // CSV Score Upload Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScoreChange = (
    student: StudentRecord,
    field: "test1" | "test2" | "project" | "midTerm" | "exam",
    value: string
  ) => {
    setIsSaved(false);
    setSaveNote(null);
    const num = Math.max(0, parseInt(value, 10) || 0);
    const maxLimits = { test1: 10, test2: 10, project: 10, midTerm: 10, exam: 60 };
    const clamped = Math.min(num, maxLimits[field]);

    const newScores = {
      ...student.caScores,
      [field]: clamped,
    };

    updateStudentScore(student.id, newScores);
  };

  const handleSave = async () => {
    setSaveNote(null);
    const { filed, total, reason } = await saveCaScores(selectedSubject, filteredStudents);
    setIsSaved(filed > 0);
    if (filed > 0) {
      setSaveNote(
        `${filed} ${selectedSubject} score${filed === 1 ? "" : "s"} for ${schoolScope.session}, ${schoolScope.term} are on the school's records.`
      );
    } else {
      setSaveNote(
        total === 0
          ? `No scores are filled in for ${selectedSubject} yet, so there was nothing to send.`
          : `Nothing was filed: ${reason ?? "the school's records did not answer"}. The marks are on this screen only — fix the cause and save again.`
      );
    }
    setTimeout(() => setIsSaved(false), 6000);
  };

  // CSV Upload for Scores
  const handleScoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsedRows = parseCSV(text);

      if (parsedRows.length < 2) {
        setUploadStatus("This file has a header but no score row under it. Use 'CSV Template' to start from the right columns.");
        setCsvPreview([]);
        return;
      }

      // A blank cell is left alone, not read as zero. The parser used to turn an
      // empty column into 0, so a sheet that only carried the examination mark
      // wiped the first and second tests that were already filed for that child.
      const mark = (raw: string | undefined, max: number) => {
        const value = (raw || "").trim();
        if (value === "") return undefined;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return undefined;
        return Math.min(max, Math.max(0, parsed));
      };

      const scoreUpdates: {
        admissionNo: string;
        studentName: string;
        test1?: number;
        test2?: number;
        project?: number;
        midTerm?: number;
        exam?: number;
      }[] = [];
      const skipped: string[] = [];

      parsedRows.slice(1).forEach((cols, idx) => {
        const admissionNo = cols[0]?.trim();
        if (!admissionNo) {
          skipped.push(`row ${idx + 2}: no admission number`);
          return;
        }
        const entry: (typeof scoreUpdates)[number] = {
          admissionNo,
          studentName: cols[1]?.trim() || "",
        };
        const test1 = mark(cols[2], 10);
        const test2 = mark(cols[3], 10);
        const project = mark(cols[4], 10);
        const midTerm = mark(cols[5], 10);
        const exam = mark(cols[6], 60);
        if (test1 !== undefined) entry.test1 = test1;
        if (test2 !== undefined) entry.test2 = test2;
        if (project !== undefined) entry.project = project;
        if (midTerm !== undefined) entry.midTerm = midTerm;
        if (exam !== undefined) entry.exam = exam;
        scoreUpdates.push(entry);
      });

      setCsvPreview(scoreUpdates);
      setUploadStatus(
        skipped.length
          ? `${scoreUpdates.length} score row${scoreUpdates.length === 1 ? "" : "s"} read. Skipped ${skipped.length}: ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? `; +${skipped.length - 3} more` : ""}`
          : `${scoreUpdates.length} score row${scoreUpdates.length === 1 ? "" : "s"} read. Empty cells will be left as they are on the school's records, not filed as zero.`
      );
    };
    reader.readAsText(file);
  };

  const handleConfirmScoreUpload = async () => {
    if (csvPreview.length === 0) return;
    const { filed, unmatched, reason } = await bulkUpdateScores(csvPreview, selectedSubject);
    // The count that reached the school's records is kept separate from the count
    // in the file, and rows naming a child who is not on the roll are said out
    // loud: a file of 40 rows that filed 38 marks used to read as 40 marks filed.
    setUploadStatus(
      `${filed} of ${csvPreview.length} rows in the file are on the school's records for ${selectedSubject}` +
        (unmatched > 0
          ? `. ${unmatched} row${unmatched === 1 ? "" : "s"} named an admission number that is not on the school's roll and were left alone.`
          : ".") +
        (reason ? ` Nothing more was filed: ${reason}.` : "")
    );
    setSaveNote(
      filed === 0
        ? `The uploaded file put no mark on the school's records for ${selectedSubject}: ${reason ?? "every row scored zero, or the school's records did not answer"}.`
        : `${filed} uploaded ${selectedSubject} score${filed === 1 ? "" : "s"} are on the school's records.`
    );
    setIsSaved(filed > 0);
    setTimeout(() => {
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      setUploadStatus(null);
    }, 8000);
  };

  // Export Score Sheet to CSV
  const handleExportScoreSheetCSV = () => {
    const headers = [
      "S/N",
      "Admission No",
      "Student Full Name",
      "Class Level",
      "Subject",
      "1st Test (10)",
      "2nd Test (10)",
      "Project (10)",
      "Mid-Term (10)",
      "Exam (60)",
      "Total Score (100)",
      "Tier Grade",
      "Remark",
    ];

    const rows = filteredStudents.map((s, idx) => {
      const total = s.caScores.test1 + s.caScores.test2 + s.caScores.project + s.caScores.midTerm + s.caScores.exam;
      const gradeInfo = calculateGradeForClass(total, s.className, gradingTiers);
      return [
        idx + 1,
        s.admissionNo,
        s.fullName,
        s.className,
        selectedSubject,
        s.caScores.test1,
        s.caScores.test2,
        s.caScores.project,
        s.caScores.midTerm,
        s.caScores.exam,
        total,
        gradeInfo.grade,
        gradeInfo.remark,
      ];
    });

    exportToCSV(`RCA_${selectedClass.replace(/\s+/g, "_")}_${selectedSubject.replace(/\s+/g, "_")}_ScoreSheet`, headers, rows);
  };

  // Filtered students by class and search (React Compiler memoizes this automatically)
  const filteredStudents = students.filter((s) => {
    const matchesClass = selectedClass === "all" || s.className === selectedClass;
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  // Statistics calculated dynamically from live scores
  const stats = useMemo(() => {
    const totals = filteredStudents.map(
      (s) => s.caScores.test1 + s.caScores.test2 + s.caScores.project + s.caScores.midTerm + s.caScores.exam
    );
    const avg = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : "0";
    const max = totals.length ? Math.max(...totals) : 0;
    const min = totals.length ? Math.min(...totals) : 0;
    const passCount = totals.filter((t) => t >= 50).length;
    const passRate = totals.length ? ((passCount / totals.length) * 100).toFixed(1) : "0";
    return { avg, max, min, passRate };
  }, [filteredStudents]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Top Header & Breadcrumb */}
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
              <span className="text-slate-800 font-semibold">Continuous Assessment</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Continuous Assessment (CA) Gradebook
              </h1>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Tier-Adjusted Auto-Grading Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gradebook: <span className="font-semibold text-slate-700">{selectedSubject}</span> ({selectedClass}) • Multi-Tier Educational Scales
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => downloadSampleTemplate("ca_scores")}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download CA score entry CSV template"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              CSV Template
            </button>

            <button
              onClick={handleExportScoreSheetCSV}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Export current score table to CSV"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Export Broadsheet CSV
            </button>

            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Scores CSV
            </button>

            <Link
              href="/setup/grading"
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Sliders className="w-4 h-4 text-purple-600" />
              Adjust Scale
            </Link>

            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaved ? "Sent to the school records" : "Save & Sync Scores"}
            </button>
          </div>
          {saveNote && (
            <p className="text-[11px] text-slate-600 mt-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-blue-600 shrink-0" />
              {saveNote}
            </p>
          )}
        </div>

        {/* Filter & Selection Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Select Classroom Tier
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Enrolled Students (All Tiers)</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Academic Term
            </label>
            <div className="w-full text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-slate-700">
              {schoolScope.session} • {schoolScope.term}
            </div>
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

        {/* Live Performance Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Class Average</p>
            <p className="text-xl font-extrabold text-blue-600 mt-0.5">{stats.avg} <span className="text-xs font-normal text-slate-400">/ 100</span></p>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Highest Score</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{stats.max} <span className="text-xs font-normal text-slate-400">/ 100</span></p>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Lowest Score</p>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{stats.min} <span className="text-xs font-normal text-slate-400">/ 100</span></p>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <p className="text-[11px] font-medium text-slate-500">Pass Rate</p>
            <p className="text-xl font-extrabold text-purple-600 mt-0.5">{stats.passRate}%</p>
          </div>
        </div>

        {/* Score Sheet Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Student Continuous Assessment Marks</h3>
              <p className="text-[11px] text-slate-500">
                Formula: Test 1 (10) + Test 2 (10) + Project (10) + Mid-Term (10) + Exam (60) = Total (100).
              </p>
            </div>
            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
              {filteredStudents.length} Students Listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4 w-12">S/N</th>
                  <th className="py-3 px-4 min-w-[140px]">Admission No</th>
                  <th className="py-3 px-4 min-w-[180px]">Full Name &amp; Class</th>
                  <th className="py-3 px-2 text-center w-20">1st Test <br/><span className="text-[10px] text-slate-400 font-normal">(10)</span></th>
                  <th className="py-3 px-2 text-center w-20">2nd Test <br/><span className="text-[10px] text-slate-400 font-normal">(10)</span></th>
                  <th className="py-3 px-2 text-center w-20">Project <br/><span className="text-[10px] text-slate-400 font-normal">(10)</span></th>
                  <th className="py-3 px-2 text-center w-20">Mid-Term <br/><span className="text-[10px] text-slate-400 font-normal">(10)</span></th>
                  <th className="py-3 px-2 text-center w-24 bg-blue-50/50">Exam <br/><span className="text-[10px] text-blue-600 font-normal">(60 / CBT)</span></th>
                  <th className="py-3 px-3 text-center w-20 font-extrabold text-blue-700">Total <br/><span className="text-[10px] font-normal">(100)</span></th>
                  <th className="py-3 px-3 text-center w-24">Tier Grade</th>
                  <th className="py-3 px-3 text-center w-36">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student, index) => {
                  const total =
                    student.caScores.test1 +
                    student.caScores.test2 +
                    student.caScores.project +
                    student.caScores.midTerm +
                    student.caScores.exam;

                  const gradeInfo = calculateGradeForClass(total, student.className, gradingTiers);

                  return (
                    <tr key={student.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-500">{index + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-700">{student.admissionNo}</td>
                      <td className="py-2.5 px-4">
                        <p className="font-bold text-slate-900">{student.fullName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                            {student.className}
                          </span>
                          {student.cbtSyncStatus && (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                              student.cbtSyncStatus.isExpelled
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}>
                              <Cpu className="w-2.5 h-2.5" />
                              {student.cbtSyncStatus.isExpelled
                                ? "CBT (0)"
                                : `CBT: ${student.cbtSyncStatus.cbtScore}/${student.cbtSyncStatus.maxMarks}`}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Test 1 */}
                      <td className="py-2 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={student.caScores.test1}
                          onChange={(e) => handleScoreChange(student, "test1", e.target.value)}
                          className="w-14 text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </td>

                      {/* Test 2 */}
                      <td className="py-2 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={student.caScores.test2}
                          onChange={(e) => handleScoreChange(student, "test2", e.target.value)}
                          className="w-14 text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </td>

                      {/* Project */}
                      <td className="py-2 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={student.caScores.project}
                          onChange={(e) => handleScoreChange(student, "project", e.target.value)}
                          className="w-14 text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </td>

                      {/* Mid Term */}
                      <td className="py-2 px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={student.caScores.midTerm}
                          onChange={(e) => handleScoreChange(student, "midTerm", e.target.value)}
                          className="w-14 text-center py-1 text-xs font-semibold bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </td>

                      {/* Exam (60) */}
                      <td className="py-2 px-1 text-center bg-blue-50/30">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={student.caScores.exam}
                          onChange={(e) => handleScoreChange(student, "exam", e.target.value)}
                          className="w-16 text-center py-1 text-xs font-bold text-blue-900 bg-white border border-blue-300 rounded-md focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        />
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-3 text-center font-extrabold text-slate-900 text-sm">
                        {total}
                      </td>

                      {/* Tier Grade Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md font-extrabold text-xs border ${gradeInfo.color}`}>
                          {gradeInfo.grade}
                        </span>
                      </td>

                      {/* Remark */}
                      <td className="py-2.5 px-3 text-center text-[11px] font-medium text-slate-700">
                        {gradeInfo.remark}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>Live grades dynamically adjust based on student&apos;s enrolled tier (Montessori, Primary, BECE, WAEC).</span>
            <button
              onClick={handleSave}
              className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Publish Realtime Records to Dean of Studies →
            </button>
          </div>
        </div>

        {/* Modal: Bulk Score Sheet CSV Upload */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">
                    Bulk Continuous Assessment Marks Upload via CSV
                  </h3>
                </div>
                <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Required Columns in Score Sheet CSV:</p>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Admission No</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Student Name</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">1st Test (10)</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">2nd Test (10)</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Project (10)</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Mid-Term (10)</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Exam (60)</code>.
                    </p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center space-y-2 bg-slate-50 transition-colors">
                  <Upload className="w-8 h-8 text-indigo-600 mx-auto" />
                  <p className="font-bold text-slate-700">Choose a CSV Score Sheet to upload</p>
                  <p className="text-slate-500 text-[11px]">Select your completed marks spreadsheet</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleScoreFileChange}
                    className="block mx-auto text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>

                {uploadStatus && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-800">
                    {uploadStatus}
                  </div>
                )}

                {csvPreview.length > 0 && (
                  <>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Admission No</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-2 text-center">T1</th>
                          <th className="py-2 px-2 text-center">T2</th>
                          <th className="py-2 px-2 text-center">Proj</th>
                          <th className="py-2 px-2 text-center">Mid</th>
                          <th className="py-2 px-2 text-center">Exam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvPreview.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 font-mono font-bold text-blue-900">{row.admissionNo}</td>
                            <td className="py-1.5 px-3 font-semibold">{row.studentName}</td>
                            <td className="py-1.5 px-2 text-center">{row.test1 ?? "—"}</td>
                            <td className="py-1.5 px-2 text-center">{row.test2 ?? "—"}</td>
                            <td className="py-1.5 px-2 text-center">{row.project ?? "—"}</td>
                            <td className="py-1.5 px-2 text-center">{row.midTerm ?? "—"}</td>
                            <td className="py-1.5 px-2 text-center font-bold text-blue-800">{row.exam ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    A dash means the cell was empty in the file. The mark already on the school&apos;s records for that
                    pupil stays as it is — an empty cell is never filed as zero.
                  </p>
                  </>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate("ca_scores")}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Sample Score Template
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCsvModalOpen(false)}
                      className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={csvPreview.length === 0}
                      onClick={handleConfirmScoreUpload}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
                    >
                      Import {csvPreview.length} Score Records
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
