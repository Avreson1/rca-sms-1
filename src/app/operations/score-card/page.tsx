"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeStudents,
  useRealtimeClasses,
  useRealtimeGradingScales,
  useRealtimeSubjects,
  useRealtimeSubjectScores,
  useRealtimePsychomotor,
  useRealtimeNewsletter,
  useRealtimeAuth,
  calculateGradeForClass,
  formatOrdinal,
  StudentRecord,
  PsychomotorRecord,
} from "@/lib/realtime-store";
import { fetchPublicationsFromSupabase } from "@/lib/supabase/db";
import { useSchoolConfig, sessionOptions, REPORT_TERMS, type ReportTerm } from "@/lib/school-config";
import {
  GraduationCap,
  Printer,
  Download,
  ArrowLeft,
  School,
  CheckCircle2,
  Award,
  Sparkles,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Heart,
  Activity,
  Layers,
  FileSpreadsheet,
  Check,
  Eye,
  Calendar,
  Users,
  Palette,
  Mail,
  CreditCard,
  ShieldCheck,
  Lock,
  AlertCircle,
  UserCheck,
} from "lucide-react";

// Standard Curricular Subject Rosters by Education Tier
const TIER_DEFAULT_SUBJECTS: Record<string, string[]> = {
  PRE_PLAY_PLAY: [
    "Early Literacy & Letter Phonics",
    "Numeracy & Quantitative Concepts",
    "Sensory & Motor Practical Life",
    "Social Habits & Health Habit",
    "Rhymes, Rhythm & Music",
    "Creative Color & Hand-Eye Coordination",
  ],
  NURSERY: [
    "Pre-Reading Phonics & Diction",
    "Numeracy & Counting Aptitude",
    "Basic Science & Living Things",
    "Health Habits & Cleanliness",
    "Social Studies & Our Environment",
    "Handwriting & Letter Formation",
    "Creative Arts & Coloring",
    "Rhymes & Moral Guidance",
  ],
  PRIMARY: [
    "English Language & Composition",
    "General Mathematics",
    "Basic Science & Technology",
    "Social Studies & Civic Education",
    "Information & Communication Technology",
    "Agricultural Science",
    "Cultural & Creative Arts (CCA)",
    "Home Economics",
    "Christian Religious Studies (CRS)",
    "Verbal & Quantitative Reasoning",
  ],
  JUNIOR_SECONDARY: [
    "English Studies",
    "General Mathematics",
    "Basic Science",
    "Basic Technology",
    "Information & Communication Tech (ICT)",
    "Civic Education & Social Studies",
    "Agricultural Science",
    "Business Studies",
    "Christian Religious Studies (CRS)",
    "Cultural & Creative Arts (CCA)",
    "Physical & Health Education (PHE)",
  ],
  SENIOR_SECONDARY: [
    "English Language",
    "General Mathematics",
    "Information & Communication Tech (ICT)",
    "Civic Education",
    "Data Processing",
    "Physics",
    "Chemistry",
    "Biology",
    "Agricultural Science",
    "Economics",
    "Government",
    "Financial Accounting",
  ],
};

const THEME_STYLES = {
  royal: {
    name: "Scheme 1: Vibrant Royal & Academic Contrast",
    headerBg: "bg-[#0000FF]",
    headerText: "text-white",
    headerBorder: "border-[#0000FF]",
    accentText: "text-cyan-300",
    badgeBg: "bg-blue-900 text-cyan-200 border border-cyan-400/40",
    cardBorder: "border-[#0000FF]/40",
    highlightBg: "bg-blue-50/70",
    tableHeaderBg: "bg-[#0000FF] text-white",
  },
  scheme2: {
    name: "Scheme 2: Deep Navy & Bright Magenta",
    headerBg: "bg-[#0B2F9E]",
    headerText: "text-white",
    headerBorder: "border-[#0B2F9E]",
    accentText: "text-pink-300",
    badgeBg: "bg-[#0B2F9E] text-white border border-pink-400/40",
    cardBorder: "border-[#0B2F9E]/40",
    highlightBg: "bg-pink-50/40",
    tableHeaderBg: "bg-[#0B2F9E] text-white",
  },
  emerald: {
    name: "Emerald Green & Slate",
    headerBg: "bg-emerald-950",
    headerText: "text-white",
    headerBorder: "border-emerald-950",
    accentText: "text-emerald-300",
    badgeBg: "bg-emerald-900 text-white",
    cardBorder: "border-emerald-950",
    highlightBg: "bg-emerald-50/50",
    tableHeaderBg: "bg-emerald-950 text-white",
  },
  burgundy: {
    name: "Burgundy Wine & Gold",
    headerBg: "bg-rose-950",
    headerText: "text-white",
    headerBorder: "border-rose-950",
    accentText: "text-amber-300",
    badgeBg: "bg-rose-900 text-white",
    cardBorder: "border-rose-950",
    highlightBg: "bg-rose-50/50",
    tableHeaderBg: "bg-rose-950 text-white",
  },
  gold: {
    name: "Classic Gold & Royal Navy",
    headerBg: "bg-amber-900",
    headerText: "text-white",
    headerBorder: "border-amber-900",
    accentText: "text-amber-300",
    badgeBg: "bg-amber-800 text-white",
    cardBorder: "border-amber-900",
    highlightBg: "bg-amber-50/50",
    tableHeaderBg: "bg-amber-900 text-white",
  },
  slate: {
    name: "Executive Slate & Charcoal",
    headerBg: "bg-slate-900",
    headerText: "text-white",
    headerBorder: "border-slate-900",
    accentText: "text-slate-300",
    badgeBg: "bg-slate-800 text-white",
    cardBorder: "border-slate-900",
    highlightBg: "bg-slate-50/50",
    tableHeaderBg: "bg-slate-900 text-white",
  },
};

export default function ScoreCardPage() {
  const { students } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const { gradingTiers } = useRealtimeGradingScales();
  const { psychomotorList } = useRealtimePsychomotor();
  const { newsletter } = useRealtimeNewsletter();
  const { currentUser } = useRealtimeAuth();

  const currentRole = currentUser?.role || "SUPER_ADMIN";
  const isParentOrStudent = currentRole === "STUDENT_PARENT";
  const isTeacher = currentRole === "TEACHER";
  const isSuperOrExam = currentRole === "SUPER_ADMIN" || currentRole === "EXAM_OFFICER";

  // What prints at the top of the card. The school's own record wins; the values
  // compiled into the portal are only what a device shows before that record
  // arrives, or when it cannot be reached.
  const { config: school } = useSchoolConfig();
  const schoolName = school?.school_name || SCHOOL_INFO.name;
  const schoolAddress = school?.address || SCHOOL_INFO.address;
  const schoolEmail = school?.email || SCHOOL_INFO.email;
  const schoolPhone = school?.phone || SCHOOL_INFO.phone;
  const schoolMotto = school?.motto || SCHOOL_INFO.motto;

  // A parent's children are decided by the `guardian_students` rows behind their
  // login: /api/students already returns only those pupils. Matching a ward by
  // looking for the string "oladipo" in a guardian name invented a child for any
  // parent whose real children were not enrolled yet.
  const parentWards = useMemo(() => (isParentOrStudent ? students : []), [isParentOrStudent, students]);
  const parentWard = parentWards[0] ?? null;

  // Classes accessible to the current user
  const accessibleClasses = useMemo(() => {
    if (isParentOrStudent && parentWard) {
      return classes.filter((c) => c.name === parentWard.className);
    }
    if (isTeacher && currentUser?.assignedClass) {
      // Teacher sees their assigned class by default
      return classes.filter((c) => c.name === currentUser.assignedClass || c.name === "Primary 1");
    }
    return classes;
  }, [isParentOrStudent, isTeacher, parentWard, currentUser, classes]);

  // Selector Controls
  const schoolSession = school?.current_session?.trim() || SCHOOL_INFO.currentSession;
  const sessionList = sessionOptions(schoolSession);
  const [selectedSession, setSelectedSession] = useState<string>(schoolSession);
  const [selectedTerm, setSelectedTerm] = useState<ReportTerm>("First Term");
  const [selectedClass, setSelectedClass] = useState<string>(
    isParentOrStudent && parentWard
      ? parentWard.className
      : isTeacher && currentUser?.assignedClass
      ? currentUser.assignedClass
      : classes[0]?.name || "Primary 1"
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    isParentOrStudent && parentWard ? parentWard.id : ""
  );

  // The card opens on the term the school's own record says it is in. It used to
  // open on "First Term" whatever term the office was actually working in,
  // because that was the value typed into the page. Applied once, so a teacher
  // who picks a different term keeps their pick.
  const openedOnCurrentTerm = useRef(false);
  useEffect(() => {
    if (!school || openedOnCurrentTerm.current) return;
    openedOnCurrentTerm.current = true;
    setSelectedSession(schoolSession);
    if ((REPORT_TERMS as readonly string[]).includes(school.current_term)) {
      setSelectedTerm(school.current_term as ReportTerm);
    }
  }, [school, schoolSession]);

  // The marks on a card are the ones filed on the school's own tables, read for
  // the class on screen. All three terms come in one request because the
  // cumulative view needs the other two, and a card built from this browser's
  // copy showed a full result in the staff room and an empty one in the office.
  const { subjectScores } = useRealtimeSubjectScores({
    session: selectedSession,
    terms: [...REPORT_TERMS],
    className: selectedClass,
  });

  // Synchronize when parent ward or teacher role is initialized
  useEffect(() => {
    if (isParentOrStudent && parentWard) {
      setSelectedClass(parentWard.className);
      setSelectedStudentId(parentWard.id);
    } else if (isTeacher && currentUser?.assignedClass) {
      setSelectedClass(currentUser.assignedClass);
    }
  }, [isParentOrStudent, parentWard, isTeacher, currentUser]);

  // Mode & Template Toggles
  const [reportMode, setReportMode] = useState<"single" | "cumulative">("single");
  const [printLayout, setPrintLayout] = useState<"waec" | "bece" | "primary" | "montessori" | "broadsheet">("primary");
  const [showPsychomotor, setShowPsychomotor] = useState(true);
  const [showAttendanceRemarks, setShowAttendanceRemarks] = useState(true);
  const [showNewsletter, setShowNewsletter] = useState(true);
  const [isBatchPrintMode, setIsBatchPrintMode] = useState(false);
  const [themeScheme, setThemeScheme] = useState<"royal" | "scheme2" | "emerald" | "burgundy" | "gold" | "slate">(
    (newsletter.themeColor as any) || "royal"
  );

  const theme = (THEME_STYLES as any)[themeScheme] || THEME_STYLES.royal;

  // Filter students in selected class
  const classStudents = useMemo(() => {
    if (isParentOrStudent) return parentWards;
    return students.filter((s) => s.className === selectedClass);
  }, [students, selectedClass, isParentOrStudent, parentWards]);

  // Current selected student
  const currentStudent = useMemo(() => {
    if (isParentOrStudent) {
      return parentWards.find((s) => s.id === selectedStudentId) ?? parentWards[0] ?? null;
    }
    if (selectedStudentId) {
      const found = classStudents.find((s) => s.id === selectedStudentId);
      if (found) return found;
    }
    return classStudents[0] || null;
  }, [classStudents, selectedStudentId, isParentOrStudent, parentWards]);

  // Whether the exam office has released this class's results.
  //
  // The school's own access rules say a parent may "view published report
  // cards", and until now nothing on a parent's screen consulted any
  // publication state — the office could withhold a class and the family would
  // still open the term's marks. Staff keep the full view, because the office
  // has to be able to read a card before it releases it.
  const [parentRelease, setParentRelease] = useState<{
    status: "released" | "checking" | "locked" | "unreadable" | "not_needed";
    reason?: string;
  }>({ status: "not_needed" });

  const wardClassName = isParentOrStudent ? currentStudent?.className ?? "" : "";

  useEffect(() => {
    if (!isParentOrStudent) {
      setParentRelease({ status: "not_needed" });
      return;
    }
    if (!wardClassName) {
      setParentRelease({ status: "unreadable", reason: "no pupil is linked to this login yet" });
      return;
    }

    setParentRelease({ status: "checking" });
    let cancelled = false;
    void fetchPublicationsFromSupabase(selectedSession, selectedTerm).then(({ rows, reason }) => {
      if (cancelled) return;
      if (reason) {
        setParentRelease({ status: "unreadable", reason });
        return;
      }
      const released = (rows ?? []).some((row) => row.class_name === wardClassName);
      setParentRelease({ status: released ? "released" : "locked" });
    });

    return () => {
      cancelled = true;
    };
  }, [isParentOrStudent, wardClassName, selectedSession, selectedTerm]);

  // Auto-adapt template layout when class changes
  const activeTierKey = useMemo(() => {
    const lower = (selectedClass || "").toLowerCase();
    if (lower.includes("pre-play") || (lower.includes("play") && !lower.includes("display"))) return "PRE_PLAY_PLAY";
    if (lower.includes("nursery")) return "NURSERY";
    if (lower.includes("jss") || lower.includes("junior")) return "JUNIOR_SECONDARY";
    if (lower.includes("ss") || lower.includes("senior")) return "SENIOR_SECONDARY";
    return "PRIMARY";
  }, [selectedClass]);

  // The card layout has its own name for a senior arm, but the school's grading
  // scales are filed under SECONDARY. Looking the scale up by the layout's word
  // printed a senior card with no grade key at all.
  const activeGradeTierKey = activeTierKey === "SENIOR_SECONDARY" ? "SECONDARY" : activeTierKey;

  // Auto-switch default layout based on class tier unless manually changed
  useEffect(() => {
    if (activeTierKey === "PRE_PLAY_PLAY" || activeTierKey === "NURSERY") {
      setPrintLayout("montessori");
    } else if (activeTierKey === "PRIMARY") {
      setPrintLayout("primary");
    } else if (activeTierKey === "JUNIOR_SECONDARY") {
      setPrintLayout("bece");
    } else {
      setPrintLayout("waec");
    }
  }, [activeTierKey]);

  // Subject List for Current Student
  const subjectsList = useMemo(() => {
    const standard = TIER_DEFAULT_SUBJECTS[activeTierKey] || TIER_DEFAULT_SUBJECTS.PRIMARY;
    return standard;
  }, [activeTierKey]);

  // Compute student results for single term and cumulative
  //
  // A subject with no filed mark for this session and term has no number to show.
  // This used to interpolate one from the neighbouring subject — and from the two
  // terms nobody has run yet — so a printed card carried marks no person entered.
  // Every figure below is now either read from a filed row or rendered as a dash.
  const computeStudentResults = (student: StudentRecord) => {
    return subjectsList.map((subjectName) => {
      const filedFor = (term: string) =>
        subjectScores.find(
          (s) =>
            s.studentId === student.id &&
            s.subjectName.toLowerCase() === subjectName.toLowerCase() &&
            s.session === selectedSession &&
            s.term === term
        );

      const termRows = REPORT_TERMS.map(filedFor);
      const current = filedFor(selectedTerm);
      const allTermsFiled = termRows.every((row) => Boolean(row));

      const termTotals = termRows.map((row) => (row ? row.total : null));
      const cumulativeTotal = allTermsFiled ? termTotals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
      const cumulativeAvg = allTermsFiled ? Number((cumulativeTotal! / 3).toFixed(1)) : null;

      const activeTotal = reportMode === "single" ? termTotals[REPORT_TERMS.indexOf(selectedTerm as never)] : cumulativeAvg;
      const gradeInfo =
        activeTotal === null
          ? { grade: "—", remark: "Not filed", color: "bg-slate-100 text-slate-400" }
          : calculateGradeForClass(activeTotal, student.className, gradingTiers);

      return {
        subject: subjectName,
        entered: activeTotal !== null,
        test1: current ? current.test1 : null,
        test2: current ? current.test2 : null,
        project: current ? current.project : null,
        midTerm: current ? current.midTerm : null,
        caScore: current ? current.test1 + current.test2 + current.project + current.midTerm : null,
        examScore: current ? current.exam : null,
        term1Total: termTotals[0],
        term2Total: termTotals[1],
        term3Total: termTotals[2],
        cumulativeTotal,
        cumulativeAvg,
        total: activeTotal,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        colorBadge: gradeInfo.color,
      };
    });
  };

  type StudentResult = ReturnType<typeof computeStudentResults>[number];

  const dash = (value: number | string | null | undefined) =>
    value === null || value === undefined || value === "" ? "—" : String(value);

  // Psychomotor & attendance come only from a record somebody assessed. The
  // defaults used to be praise ("exceptionally diligent"), 112 days present out of
  // 115, and top ratings on every trait for every child — printed on cards that go
  // home, for pupils who were never assessed.
  const currentPsychomotor = useMemo((): PsychomotorRecord | null => {
    if (!currentStudent) return null;
    return (
      psychomotorList.find(
        (p) => p.studentId === currentStudent.id && p.session === selectedSession && p.term === selectedTerm
      ) ?? null
    );
  }, [currentStudent, psychomotorList, selectedSession, selectedTerm]);

  // Student navigation
  const currentStudentIndex = classStudents.findIndex((s) => s.id === currentStudent?.id);
  const handlePrevStudent = () => {
    if (isParentOrStudent) return; // Prevent navigation for parents
    if (currentStudentIndex > 0) {
      setSelectedStudentId(classStudents[currentStudentIndex - 1].id);
    }
  };
  const handleNextStudent = () => {
    if (isParentOrStudent) return; // Prevent navigation for parents
    if (currentStudentIndex < classStudents.length - 1) {
      setSelectedStudentId(classStudents[currentStudentIndex + 1].id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Render Score Card
  const filedResults = (student: StudentRecord) =>
    computeStudentResults(student).filter((r): r is StudentResult & { total: number } => r.total !== null);

  // The mean over a pupil's filed subjects, or -1 when the set is incomplete: a
  // position is a comparison, and ranking a full card against a half-filled one is
  // how a child ends up bottom of the class on paper nobody finished marking.
  const rankableMean = (student: StudentRecord) => {
    const all = computeStudentResults(student);
    const filed = filedResults(student);
    return all.length > 0 && filed.length === all.length ? filed.reduce((sum, r) => sum + r.total, 0) / all.length : -1;
  };

  const renderScoreCard = (student: StudentRecord, isBatchItem: boolean = false) => {
    const results = computeStudentResults(student);
    const filed = filedResults(student);
    const total = filed.reduce((sum, r) => sum + r.total, 0);
    const avg = results.length > 0 && filed.length === results.length ? (total / results.length).toFixed(1) : null;

    const classMeans = classStudents.map((s) => ({ id: s.id, mean: rankableMean(s) }));
    const ranked = classMeans.filter((c) => c.mean >= 0).sort((a, b) => b.mean - a.mean);
    const pos =
      classMeans.length > 1 && ranked.length === classMeans.length
        ? `${formatOrdinal(ranked.findIndex((c) => c.id === student.id) + 1)} of ${classMeans.length}`
        : "—";

    const psy =
      psychomotorList.find(
        (p) => p.studentId === student.id && p.session === selectedSession && p.term === selectedTerm
      ) ?? null;

    return (
      <div
        key={student.id}
        className={`bg-white border-2 ${theme.cardBorder} rounded-2xl p-6 md:p-8 shadow-sm max-w-4xl mx-auto space-y-5 print:border-none print:shadow-none print:p-0 ${
          isBatchItem ? "print:break-after-page mb-12 print:mb-0" : ""
        }`}
      >
        {/* Institution Crest & Header */}
        <div className={`text-center space-y-1.5 border-b-2 ${theme.cardBorder} pb-4 relative`}>
          <div className="flex items-center justify-center gap-3 mb-1">
            <div
              className={`w-12 h-12 rounded-2xl ${theme.headerBg} text-white font-black text-xl flex items-center justify-center shadow-sm`}
            >
              RCA
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-700 block">
                Official Institutional Dossier
              </span>
              <span className="text-[11px] font-bold text-slate-500">Rayfield Campus, Jos</span>
            </div>
          </div>

          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
            {schoolName}
          </h2>
          <p className="text-xs font-semibold text-slate-600 tracking-wide">
            {schoolAddress} • Email: {schoolEmail} • Tel: {schoolPhone}
          </p>
          <p className="text-[11px] font-bold text-amber-700 italic">
            &quot;{schoolMotto}&quot; • Terminal Academic Dossier &amp; Character Assessment
          </p>

          <div
            className={`inline-flex items-center gap-2 ${theme.headerBg} text-white text-[11px] font-extrabold px-4 py-1 rounded-full uppercase tracking-wider mt-2`}
          >
            <span>
              {reportMode === "single"
                ? `${selectedTerm} Official Report Card`
                : "Annual Cumulative Terminal Dossier"}
            </span>
            <span>•</span>
            <span className={theme.accentText}>{selectedSession}</span>
          </div>
        </div>

        {/* Student Biodata Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pupil / Student Name</span>
            <strong className="text-slate-900 text-sm">{student.fullName}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Admission Number</span>
            <strong className="text-[#0000FF] font-mono font-bold text-xs">{student.admissionNo}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Class Level &amp; Arm</span>
            <strong className="text-slate-800 font-bold">{student.className}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Sports House</span>
            <strong className="text-slate-800">{student.house}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Gender</span>
            <span className="text-slate-700 font-medium">{student.gender}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Terminal Average</span>
            <strong className="text-emerald-700 font-bold text-sm">{avg === null ? "Incomplete" : `${avg}%`}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Class Position</span>
            <strong className="text-purple-800 font-bold">{pos}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Promotional Standing</span>
            {/* Promotion is a decision the school records at end of term; until that decision exists
                for this class there is nothing honest to print here. */}
            <strong className="text-slate-600 font-bold">Not decided</strong>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-[11px] text-slate-700">
            No subjects are configured for {student.className}, so this card has nothing to show.
          </div>
        ) : filed.length < results.length ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[11px] text-amber-900">
            <strong>
              {results.length - filed.length} of {results.length} subjects have no mark filed for{" "}
              {selectedTerm}, {selectedSession}.
            </strong>{" "}
            A dash means nobody entered a score. Nothing on this card is estimated: once it is printed it
            goes home with the family.
          </div>
        ) : null}

        {/* Academic Performance Table */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {reportMode === "single" ? (
                <tr className={`${theme.tableHeaderBg} font-bold`}>
                  <th className="py-2.5 px-3">Subject / Learning Area</th>
                  {printLayout === "waec" && (
                    <>
                      <th className="py-2.5 px-1.5 text-center w-12 font-medium text-[11px]">T1 (10)</th>
                      <th className="py-2.5 px-1.5 text-center w-12 font-medium text-[11px]">T2 (10)</th>
                      <th className="py-2.5 px-1.5 text-center w-12 font-medium text-[11px]">Proj (10)</th>
                      <th className="py-2.5 px-1.5 text-center w-12 font-medium text-[11px]">Mid (10)</th>
                    </>
                  )}
                  <th className="py-2.5 px-2 text-center w-16">CA (40)</th>
                  <th className="py-2.5 px-2 text-center w-16">Exam (60)</th>
                  <th className="py-2.5 px-2 text-center w-20 bg-slate-800 text-white font-bold">Total (100)</th>
                  <th className="py-2.5 px-2 text-center w-20">Grade</th>
                  <th className="py-2.5 px-3 text-left">Remark / Evaluation</th>
                </tr>
              ) : (
                <tr className={`${theme.tableHeaderBg} font-bold`}>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-2 text-center w-16">1st Term (100)</th>
                  <th className="py-2.5 px-2 text-center w-16">2nd Term (100)</th>
                  <th className="py-2.5 px-2 text-center w-16">3rd Term (100)</th>
                  <th className="py-2.5 px-2 text-center w-20 bg-slate-800 text-white font-bold">Cum. Total</th>
                  <th className="py-2.5 px-2 text-center w-20 bg-slate-700 text-white font-bold">Cum. Avg</th>
                  <th className="py-2.5 px-2 text-center w-16">Grade</th>
                  <th className="py-2.5 px-3 text-left">Annual Remark</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.map((sub, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="py-2 px-3 font-semibold text-slate-800">{sub.subject}</td>

                  {reportMode === "single" ? (
                    <>
                      {printLayout === "waec" && (
                        <>
                          <td className="py-2 px-1 text-center font-mono text-slate-500 text-[11px]">{dash(sub.test1)}</td>
                          <td className="py-2 px-1 text-center font-mono text-slate-500 text-[11px]">{dash(sub.test2)}</td>
                          <td className="py-2 px-1 text-center font-mono text-slate-500 text-[11px]">{dash(sub.project)}</td>
                          <td className="py-2 px-1 text-center font-mono text-slate-500 text-[11px]">{dash(sub.midTerm)}</td>
                        </>
                      )}
                      <td className="py-2 px-2 text-center font-mono text-slate-700 font-medium">{dash(sub.caScore)}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-700 font-medium">{dash(sub.examScore)}</td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 bg-slate-50">{dash(sub.total)}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-extrabold text-[11px] border ${sub.colorBadge}`}>
                          {sub.grade}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium text-[11px]">{sub.remark}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-2 text-center font-mono text-slate-600">{dash(sub.term1Total)}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600">{dash(sub.term2Total)}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600">{dash(sub.term3Total)}</td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 bg-slate-50">{dash(sub.cumulativeTotal)}</td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-950 bg-blue-50">
                        {sub.cumulativeAvg === null ? "—" : `${sub.cumulativeAvg}%`}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-extrabold text-[11px] border ${sub.colorBadge}`}>
                          {sub.grade}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium text-[11px]">{sub.remark}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2.5 px-3">Cumulative Grand Summary</td>
                {reportMode === "single" && printLayout === "waec" && <td colSpan={4}></td>}
                {reportMode === "single" ? (
                  <>
                    <td className="py-2.5 px-2 text-center font-mono">
                      {filed.reduce((sum, r) => sum + (r.caScore ?? 0), 0)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      {filed.reduce((sum, r) => sum + (r.examScore ?? 0), 0)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-extrabold text-blue-950 bg-blue-100">
                      {total} / {filed.length * 100}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-emerald-800">
                      {avg === null ? `Average needs all ${results.length} subjects filed (${filed.length} so far)` : `Average: ${avg}%`}
                    </td>
                  </>
                ) : (
                  <>
                    <td colSpan={3} className="py-2.5 px-3 text-center">Three-Term Performance Aggregate</td>
                    <td className="py-2.5 px-2 text-center font-mono font-extrabold text-blue-950 bg-blue-100">
                      {results.every((r) => r.cumulativeTotal !== null)
                        ? results.reduce((sum, r) => sum + (r.cumulativeTotal ?? 0), 0)
                        : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-extrabold text-blue-950 bg-blue-200">
                      {avg}%
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-purple-900 font-bold">
                      Class Rank: {pos}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Psychomotor & Affective Domain Grid */}
        {showPsychomotor && psy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-extrabold text-[11px] text-purple-950 uppercase tracking-wider flex items-center gap-1">
                  <Heart className="w-3 h-3 text-purple-600" />
                  Affective Domain Assessment (1 - 5)
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">5: Excellent • 1: Poor</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                {Object.entries(psy.affectiveRatings || {}).slice(0, 8).map(([trait, val], idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-0.5">
                    <span className="text-slate-700 truncate pr-1">{trait.replace(/tr-[a-z]+/, "") || trait}</span>
                    <span className="font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 font-mono">
                      {val} / 5
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="font-extrabold text-[11px] text-blue-950 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3 text-blue-600" />
                  Psychomotor Domain &amp; Agility (1 - 5)
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">5: Excellent • 1: Poor</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                {Object.entries(psy.psychomotorRatings || {}).slice(0, 8).map(([trait, val], idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-0.5">
                    <span className="text-slate-700 truncate pr-1">{trait.replace(/tr-[a-z]+/, "") || trait}</span>
                    <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                      {val} / 5
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAttendanceRemarks && !psy && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[11px] text-amber-900">
            <strong>No character assessment on file for this pupil.</strong> Attendance, the affective and
            psychomotor ratings, and the form teacher&apos;s and principal&apos;s remarks print only for a
            pupil somebody assessed in Traits &amp; Psychomotor for {selectedTerm}, {selectedSession}. The
            praise this panel used to carry for every child was a template, not an observation.
          </div>
        )}

        {/* Attendance Summary */}
        {showAttendanceRemarks && psy && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl text-center text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Days School Opened</span>
              <strong className="text-slate-800 font-mono text-sm">{psy.attendance.daysOpened}</strong>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Days Present</span>
              <strong className="text-emerald-700 font-mono text-sm">{psy.attendance.daysPresent}</strong>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Next Term Resumption</span>
              <strong className="text-slate-900 font-bold text-xs">{psy.nextTermBegins || newsletter.nextTermResumption || "To be announced"}</strong>
            </div>
          </div>
        )}

        {/* The scale belongs to this class's tier. One fixed "Pass Mark: 45% (D)" key used
            to print on every card, including nursery, whatever the school had configured. */}
        {(gradingTiers[activeGradeTierKey]?.brackets?.length ?? 0) > 0 && (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-700">
                Grading criteria &mdash; {gradingTiers[activeGradeTierKey].tierTitle}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[10px]">
              {gradingTiers[activeGradeTierKey].brackets.map((bracket) => (
                <div key={bracket.grade} className="bg-white p-1 rounded border border-blue-200">
                  <strong className="text-[#0000FF] block font-black">
                    {bracket.grade}: {bracket.minScore} - {bracket.maxScore}%
                  </strong>
                  <span className="text-slate-500">
                    {bracket.classification} ({bracket.gradePoint.toFixed(1)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Endorsements & Signatures */}
        {showAttendanceRemarks && psy && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t-2 border-slate-300 text-xs">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Form Master&apos;s Appraisal</span>
                <p className="font-semibold text-slate-800 italic mt-0.5 text-[11px] leading-relaxed">
                  {psy.formTeacherRemark?.trim()
                    ? `"${psy.formTeacherRemark}"`
                    : "Not written by the form teacher for this term."}
                </p>
              </div>
              <div className="pt-5 border-t border-slate-300 w-48 text-center text-slate-500 font-mono text-[10px]">
                Form Teacher Signature &amp; Date
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Principal / Director&apos;s Endorsement</span>
                <p className="font-semibold text-slate-800 italic mt-0.5 text-[11px] leading-relaxed">
                  {psy.principalRemark?.trim()
                    ? `"${psy.principalRemark}"`
                    : "Endorsement withheld — the Head of School has not written one for this term."}
                </p>
              </div>
              <div className="pt-5 border-t border-slate-300 w-48 text-center text-slate-500 font-mono text-[10px]">
                Principal / Official Institutional Seal
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Printable Terminal Newsletter (Attached to Printout) */}
        {showNewsletter && (
          <div className="pt-6 border-t-4 border-slate-300 space-y-4 print:break-before-page">
            <div className={`${theme.headerBg} text-white p-4 rounded-xl text-center space-y-1`}>
              <span className={`text-[10px] uppercase font-extrabold tracking-widest ${theme.accentText}`}>
                {schoolName} • Terminal Circular
              </span>
              <h3 className="text-base font-black tracking-tight uppercase">
                End-of-Term Newsletter &amp; Important Advisories
              </h3>
              <p className="text-[11px] text-slate-300">
                {selectedSession} Session • {selectedTerm}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-3">
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Director&apos;s End-of-Term Address:</h4>
                <p className="text-slate-700 leading-relaxed italic">
                  {newsletter.principalMessage ? `"${newsletter.principalMessage}"` : "Not written for this term."}
                </p>
                {newsletter.principalName && (
                  <p className="text-[11px] font-bold text-slate-900 mt-1">— {newsletter.principalName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Upcoming Term Schedule:
                  </h4>
                  <p className="text-[#0000FF] font-bold text-xs mb-1">
                    {newsletter.nextTermResumption
                      ? `Resumption: ${newsletter.nextTermResumption}`
                      : "Resumption date not announced."}
                  </p>
                  {newsletter.eventsAndHighlights.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700">
                      {newsletter.eventsAndHighlights.map((ev, idx) => (
                        <li key={idx}>{ev}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    Tuition &amp; Bank Payment Details:
                  </h4>
                  <p className="text-[11px] text-slate-700 leading-snug mb-2">{newsletter.feePolicyAndDeadlines}</p>
                  {newsletter.bankAccountDetails.accountNumber ? (
                    <div className="bg-white border border-slate-300 p-2 rounded-lg text-[11px] font-mono">
                      <p className="text-slate-500">Bank: <strong className="text-slate-900">{newsletter.bankAccountDetails.bankName}</strong></p>
                      <p className="text-slate-500">Account: <strong className="text-slate-900">{newsletter.bankAccountDetails.accountName}</strong></p>
                      <p className="text-slate-500">Number: <strong className="text-[#0000FF] font-bold">{newsletter.bankAccountDetails.accountNumber}</strong></p>
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-slate-500">
                      No bank account has been entered for the school, so none is printed. A printed
                      account number sends families money, so it is never guessed.
                    </p>
                  )}
                </div>
              </div>

              {newsletter.customNotes && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 font-medium">
                  <strong>Special Advisory:</strong> {newsletter.customNotes}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Header & Breadcrumbs */}
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
              <span className="text-slate-800 font-semibold">Terminal Score Card</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {isParentOrStudent ? "Ward Academic Dossier & Report Card" : "Terminal Score Card & Dossier Engine"}
              </h1>
              {isParentOrStudent ? (
                <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-sky-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  Parent &amp; Student Secure View
                </span>
              ) : isTeacher ? (
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Assigned Class Scope ({currentUser?.assignedClass || "Primary 1"})
                </span>
              ) : (
                <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-purple-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Master Institutional Governance
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isParentOrStudent
                ? "Official verified academic progress report, continuous assessment breakdown, and behavioral evaluations for your ward."
                : `Official institutional evaluations, multi-tier Nigerian standard grading scales, and printable terminal newsletter for ${SCHOOL_INFO.name}.`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isParentOrStudent && (
              <>
                <Link
                  href="/operations/traits-assessments"
                  className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-purple-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Heart className="w-4 h-4 text-purple-600" />
                  Psychomotor Engine
                </Link>

                {isSuperOrExam && (
                  <Link
                    href="/setup/report-templates"
                    className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Palette className="w-4 h-4 text-blue-600" />
                    Themes &amp; Newsletter
                  </Link>
                )}
              </>
            )}

            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold bg-[#0000FF] hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {isBatchPrintMode ? `Print All (${classStudents.length}) Dossiers` : "Print Official Report Card"}
            </button>
          </div>
        </div>

        {/* Parent / Student RBAC Banner */}
        {isParentOrStudent && !parentWard ? (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs text-xs text-amber-900 flex items-start gap-3 print:hidden">
            <Lock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              No pupil on the school&apos;s records is linked to this login yet, so there is no card to open. The
              office links a parent login to its children in Settings → User Access; until it does, this screen has
              nothing to show — and it will not show a name or a mark that nobody entered.
            </p>
          </div>
        ) : isParentOrStudent && parentWard ? (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-sm">
                <GraduationCap className="w-5 h-5 text-sky-100" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Ward Record: <strong className="text-sky-900">{parentWard.fullName}</strong> ({parentWard.admissionNo})
                </p>
                <p className="text-[11px] text-slate-600">
                  Class: <strong>{parentWard.className}</strong> • House: <strong>{parentWard.house || "Not recorded"}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                parentWard.feeStatus === "Fully Cleared"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-amber-100 text-amber-800 border-amber-300"
              }`}>
                Fee Status: {parentWard.feeStatus || "Not recorded"}
              </span>
            </div>
          </div>
        ) : null}

        {/* Global Control & Multi-Selector Menu */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 print:hidden">
          {/* Row 1: Session, Term, Class, Student Dropdown Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Academic Session
              </label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden"
              >
                {sessionList.map((option) => (
                  <option key={option} value={option}>
                    {option} Session
                  </option>
                ))}
                {!sessionList.includes(selectedSession) && (
                  <option value={selectedSession}>{selectedSession} Session</option>
                )}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Centred on {schoolSession}, the session the school is in. A session with no filed marks shows an empty
                card.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Evaluation Term
              </label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value as ReportTerm)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden"
              >
                {REPORT_TERMS.map((term) => (
                  <option key={term} value={term}>
                    {term === "Third Term" ? "Third Term (Annual Promotion)" : term}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Enrolled Class Tier</span>
                {isParentOrStudent && <Lock className="w-3 h-3 text-slate-400" />}
              </label>
              <select
                value={selectedClass}
                disabled={isParentOrStudent}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStudentId("");
                }}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
              >
                {accessibleClasses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.section})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Candidate / Pupil ({classStudents.length})</span>
                {isParentOrStudent && <Lock className="w-3 h-3 text-slate-400" />}
              </label>
              <select
                value={selectedStudentId || currentStudent?.id || ""}
                disabled={isParentOrStudent || classStudents.length === 0}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
              >
                {classStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.admissionNo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Evaluation Mode & Theme Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            {/* Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Scope:</span>
              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setReportMode("single")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    reportMode === "single"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Single Term (CA + Exam)
                </button>
                <button
                  type="button"
                  onClick={() => setReportMode("cumulative")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    reportMode === "cumulative"
                      ? "bg-white text-purple-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  3-Term Cumulative Annual
                </button>
              </div>
            </div>

            {/* Theme Selector (Restricted to Super Admin & Exam Officer) */}
            {isSuperOrExam && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Theme:</span>
                <select
                  value={themeScheme}
                  onChange={(e) => setThemeScheme(e.target.value as any)}
                  className="min-w-0 max-w-full text-xs font-bold bg-slate-50 text-slate-800 border border-slate-200 rounded-lg p-1.5 cursor-pointer"
                >
                  <option value="royal">Scheme 1: Royal Blue &amp; Cyan</option>
                  <option value="scheme2">Scheme 2: Deep Navy &amp; Magenta</option>
                  <option value="emerald">Emerald Green</option>
                  <option value="burgundy">Burgundy Wine</option>
                  <option value="slate">Executive Slate</option>
                </select>
              </div>
            )}

            {/* Newsletter and Batch Toggles */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showNewsletter}
                  onChange={(e) => setShowNewsletter(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Print Newsletter
              </label>

              {/* Batch Print All (Restricted from Parent / Student) */}
              {!isParentOrStudent && (
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isBatchPrintMode}
                    onChange={(e) => setIsBatchPrintMode(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  Batch Print All
                </label>
              )}

              {/* Navigation arrows (Disabled for Parent / Student) */}
              {!isParentOrStudent && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevStudent}
                    disabled={currentStudentIndex <= 0}
                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 text-slate-700 cursor-pointer"
                    title="Previous Student"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {currentStudentIndex + 1}/{classStudents.length || 1}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextStudent}
                    disabled={currentStudentIndex >= classStudents.length - 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 text-slate-700 cursor-pointer"
                    title="Next Student"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Report Card Viewer */}
        {classStudents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">No Students Registered in {selectedClass}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isParentOrStudent
                ? "No student record is currently linked to your parent account. Please contact the Admissions Office."
                : `Please enroll students into ${selectedClass} or import a class roster from Students Registry to generate scorecards.`}
            </p>
            {!isParentOrStudent && (
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/operations/students"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs"
                >
                  Register Students →
                </Link>
              </div>
            )}
          </div>
        ) : isParentOrStudent && parentRelease.status !== "released" ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs max-w-xl mx-auto">
            <Lock className="w-9 h-9 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900">
              {parentRelease.status === "checking"
                ? "Checking whether this result is released"
                : parentRelease.status === "locked"
                ? "This report card has not been released yet"
                : "The release could not be confirmed"}
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {parentRelease.status === "checking" ? (
                <>Asking the school records whether {wardClassName} is out for {selectedTerm}.</>
              ) : parentRelease.status === "locked" ? (
                <>
                  The exam office has not published {selectedClass} results for {selectedTerm} ({selectedSession}). The
                  marks are already on the school&apos;s records; the card appears here as soon as they are released.
                </>
              ) : (
                <>
                  The portal could not check whether this term has been released
                  {parentRelease.reason ? `: ${parentRelease.reason}` : ""}. Rather than show you a card that may still
                  be under approval, nothing is shown. Try again shortly, or ask the school office.
                </>
              )}
            </p>
          </div>
        ) : isBatchPrintMode && !isParentOrStudent ? (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 text-xs font-semibold flex items-center justify-between print:hidden">
              <span>
                Batch Printing Active: Generating {classStudents.length} official dossiers for{" "}
                <strong>{selectedClass}</strong>
              </span>
              <button
                onClick={handlePrint}
                className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Trigger Print ({classStudents.length})
              </button>
            </div>
            {classStudents.map((s) => renderScoreCard(s, true))}
          </div>
        ) : (
          currentStudent && renderScoreCard(currentStudent, false)
        )}
      </div>
    </DashboardShell>
  );
}
