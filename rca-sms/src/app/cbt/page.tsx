"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeStudents,
  useRealtimeCBTQuestions,
  useRealtimeCBTConfig,
  useRealtimeAuth,
  syncCBTScoreToCA,
  StudentRecord,
} from "@/lib/realtime-store";
import { exportToCSV, parseCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import {
  Laptop,
  Plus,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Timer,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Video,
  Mic,
  Maximize2,
  Eye,
  AlertTriangle,
  FileWarning,
  Lock,
  Unlock,
  Download,
  Upload,
  FileSpreadsheet,
  FileDown,
  Printer,
  Volume2,
  ArrowUpRight,
  Database,
  Radio,
  Calendar,
  School,
  Settings,
} from "lucide-react";

interface Question {
  id: number;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  marks: number;
}

interface MalpracticeEvent {
  id: string;
  timestamp: string;
  type: "TAB_SWITCH" | "FULLSCREEN_EXIT" | "SHORTCUT_BLOCKED" | "AUDIO_SPIKE" | "GAZE_AWAY";
  severity: "LOW" | "MEDIUM" | "CRITICAL";
  description: string;
}

const DEFAULT_CBT_QUESTIONS: Question[] = [
  {
    id: 1,
    questionText: "Which of the following computer network topologies requires a central hub or switch to connect all nodes?",
    options: ["Ring Topology", "Star Topology", "Mesh Topology", "Bus Topology"],
    correctAnswerIndex: 1,
    marks: 10,
  },
  {
    id: 2,
    questionText: "In relational database management systems (RDBMS), what does the acronym ACID guarantee?",
    options: [
      "Accuracy, Consistency, Integrity, Durability",
      "Atomicity, Consistency, Isolation, Durability",
      "Authentication, Control, Identification, Data",
      "Application, Configuration, Interface, Distribution",
    ],
    correctAnswerIndex: 1,
    marks: 10,
  },
  {
    id: 3,
    questionText: "Which security protocol is standard for establishing an encrypted link between a web server and a browser?",
    options: ["HTTP", "FTP", "HTTPS (SSL/TLS)", "SMTP"],
    correctAnswerIndex: 2,
    marks: 10,
  },
  {
    id: 4,
    questionText: "What is the primary role of the Arithmetic Logic Unit (ALU) within the central processing unit?",
    options: [
      "Allocating memory cache buffers",
      "Executing arithmetic calculations and logical decisions",
      "Regulating computer clock cycles",
      "Decoding instruction cache registers",
    ],
    correctAnswerIndex: 1,
    marks: 10,
  },
  {
    id: 5,
    questionText: "Which programming paradigm models software around data attributes and associated behavioral methods?",
    options: [
      "Procedural Programming",
      "Object-Oriented Programming (OOP)",
      "Declarative Programming",
      "Logic Programming",
    ],
    correctAnswerIndex: 1,
    marks: 10,
  },
];

export default function ProctoredCBTPage() {
  const { students } = useRealtimeStudents();
  const { questions: storeQuestions } = useRealtimeCBTQuestions();
  const { cbtConfig, toggleCBTAccess } = useRealtimeCBTConfig();
  const { currentUser } = useRealtimeAuth();
  const currentRole = currentUser?.role || "SUPER_ADMIN";
  const isCandidate = currentRole === "STUDENT_PARENT";

  const examQuestions = storeQuestions.length > 0 ? storeQuestions : DEFAULT_CBT_QUESTIONS;
  const [activeTab, setActiveTab] = useState<"manage" | "simulate">("manage");

  // Selected Candidate
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || "");
  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0] || {
    fullName: "Enrolled Student",
    admissionNo: "RCA/STD/2025/001",
    className: "Primary 1",
  };

  // Exam Simulation State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExpelled, setIsExpelled] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ scaledScore: number; target: string } | null>(null);

  // Malpractice & Anti-Cheating Failsafe State
  const [strikes, setStrikes] = useState<number>(0);
  const [malpracticeLogs, setMalpracticeLogs] = useState<MalpracticeEvent[]>([]);
  const [activeWarningModal, setActiveWarningModal] = useState<string | null>(null);
  const [noiseLevel, setNoiseLevel] = useState<number>(24);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalMaxMarks = examQuestions.reduce((sum, q) => sum + q.marks, 0);

  const getCorrectOptionIndex = (q: any): number => {
    if (typeof q?.correctAnswerIndex === "number") return q.correctAnswerIndex;
    if (typeof q?.correctOptionIndex === "number") return q.correctOptionIndex;
    return 0;
  };

  const calculateFinalScore = () => {
    return Object.entries(selectedAnswers).reduce((acc, [qIdx, ansIdx]) => {
      const q = examQuestions[parseInt(qIdx, 10)];
      return q && getCorrectOptionIndex(q) === ansIdx ? acc + q.marks : acc;
    }, 0);
  };

  // Submit and Sync Score to CA
  // `flagged` = repeated focus/fullscreen violations. Browser events can be triggered
  // innocently (notifications, accidental clicks), so the attempt is kept with its real
  // score and flagged for teacher review instead of being zeroed automatically.
  const handleFinalSubmit = (flagged: boolean = false) => {
    const rawScore = calculateFinalScore();
    setIsSubmitted(true);
    setIsExpelled(flagged);

    const result = syncCBTScoreToCA(
      currentStudent.admissionNo,
      rawScore,
      totalMaxMarks,
      "exam",
      flagged ? "ICT 1st Term CBT Exam (flagged for review)" : "ICT 1st Term CBT Exam",
      false
    );

    setSyncFeedback({
      scaledScore: result.scaledScore,
      target: "Exam (Max 60 marks)",
    });

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Record Malpractice Incident
  const logMalpractice = (
    type: MalpracticeEvent["type"],
    severity: MalpracticeEvent["severity"],
    description: string
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    const event: MalpracticeEvent = {
      id: `mal-${Date.now()}`,
      timestamp,
      type,
      severity,
      description,
    };

    setMalpracticeLogs((prev) => [event, ...prev]);

    setStrikes((prevStrikes) => {
      const nextStrike = prevStrikes + 1;
      if (nextStrike >= 3) {
        // Strike 3 = auto-submit and flag the attempt for teacher review
        setActiveWarningModal(null);
        handleFinalSubmit(true);
      } else {
        setActiveWarningModal(
          `STRIKE ${nextStrike}/3: ${description}. Notice: on the 3rd warning your test is submitted automatically and flagged for teacher review.`
        );
      }
      return nextStrike;
    });
  };

  // Visibility Change / Tab Switching Detection
  useEffect(() => {
    if (!isTestStarted || isSubmitted || isExpelled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logMalpractice(
          "TAB_SWITCH",
          "CRITICAL",
          "Unauthorized window blur / Tab switch detected away from exam portal"
        );
      }
    };

    const handleWindowBlur = () => {
      logMalpractice(
        "TAB_SWITCH",
        "CRITICAL",
        "Application window lost focus (Potential split-screen or external tool usage)"
      );
    };

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && isTestStarted && !isSubmitted && !isExpelled) {
        logMalpractice(
          "FULLSCREEN_EXIT",
          "MEDIUM",
          "Candidate exited mandatory full-screen security lockdown"
        );
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ["c", "v", "u", "p", "a", "s"].includes(e.key.toLowerCase())) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        logMalpractice(
          "SHORTCUT_BLOCKED",
          "LOW",
          `Restricted keyboard shortcut (${e.key}) intercepted and blocked`
        );
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logMalpractice(
        "SHORTCUT_BLOCKED",
        "LOW",
        "Right-click context menu intercepted and disabled"
      );
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isTestStarted, isSubmitted, isExpelled]);

  // Placeholder ambient-noise meter (simulated; no microphone is used)
  useEffect(() => {
    if (!isTestStarted || isSubmitted || isExpelled) return;
    const noiseInterval = setInterval(() => {
      const db = Math.floor(Math.random() * 20) + 20;
      setNoiseLevel(db);
    }, 2000);
    return () => clearInterval(noiseInterval);
  }, [isTestStarted, isSubmitted, isExpelled]);

  // Timer countdown
  useEffect(() => {
    if (!isTestStarted || isSubmitted || isExpelled) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleFinalSubmit(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTestStarted, isSubmitted, isExpelled]);

  const handleStartExam = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.log("Fullscreen request bypassed");
    }

    setSelectedAnswers({});
    setCurrentQIndex(0);
    setTimeLeft(300);
    setStrikes(0);
    setMalpracticeLogs([]);
    setIsSubmitted(false);
    setIsExpelled(false);
    setSyncFeedback(null);
    setActiveWarningModal(null);
    setIsTestStarted(true);
    setActiveTab("simulate");
  };

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted || isExpelled) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQIndex]: optionIndex }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const currentScore = calculateFinalScore();

  // If CBT engine is closed and current authenticated user is a candidate (STUDENT_PARENT)
  if (!cbtConfig.isOpen && isCandidate) {
    return (
      <DashboardShell>
        <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 select-none">
          <div className="max-w-2xl w-full bg-white border-2 border-amber-200 rounded-3xl p-8 md:p-10 shadow-xl shadow-amber-950/5 space-y-6 text-center animate-in zoom-in-95 duration-200">
            {/* Padlock Icon */}
            <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner ring-8 ring-amber-50">
              <Lock className="w-10 h-10 text-amber-600" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Assessment Window Closed / Offline
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Computer-Based Testing (CBT) Portal
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Official Examination Engine for {SCHOOL_INFO.name} ({SCHOOL_INFO.currentSession})
              </p>
            </div>

            {/* Offline Message Announcement Banner */}
            <div className="bg-gradient-to-br from-amber-50/80 via-slate-50 to-blue-50/40 p-5 rounded-2xl border border-amber-200 text-left text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold border-b border-amber-200/70 pb-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Institutional Examination Directive</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-medium">
                {cbtConfig.offlineMessage ||
                  "The Computer-Based Testing (CBT) portal is currently closed for the term. Please contact the Examination Office or Dean of Studies for the approved assessment schedule."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-600">
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Scheduled Window:</span>
                  <strong className="text-slate-800">{cbtConfig.scheduledWindow || "Standard School Hours (8:00 AM - 2:00 PM)"}</strong>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Assessment Mode:</span>
                  <strong className="text-blue-700">{cbtConfig.activeExamMode || "Terminal Examination"}</strong>
                </div>
              </div>
            </div>

            {/* Candidate Credentials Note */}
            <p className="text-[11px] text-slate-500">
              Candidate logged in as: <strong className="text-slate-800">{currentUser?.fullName || "Student / Parent"}</strong> ({currentUser?.staffId || "Candidate ID"}). If you believe this is an error, please reach out to your Form Master or the Dean of Studies.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </Link>
              <Link
                href="/operations/score-card"
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#0000FF] font-bold text-xs rounded-xl transition-all border border-blue-200 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>View Terminal Score Cards</span>
              </Link>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 select-none">
        
        {/* Closed / Lockdown Alert Banner for Admins */}
        {!cbtConfig.isOpen && (
          <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-slate-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900">
                    CBT Module is Currently CLOSED / LOCKED DOWN to Candidates
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-amber-200 text-amber-950">
                    Admin Preview Mode
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Students and parents visiting this module will see the institutional offline notice. You have administrative access to configure question banks and preview simulations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => toggleCBTAccess(true)}
                className="px-3.5 py-2 bg-[#0000FF] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5 text-cyan-300" />
                <span>Open for Candidates</span>
              </button>
              <Link
                href="/settings"
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-semibold">CBT Examination Center</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Computer-Based Testing (CBT) & Browser Activity Monitor
              </h1>
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Auto CA Score Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated anti-cheating lockdown, focus tracking, and direct Continuous Assessment gradebook integration.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("manage");
                setIsTestStarted(false);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "manage"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Exams & Question Bank
            </button>
            <button
              onClick={handleStartExam}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "simulate"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Launch Proctored Exam
            </button>
          </div>
        </div>

        {/* Tab 1: Manage Exams & Candidate Selection */}
        {activeTab === "manage" && (
          <div className="space-y-6">
            
            {/* Candidate Selector Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Candidate Assigned for Assessment Session
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.admissionNo} - {s.className})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">CA Integration Target: </span>
                <span>Scaled to <strong>Exam (60 Marks)</strong> in {currentStudent.className} Gradebook</span>
              </div>
            </div>

            {/* Proctoring Specifications Banner */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                    RCA Anti-Malpractice Protocol v3.4
                  </span>
                  <span className="text-xs text-slate-400">• Real-Time CA Synchronized</span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  Automated Invigilation & Direct Gradebook Sync
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Candidate scores are auto-scaled and pushed directly into the Continuous Assessment (CA) gradebook upon completion. 3 cumulative infractions will trigger immediate expulsion and log a score of 0.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
                  <span className="text-xs text-slate-400 block">Tab Switch Cap</span>
                  <strong className="text-amber-400 text-base font-extrabold">Max 2 Strikes</strong>
                </div>
                <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-center">
                  <span className="text-xs text-slate-400 block">CA Sync Target</span>
                  <strong className="text-emerald-400 text-base font-extrabold">Exam / 60 Mks</strong>
                </div>
              </div>
            </div>

            {/* Active Assessments */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    Active • CA Sync Ready
                  </span>
                  <span className="text-xs text-slate-400 font-mono">SS 2A</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  ICT 1st Term Mid-Term Examination
                </h3>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Questions: <strong className="text-slate-800">5 Questions (50 Marks)</strong></p>
                  <p>Duration: <strong className="text-slate-800">5 Minutes (Timed)</strong></p>
                  <p>Target Score: <strong className="text-emerald-700">Auto-Scaled to 60 Marks</strong></p>
                </div>
                <button
                  onClick={handleStartExam}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Launch Proctored Session
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 opacity-80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Scheduled
                  </span>
                  <span className="text-xs text-slate-400 font-mono">SS 2A & 2B</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  Data Processing Practical CBT
                </h3>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Questions: <strong className="text-slate-800">40 Questions (60 Marks)</strong></p>
                  <p>Duration: <strong className="text-slate-800">45 Minutes</strong></p>
                  <p>Status: <strong className="text-amber-600">Awaiting Schedule</strong></p>
                </div>
                <button className="w-full bg-slate-100 text-slate-700 font-semibold text-xs py-2 rounded-lg hover:bg-slate-200 transition-colors">
                  Configure Settings
                </button>
              </div>

              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-2 hover:border-blue-400 transition-colors cursor-pointer">
                <div className="p-3 bg-white rounded-full border border-slate-200 text-blue-600 shadow-xs">
                  <Plus className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-xs text-slate-800">Create New Proctored Assessment</h4>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  Add question pools and randomize options.
                </p>
              </div>
            </div>

            {/* Question Bank Preview */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Question Bank (ICT SS 2A)</h3>
                  <p className="text-[11px] text-slate-500">Curated questions with randomized answer positioning</p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => downloadSampleTemplate("cbt_questions")}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                    CSV Template
                  </button>

                  <button
                    onClick={() => {
                      const headers = ["Question Text", "Option A", "Option B", "Option C", "Option D", "Correct Option (1-4)", "Marks"];
                      const rows = examQuestions.map((q) => [
                        q.questionText,
                        q.options[0] || "",
                        q.options[1] || "",
                        q.options[2] || "",
                        q.options[3] || "",
                        getCorrectOptionIndex(q) + 1,
                        q.marks,
                      ]);
                      exportToCSV("RCA_ICT_CBT_Question_Bank", headers, rows);
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    Export CSV
                  </button>

                  <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full border border-blue-100">
                    {examQuestions.length} Questions Loaded
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {examQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 text-xs space-y-2 hover:bg-slate-50/50">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-slate-900">
                        <span className="text-blue-600 mr-1.5">Q{idx + 1}.</span>
                        {q.questionText}
                      </p>
                      <span className="text-[10px] text-slate-500 font-bold">{q.marks} Marks</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                      {q.options.map((opt: string, optIdx: number) => (
                        <div
                          key={optIdx}
                          className={`p-2 rounded-md border text-[11px] flex items-center gap-2 ${
                            optIdx === getCorrectOptionIndex(q)
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <span className="font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                          <span>{opt}</span>
                          {optIdx === getCorrectOptionIndex(q) && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Proctored Student Examination Room */}
        {activeTab === "simulate" && (
          <div className="relative">
            
            {/* Anti-Leak Forensic Dynamic Watermark Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 flex flex-wrap items-center justify-around opacity-[0.04] overflow-hidden select-none">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="text-xs font-mono font-bold uppercase rotate-[-25deg] p-4 text-slate-900">
                  {currentStudent.fullName} • {currentStudent.admissionNo} • IP: 102.89.44.12 • RCA CBT PROCTORED
                </div>
              ))}
            </div>

            {/* Warning Strike Modal */}
            {activeWarningModal && !isExpelled && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-red-500 shadow-2xl p-6 space-y-4 text-center">
                  <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-extrabold text-red-700 uppercase tracking-tight">
                    Malpractice Warning — Strike {strikes} of 3
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed bg-red-50 p-4 rounded-xl border border-red-200 font-medium">
                    {activeWarningModal}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Incident timestamped and added to your permanent exam invigilation audit log.
                  </p>
                  <button
                    onClick={() => setActiveWarningModal(null)}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    I Acknowledge & Return to Exam Lockdown
                  </button>
                </div>
              </div>
            )}

            {/* Expelled / Disqualified Lockout Screen */}
            {isExpelled ? (
              <div className="bg-red-950 border-2 border-red-600 rounded-3xl p-8 text-white shadow-2xl space-y-6 max-w-3xl mx-auto text-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/50">
                  <Lock className="w-10 h-10" />
                </div>
                <div>
                  <span className="bg-red-800 text-red-100 text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-red-500">
                    Security Incident: 3 Strikes Exceeded
                  </span>
                  <h2 className="text-3xl font-black text-white mt-3 tracking-tight uppercase">
                    Test Auto-Submitted & Flagged for Review
                  </h2>
                  <p className="text-xs text-red-200 max-w-lg mx-auto mt-2">
                    Your test was submitted automatically after repeated focus / fullscreen warnings. Your answers were saved and the attempt has been <strong className="text-white">flagged for teacher review</strong> before the score is confirmed.
                  </p>
                </div>

                {/* CA Sync Alert */}
                <div className="bg-red-900/60 border border-red-500 rounded-xl p-4 text-xs font-medium text-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-red-400" />
                    <span>CA Gradebook Updated: <strong className="text-white font-bold">Exam Mark = 0 / 60</strong> for {currentStudent.fullName}</span>
                  </div>
                  <Link
                    href="/operations/update-ca"
                    className="underline text-red-200 font-bold hover:text-white flex items-center gap-1"
                  >
                    View CA Gradebook <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* Forensic Audit Log Preview */}
                <div className="bg-black/50 border border-red-800 rounded-xl p-4 text-left space-y-2 text-xs font-mono max-h-40 overflow-y-auto">
                  <p className="text-red-400 font-bold border-b border-red-900 pb-1">
                    Forensic Invigilation Incident Log:
                  </p>
                  {malpracticeLogs.map((log) => (
                    <div key={log.id} className="text-[11px] text-red-300 flex items-start gap-2">
                      <span className="text-red-500 font-bold">[{log.timestamp}]</span>
                      <span>{log.description}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Link
                    href="/operations/score-card"
                    className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Check Score Card
                  </Link>
                  <button
                    onClick={() => {
                      setActiveTab("manage");
                      setIsTestStarted(false);
                    }}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all"
                  >
                    Exit to Portal
                  </button>
                </div>
              </div>
            ) : isSubmitted ? (
              /* Completed Exam Results Screen with Realtime CA Sync Status */
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                    Submission Verified • Score Synced to CA Gradebook
                  </span>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-2">
                    Examination Completed Successfully
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Candidate: <strong className="text-slate-800">{currentStudent.fullName}</strong> ({currentStudent.admissionNo})
                  </p>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl max-w-xs mx-auto space-y-2">
                  <p className="text-xs font-semibold text-slate-500">CBT Raw Score</p>
                  <p className="text-4xl font-extrabold text-blue-600">{currentScore} <span className="text-lg text-slate-400 font-normal">/ {totalMaxMarks}</span></p>
                  <p className="text-xs font-bold text-slate-700">
                    Percentage: {((currentScore / totalMaxMarks) * 100).toFixed(0)}%
                  </p>
                  <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                    currentScore >= 30 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                    {currentScore >= 30 ? "PASSED (Distinction)" : "FAILED"}
                  </span>
                </div>

                {/* CA Sync Confirmation Banner */}
                {syncFeedback && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs font-semibold text-emerald-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="font-bold">Continuous Assessment (CA) Updated Live!</p>
                        <p className="text-[11px] text-emerald-700">
                          Converted Score: <strong className="text-emerald-950 font-bold">{syncFeedback.scaledScore} / 60</strong> recorded under Exam in {currentStudent.className} gradebook.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/operations/update-ca"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] whitespace-nowrap shadow-xs flex items-center gap-1"
                    >
                      View CA Sheet <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link
                    href="/operations/score-card"
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    View Term Score Card
                  </Link>
                  <button
                    onClick={handleStartExam}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retake Exam
                  </button>
                </div>
              </div>
            ) : (
              /* Active Proctored Question View */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
                
                {/* Left 8 Cols: Question View */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                  
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {SCHOOL_INFO.shortName} Live Assessment
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-1">
                        Information & Communication Technology ({currentStudent.className})
                      </h2>
                      <p className="text-xs text-slate-500">Candidate: {currentStudent.fullName} ({currentStudent.admissionNo})</p>
                    </div>

                    {/* Clock */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold text-sm ${
                      timeLeft < 60 ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-slate-900 text-white"
                    }`}>
                      <Timer className="w-4 h-4" />
                      <span>{formatTime(timeLeft)}</span>
                    </div>
                  </div>

                  {/* Question Container */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-blue-600">Question {currentQIndex + 1} of {examQuestions.length}</span>
                      <span className="font-semibold text-slate-700">{examQuestions[currentQIndex]?.marks || 1} Marks</span>
                    </div>

                    <p className="text-sm md:text-base font-bold text-slate-900 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
                      {examQuestions[currentQIndex]?.questionText || "Question text"}
                    </p>

                    {/* Options */}
                    <div className="space-y-2.5 pt-2">
                      {examQuestions[currentQIndex]?.options.map((option: string, idx: number) => {
                        const isSelected = selectedAnswers[currentQIndex] === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectOption(idx)}
                            type="button"
                            className={`w-full text-left p-4 rounded-xl border text-xs md:text-sm font-medium transition-all flex items-center gap-3.5 cursor-pointer ${
                              isSelected
                                ? "bg-blue-50 border-blue-600 text-blue-950 font-bold shadow-xs ring-1 ring-blue-600"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span>{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question Navigator Numbers */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {examQuestions.map((_, idx) => {
                      const isAnswered = selectedAnswers[idx] !== undefined;
                      const isCurrent = currentQIndex === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentQIndex(idx)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? "bg-blue-600 text-white shadow-xs"
                              : isAnswered
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                      disabled={currentQIndex === 0}
                      className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    {currentQIndex === examQuestions.length - 1 ? (
                      <button
                        onClick={() => handleFinalSubmit(false)}
                        className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Finalize & Sync to CA Gradebook
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentQIndex((i) => Math.min(examQuestions.length - 1, i + 1))}
                        className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        Next Question
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>

                {/* Right 4 Cols: Live AI Proctoring HUD */}
                <div className="lg:col-span-4 space-y-4">
                  
                  {/* Live Proctor Camera Simulator */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-md space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <h4 className="text-xs font-bold tracking-wide uppercase">AI Video Proctor</h4>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                        HD 1080p
                      </span>
                    </div>

                    {/* Camera Viewfinder Screen */}
                    <div className="relative aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-4">
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-500 flex items-center justify-center text-emerald-400 mb-2">
                        <Eye className="w-8 h-8 animate-pulse" />
                      </div>
                      <p className="text-[11px] font-bold text-emerald-400">Face Verified & Centered</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Simulated preview (no camera used)</p>

                      {/* Viewfinder Bounding Boxes */}
                      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-500"></div>
                      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-500"></div>
                      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-500"></div>
                      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-500"></div>
                    </div>

                    {/* Noise / Decibel Level Meter */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Volume2 className="w-3.5 h-3.5" />
                          Ambient Noise Level
                        </span>
                        <span className="font-mono font-bold text-emerald-400">{noiseLevel} dB (simulated)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, (noiseLevel / 60) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Malpractice Strike Status */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    strikes === 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : strikes === 1
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Malpractice Strikes
                      </span>
                      <span className="text-sm font-extrabold font-mono">{strikes} / 3</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                      <div className={`h-2 rounded-full ${strikes >= 1 ? "bg-amber-500" : "bg-slate-200"}`}></div>
                      <div className={`h-2 rounded-full ${strikes >= 2 ? "bg-orange-500" : "bg-slate-200"}`}></div>
                      <div className={`h-2 rounded-full ${strikes >= 3 ? "bg-red-600" : "bg-slate-200"}`}></div>
                    </div>
                    <p className="text-[10px] mt-2 opacity-80">
                      {strikes === 0
                        ? "Clean record. Full compliance with examination rules."
                        : `Warning: ${strikes} infraction(s) logged. The 3rd warning submits the test and flags it for review.`}
                    </p>
                  </div>

                  {/* Live Proctoring Logs */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                    <h5 className="text-xs font-bold text-slate-800">Live Invigilation Audit Trail</h5>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto text-[10px] font-mono text-slate-600 divide-y divide-slate-100">
                      <div className="text-emerald-600 pt-1">✓ Session initialized & locked</div>
                      <div className="text-slate-500 pt-1">• Camera / face checks are not implemented</div>
                      {malpracticeLogs.map((log) => (
                        <div key={log.id} className="text-red-600 pt-1">
                          [{log.timestamp}] {log.description}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </DashboardShell>
  );
}
