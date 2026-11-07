"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  useRealtimeStudents,
  useRealtimeClasses,
  useRealtimeCBTQuestions,
  useRealtimeCBTConfig,
  useRealtimeAuth,
  type CBTQuestionRecord,
  type CBTSittingRecord,
} from "@/lib/realtime-store";
import { fetchCBTSittingsOnServer, recordCBTSittingOnServer, type CBTQuestionInput } from "@/lib/supabase/db";
import { exportToCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import { QuestionDesk } from "@/components/cbt/question-desk";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Timer,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  AlertTriangle,
  Lock,
  Unlock,
  Download,
  FileDown,
  Printer,
  ArrowUpRight,
  Database,
  Settings,
} from "lucide-react";

interface MalpracticeEvent {
  id: string;
  timestamp: string;
  type: "TAB_SWITCH" | "FULLSCREEN_EXIT" | "SHORTCUT_BLOCKED" | "AUDIO_SPIKE" | "GAZE_AWAY";
  severity: "LOW" | "MEDIUM" | "CRITICAL";
  description: string;
}

/** When a record was written, as the school's own timestamp states it. */
function formatRecordedAt(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime())
    ? "no date on the record"
    : at.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Said where an empty bank would otherwise look like a paper.
 *
 * The engine used to fill itself from five ICT questions typed into this file,
 * answers included, so a browser with nothing imported examined a child on
 * questions the school never set — and the answers were in the source anybody
 * could open. That is why an empty bank stops a sitting instead of papering over
 * it.
 */
function EmptyBankNotice({ onDevice }: { onDevice: boolean }) {
  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs leading-relaxed font-medium">
      <span className="font-black uppercase tracking-wider">No paper on the school&apos;s bank.</span>{" "}
      {onDevice
        ? "This browser has no copy of the school's question bank either, so there is nothing to sit. A sitting with no questions is not a short exam, it is no exam."
        : "The school's exam bank was read and it is empty: nobody has filed a question yet. Set a paper below, or import one with the CSV template."}
    </div>
  );
}

export default function ProctoredCBTPage() {
  const { students } = useRealtimeStudents();
  const { classes, classesSource } = useRealtimeClasses();
  const {
    questions: examQuestions,
    questionsSource,
    addQuestions,
    removeQuestion,
  } = useRealtimeCBTQuestions();
  const { cbtConfig, configSource, toggleCBTAccess } = useRealtimeCBTConfig();
  const { currentUser } = useRealtimeAuth();
  const { config: school } = useSchoolConfig();
  // Only decides whether the closed-window screen also covers this visitor. It
  // used to default an unread login to SUPER_ADMIN, which is the one role the
  // window never closes on — so a browser that had not read a login was handed
  // the staff side of an exam portal that was shut.
  const currentRole = currentUser?.role ?? null;
  const isCandidate = currentRole === "STUDENT_PARENT";
  // The two roles both CBT write routes accept: whoever sets the papers is the
  // same person who opens and shuts the module. Everyone else sits what was set.
  const isExamOffice = currentRole === "SUPER_ADMIN" || currentRole === "EXAM_OFFICER";

  // The school's own name and session, from its records. This heading used to
  // print a name and a session compiled into the portal, so a second campus
  // cloned from this code announced the first campus and a school that had moved
  // into the new session in Settings still examined children under the old one.
  const { session: schoolSession, term: schoolTerm } = effectiveScope(school, {
    session: SCHOOL_INFO.currentSession,
    term: SCHOOL_INFO.currentTerm,
  });
  const schoolName = school?.school_name?.trim() || SCHOOL_INFO.name;
  const schoolShortName = school?.short_name?.trim() || SCHOOL_INFO.shortName;

  const [activeTab, setActiveTab] = useState<"manage" | "simulate">("manage");
  const [bankRefusal, setBankRefusal] = useState<string | null>(null);
  const [switchRefusal, setSwitchRefusal] = useState<string | null>(null);
  const [isSittingBeingFiled, setIsSittingBeingFiled] = useState(false);

  // Selected Candidate
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || "");
  // There was a made-up pupil here — "Enrolled Student, RCA/STD/2025/001, Primary 1" —
  // that stood in whenever the register was empty, so an empty school sat a
  // phantom candidate through a proctored exam and printed its name on the watermark.
  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0] || null;

  // Exam Simulation State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 mins
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isExpelled, setIsExpelled] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ scaledScore: number; target: string } | null>(null);
  // What the school said about the sitting this screen just ended, in its own
  // words. Null means no sitting has been ended on this browser yet.
  const [filingOutcome, setFilingOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  // Attempts already on the school's records for the candidate in the selector.
  const [filedSittings, setFiledSittings] = useState<CBTSittingRecord[] | null>(null);

  // Malpractice & Anti-Cheating Failsafe State
  const [strikes, setStrikes] = useState<number>(0);
  const [malpracticeLogs, setMalpracticeLogs] = useState<MalpracticeEvent[]>([]);
  const [activeWarningModal, setActiveWarningModal] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalMaxMarks = examQuestions.reduce((sum, q) => sum + q.marks, 0);
  const bankSubjects = [...new Set(examQuestions.map((q) => q.subject.trim()).filter(Boolean))];
  const bankSubjectLabel = bankSubjects.length === 0
    ? "Unlabelled question bank"
    : bankSubjects.length > 3
      ? `${bankSubjects.slice(0, 3).join(", ")} and ${bankSubjects.length - 3} more`
      : bankSubjects.join(", ");
  // A mixed paper has no one subject to be filed under, and the records say so
  // rather than borrowing the first subject in the list.
  const sittingSubject = bankSubjects.length === 1 ? bankSubjects[0] : "";
  const bankClasses = [...new Set(examQuestions.map((q) => q.className.trim()).filter(Boolean))];
  const candidateName = currentStudent?.fullName ?? "No candidate chosen";
  const candidateNo = currentStudent?.admissionNo ?? "no admission number";
  const candidateClass = currentStudent?.className ?? "no class on the register";

  const getCorrectOptionIndex = (q: CBTQuestionRecord): number => {
    const stored = q.correctOptionIndex ?? q.correctAnswerIndex;
    return typeof stored === "number" ? stored : 0;
  };

  const calculateFinalScore = () => {
    return Object.entries(selectedAnswers).reduce((acc, [qIdx, ansIdx]) => {
      const q = examQuestions[parseInt(qIdx, 10)];
      return q && getCorrectOptionIndex(q) === ansIdx ? acc + q.marks : acc;
    }, 0);
  };

  // The sitting is graded in the browser, because the browser is what holds the
  // answers — which is why what follows is an attempt on the school's records and
  // not a mark in the gradebook.
  const fileSitting = async (
    rawScore: number,
    expelled: boolean,
    /** The strike count and log as they stand at the moment the sitting ends. */
    incident: { strikes: number; logs: MalpracticeEvent[] }
  ) => {
    if (!currentStudent) return;
    setIsSittingBeingFiled(true);
    const outcome = await recordCBTSittingOnServer({
      admissionNo: currentStudent.admissionNo,
      session: schoolSession,
      term: schoolTerm,
      subject: sittingSubject,
      questionCount: examQuestions.length,
      cbtScore: rawScore,
      maxMarks: totalMaxMarks,
      strikes: incident.strikes,
      isExpelled: expelled,
      malpracticeLogs: incident.logs.map((log) => ({
        type: log.type,
        severity: log.severity,
        description: log.description,
        at: new Date().toISOString(),
      })),
    });
    setIsSittingBeingFiled(false);

    setFilingOutcome(outcome.ok
      ? {
          ok: true,
          text: `Filed on ${candidateName}'s record as an attempt of ${examQuestions.length} question(s), ${rawScore} of ${totalMaxMarks} in ${schoolTerm} ${schoolSession}. It is not a mark: the exam column changes when a teacher or the exam office enters it in CA Entry.`,
        }
      : {
          ok: false,
          text: `This sitting was NOT filed on the school's records: ${outcome.reason ?? "the portal server refused it"}. The ${rawScore} of ${totalMaxMarks} below is this browser's figure alone — write it down and hand it to the office.`,
        });

    if (outcome.ok) {
      const reload = await fetchCBTSittingsOnServer(currentStudent.admissionNo, schoolSession, schoolTerm);
      if (reload) setFiledSittings(reload);
    }
  };

  // End the sitting: grade it here, and file the attempt on the school's records.
  const handleFinalSubmit = async (
    expelled: boolean = false,
    incident: { strikes: number; logs: MalpracticeEvent[] } = { strikes, logs: malpracticeLogs }
  ) => {
    const rawScore = expelled ? 0 : calculateFinalScore();
    setIsSubmitted(true);
    setIsExpelled(expelled);
    setFilingOutcome(null);

    // The figure a person would type into the gradebook's exam column, scaled
    // from this paper's marks to that column's 60. It is shown, never filed: the
    // attempt goes to the school's records, the mark stays a human decision.
    const scaledScore = expelled
      ? 0
      : Math.min(60, Math.round((rawScore / Math.max(1, totalMaxMarks)) * 60));

    setSyncFeedback({
      scaledScore,
      target: "Exam (Max 60 marks)",
    });

    await fileSitting(rawScore, expelled, incident);

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
        // Strike 3 = the sitting ends and is scored 0. The third incident is
        // passed to the filing rather than read off the state, which has not
        // settled yet — a record that left it out would understate what the
        // candidate was warned about.
        setActiveWarningModal(null);
        handleFinalSubmit(true, { strikes: nextStrike, logs: [event, ...malpracticeLogs] });
      } else {
        setActiveWarningModal(
          `STRIKE ${nextStrike}/3: ${description}. Notice: Reaching 3 strikes ends this sitting here and scores it 0 of ${totalMaxMarks}. When it ends the attempt is filed on the school's records with its infractions — it is not filed as a mark, which a teacher or the exam office enters themselves.`
        );
      }
      return nextStrike;
    });
  };

  // The lockdown listeners and the countdown are attached once per phase of a
  // sitting, but the two handlers they call close over the answers as they stood
  // when the effect last ran. Without this, a candidate who answered anything
  // after starting the clock would have had the third strike, or the clock itself,
  // score the sitting against a stale paper. The effects read through the ref, so
  // they always run the current handler.
  const currentHandlers = useRef({ logMalpractice, handleFinalSubmit });
  useEffect(() => {
    currentHandlers.current = { logMalpractice, handleFinalSubmit };
  });

  // Visibility Change / Tab Switching Detection
  useEffect(() => {
    if (!isTestStarted || isSubmitted || isExpelled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        currentHandlers.current.logMalpractice(
          "TAB_SWITCH",
          "CRITICAL",
          "Unauthorized window blur / Tab switch detected away from exam portal"
        );
      }
    };

    const handleWindowBlur = () => {
      currentHandlers.current.logMalpractice(
        "TAB_SWITCH",
        "CRITICAL",
        "Application window lost focus (Potential split-screen or external tool usage)"
      );
    };

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && isTestStarted && !isSubmitted && !isExpelled) {
        currentHandlers.current.logMalpractice(
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
        currentHandlers.current.logMalpractice(
          "SHORTCUT_BLOCKED",
          "LOW",
          `Restricted keyboard shortcut (${e.key}) intercepted and blocked`
        );
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      currentHandlers.current.logMalpractice(
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

  // Timer countdown
  useEffect(() => {
    if (!isTestStarted || isSubmitted || isExpelled) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          currentHandlers.current.handleFinalSubmit(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTestStarted, isSubmitted, isExpelled]);

  const handleStartExam = async () => {
    // A sitting has to belong to somebody. With no pupil on the register
    // there is no candidate, and the launch used to invent one.
    if (!currentStudent) return;
    // And it has to be a paper. With nothing on the bank the engine used to serve
    // five questions written into its own source; now it says there is nothing to
    // sit, because a sitting of an empty paper scores 0 of 0 and looks filed.
    if (examQuestions.length === 0) {
      setBankRefusal(
        `There is no paper to launch. ${
          questionsSource === "server"
            ? "The school's exam bank is empty, so nothing has been filed by the exam office yet."
            : "This browser is showing its own copy of the bank and that copy is empty; the school's bank could not be read."
        }`
      );
      return;
    }
    setBankRefusal(null);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
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
    setFilingOutcome(null);
    setIsTestStarted(true);
    setActiveTab("simulate");
  };

  /**
   * The attempts already on the school's records for the candidate in the
   * selector, in this session and term.
   *
   * Read rather than remembered, so an office machine can see that a sitting has
   * been filed for a child it has never opened — and see nothing at all when the
   * child has not sat anything.
   */
  useEffect(() => {
    if (!currentStudent || !isSupabaseConfigured) return;
    let cancelled = false;
    fetchCBTSittingsOnServer(currentStudent.admissionNo, schoolSession, schoolTerm).then((rows) => {
      if (!cancelled && rows) setFiledSittings(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [currentStudent, schoolSession, schoolTerm]);

  /** Files questions on the school's bank and shows the list the server kept. */
  const handleFileQuestions = async (
    list: Omit<CBTQuestionInput, "id">[]
  ): Promise<{ ok: boolean; saved: number; reason: string | null }> => {
    const outcome = await addQuestions(list);
    if (!outcome.ok) setBankRefusal(outcome.reason ?? "the school did not take these questions");
    else setBankRefusal(null);
    return outcome;
  };

  const handleRemoveQuestion = async (question: CBTQuestionRecord) => {
    const fromSchool = /^\d+$/.test(String(question.id));
    const where = fromSchool
      ? "It comes off the school's exam bank, so no other machine serves it again."
      : "It is only this browser's copy, so removing it changes nothing on the school's records.";
    if (!confirm(`Remove this question — “${question.questionText.slice(0, 80)}”? ${where} It cannot be brought back.`)) return;

    if (!fromSchool) {
      setBankRefusal("This question is not on the school's bank, so there is no record to remove. Reload the page to read the bank again.");
      return;
    }
    const outcome = await removeQuestion(String(question.id));
    setBankRefusal(outcome.ok ? null : outcome.reason ?? "the question was not removed");
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
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white border-2 border-amber-200 rounded-3xl p-8 md:p-10 shadow-xl shadow-amber-950/5 space-y-6 text-center animate-in zoom-in-95 duration-200">
            {/* Padlock Icon */}
            <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl flex items-center justify-center mx-auto shadow-inner ring-8 ring-amber-50">
              <Lock className="w-10 h-10 text-amber-600" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {configSource === "server"
                  ? "Closed by the school — every machine sees this switch"
                  : "Closed on this browser — the school's switch could not be read"}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Computer-Based Testing (CBT) Portal
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Examination Engine for {schoolName} ({schoolSession})
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
                  "The office has not written any wording for this notice. It is set in Settings → CBT Configuration; until then nothing is announced here, and the window stays shut because a module nobody has opened is shut."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-600">
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Scheduled Window:</span>
                  <strong className="text-slate-800">{cbtConfig.scheduledWindow || "Not announced by the school"}</strong>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Assessment Mode:</span>
                  <strong className="text-blue-700">{cbtConfig.activeExamMode || "Not chosen by the school"}</strong>
                </div>
                {cbtConfig.updatedBy && (
                  <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200 sm:col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Switch last moved by:</span>
                    <strong className="text-slate-800">
                      {cbtConfig.updatedBy}
                      {cbtConfig.updatedAt ? ` · ${formatRecordedAt(cbtConfig.updatedAt)}` : ""}
                    </strong>
                  </div>
                )}
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
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-50 hover:bg-blue-100 text-brand-600 font-bold text-xs rounded-xl transition-all border border-blue-200 flex items-center justify-center gap-2"
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
        
        {/* Closed / Lockdown Alert Banner for staff */}
        {!cbtConfig.isOpen && (
          <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-slate-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900">
                      CBT Module is CLOSED to candidates
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-amber-200 text-amber-950">
                      {configSource === "server" ? "The school's switch — every machine" : "This browser only — the school's switch could not be read"}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    {configSource === "server"
                      ? "Candidates reaching this portal are turned away on every machine, and the notice they see is the one filed with the switch. Staff may still set the bank and preview a sitting."
                      : "You may still set the question bank and preview a sitting here, but this state is not the school's: no other machine is being told anything until its switch can be read."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isExamOffice ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const outcome = await toggleCBTAccess(true);
                      setSwitchRefusal(outcome.ok ? null : outcome.reason ?? "the switch was not moved");
                    }}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Open for Candidates</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-600 max-w-[16rem]">
                    Only the exam office or the super admin moves this switch; it stays as the school left it.
                  </span>
                )}
                <Link
                  href="/settings"
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Settings</span>
                </Link>
              </div>
            </div>

            {switchRefusal && (
              <p className="bg-white/80 border border-rose-300 rounded-lg px-3 py-2 text-[11px] font-semibold text-rose-900">
                The module was not opened: {switchRefusal}
              </p>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="flex min-h-6 items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-semibold">CBT Examination Center</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Computer-Based Testing (CBT) &amp; Browser Lockdown
              </h1>
              <span className={`border text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${
                questionsSource === "server"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : "bg-amber-100 text-amber-900 border-amber-300"
              }`}>
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                {questionsSource === "server"
                  ? "The paper comes from the school's records"
                  : "Showing this browser's copy of the bank"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              The anti-cheating lockdown runs inside this browser and so does the marking, which is why the figure below
              is an attempt rather than a mark. The mark itself is filed by a teacher or the exam office in CA Entry,
              never from here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("manage");
                setIsTestStarted(false);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                activeTab === "manage"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Exams & Question Bank
            </button>
            <button
              onClick={handleStartExam}
              disabled={!currentStudent}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === "simulate"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {!currentStudent
                ? "No candidate to examine"
                : examQuestions.length === 0
                  ? "No paper on the bank to sit"
                  : "Launch Proctored Exam"}
            </button>
          </div>
        </div>

        {bankRefusal && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] leading-snug text-amber-950 flex items-start gap-2 print:hidden">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="font-semibold">{bankRefusal}</p>
          </div>
        )}

        <DeviceOnlyNotice what="The marking of a sitting, and the infraction log beside it" />

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
                    disabled={students.length === 0}
                    className="flex-1 min-w-0 max-w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:opacity-60"
                  >
                    {students.length === 0 ? (
                      <option value="">No pupil on the register</option>
                    ) : null}
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.admissionNo} - {s.className})
                      </option>
                    ))}
                  </select>
                </div>
                {students.length === 0 && (
                  <p className="text-[11px] text-amber-800 font-semibold pt-1">
                    Enroll the pupil in Operations → Students first. A sitting needs a real candidate: with nobody on
                    the register there is nobody to examine, and starting one anyway used to print an invented name on
                    the paper.
                  </p>
                )}
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">Score handling: </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                  Marked here, filed as an attempt
                </span>{" "}
                <span>Scaled to <strong>Exam (60 Marks)</strong> for display — a teacher files the mark itself.</span>
              </div>
            </div>

            {/* Proctoring Specifications Banner */}
            <div className="texture-grid-light relative overflow-hidden rounded-2xl border border-white/10 bg-brand-950 p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="relative space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-[0.1em] bg-azure-500/15 text-azure-300 border border-azure-400/25 px-2 py-0.5 rounded">
                    What this sitting watches
                  </span>
                  <span className="text-xs text-white/55">• Nothing but the four events below is watched</span>
                </div>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-white">
                  Automated Invigilation
                </h2>
                <p className="text-xs text-white/70 leading-relaxed">
                  The score is marked in this browser — it holds the answers the paper ships with — and scaled to the
                  exam&apos;s 60-mark weight for display when the candidate finishes. What is filed on the school&apos;s
                  records is the attempt: that figure, the question count and the infractions. The Continuous Assessment
                  gradebook is untouched: a mark on a child&apos;s card is entered by a teacher or the exam office from
                  CA Entry, so that the number on paper can be traced to the person who entered it. 3 cumulative
                  infractions end the attempt and score it 0.
                </p>
              </div>

              <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto md:shrink-0">
                <div className="bg-white/6 border border-white/12 p-3 rounded-xl text-center min-w-[9rem]">
                  <span className="text-xs text-white/55 block">Tab Switch Cap</span>
                  <strong className="text-amber-300 text-base font-extrabold">Max 2 Strikes</strong>
                </div>
                <div className="bg-white/6 border border-white/12 p-3 rounded-xl text-center min-w-[9rem]">
                  <span className="text-xs text-white/55 block">Scaled for display as</span>
                  <strong className="text-emerald-300 text-base font-extrabold">Exam / 60 Mks</strong>
                </div>
              </div>
            </div>

            {/* What the next sitting would be marked out of */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    questionsSource === "server"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {questionsSource === "server" ? "The school\u2019s bank" : "This browser\u2019s copy"}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {bankSubjects.length} subject(s) · {bankClasses.length} arm(s)
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  {examQuestions.length} question{examQuestions.length === 1 ? "" : "s"} would be served
                </h3>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Marks: <strong className="text-slate-800">{totalMaxMarks} in total</strong></p>
                  <p>Paper: <strong className="text-slate-800">{bankSubjectLabel}</strong></p>
                  <p>Target: <strong className="text-emerald-700">Scaled to 60 marks for display</strong></p>
                </div>
                {examQuestions.length === 0 && <EmptyBankNotice onDevice={questionsSource === "device"} />}
                <button
                  onClick={handleStartExam}
                  disabled={!currentStudent || examQuestions.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3 h-3 fill-current" />
                  {!currentStudent
                    ? "Enroll a pupil before launching"
                    : examQuestions.length === 0
                      ? "Nothing to sit until a paper is filed"
                      : "Launch Proctored Session"}
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded w-fit block">
                  What launching does
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Runs every question on the bank, in the order the school&apos;s records return them — the engine has
                  no per-subject or per-class paper, so a bank holding two subjects prints one mixed paper. File a
                  paper per arm and run the arm&apos;s own bank if the papers are to stay separate.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When it ends, the attempt — score, question count, strikes and infractions — is filed on the
                  pupil&apos;s record for {schoolTerm} {schoolSession}. It is not filed as a mark: the exam column
                  changes only when a teacher or the exam office enters it.
                </p>
                {isSittingBeingFiled && (
                  <p className="text-[11px] font-semibold text-slate-500">Filing this attempt…</p>
                )}
              </div>
            </div>

            <QuestionDesk
              canWrite={isExamOffice}
              armNames={classes.map((c) => c.name)}
              armsSource={classesSource}
              onFile={handleFileQuestions}
            />

            {/* The bank the engine will serve. A candidate is not shown it: the
                questions arrive on this screen with their correct options marked,
                which is the paper answered before it is sat. */}
            {isCandidate ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800">The bank is not listed for candidates</p>
                <p>
                  {examQuestions.length} question{examQuestions.length === 1 ? "" : "s"} are on the school&apos;s bank
                  and will be served to you in a sitting. They are not shown here because the list marks which option
                  each question counts, so a paper you could read is a paper you have already answered.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">
                      {questionsSource === "server" ? "The school\u2019s question bank" : "This browser\u2019s copy of the bank"}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {questionsSource === "server"
                        ? `Everything the exam office has filed. The engine has no per-subject paper: it serves these ${examQuestions.length} question${examQuestions.length === 1 ? "" : "s"} in order.`
                        : `The school\u2019s bank could not be read, so this is what this machine is holding. A sitting run from it files an attempt against questions no other machine has.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => downloadSampleTemplate("cbt_questions")}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-slate-500" />
                      CSV Template
                    </button>

                    {isExamOffice && (
                      <button
                        onClick={() => {
                          const headers = [
                            "Subject",
                            "Class Arm",
                            "Question Text",
                            "Option A",
                            "Option B",
                            "Option C",
                            "Option D",
                            "Correct Option (1-4)",
                            "Marks",
                          ];
                          const rows = examQuestions.map((q) => [
                            q.subject,
                            q.className,
                            q.questionText,
                            q.options[0] || "",
                            q.options[1] || "",
                            q.options[2] || "",
                            q.options[3] || "",
                            getCorrectOptionIndex(q) + 1,
                            q.marks,
                          ]);
                          exportToCSV(`${schoolShortName}_CBT_Question_Bank`, headers, rows);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        Export CSV
                      </button>
                    )}

                    <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full border border-blue-100">
                      {examQuestions.length} question{examQuestions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {examQuestions.length === 0 && (
                    <p className="p-4 text-xs text-slate-500">
                      Nothing on the bank. Until the exam office files a paper, there is no sitting to run.
                    </p>
                  )}
                  {examQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 text-xs space-y-2 hover:bg-slate-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold text-slate-900">
                          <span className="text-blue-600 mr-1.5">Q{idx + 1}.</span>
                          {q.questionText}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-slate-500 font-bold">{q.marks} Marks</span>
                          {isExamOffice && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(q)}
                              className="text-[10px] font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {q.subject || "No subject named"} · {q.className || "No class arm named"}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                        {q.options.map((opt: string, optIdx: number) => {
                          const isAnswer = isExamOffice && optIdx === getCorrectOptionIndex(q);
                          return (
                            <div
                              key={optIdx}
                              className={`p-2 rounded-md border text-[11px] flex items-center gap-2 ${
                                isAnswer
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <span className="font-bold">{String.fromCharCode(65 + optIdx)}.</span>
                              <span>{opt}</span>
                              {isAnswer && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What the school already holds for the candidate in the selector */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-sm text-slate-800">
                  Attempt{filedSittings?.length === 1 ? "" : "s"} on the school&apos;s records for {candidateName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isSupabaseConfigured
                    ? `Read from the school's records for ${schoolTerm} ${schoolSession}. These are sittings that ended and were filed, not marks: the gradebook column changes when a teacher or the office enters it.`
                    : "This browser is not connected to the school's database, so nothing here is on the school's records. An attempt filed on this machine stays on it."}
                </p>
              </div>
              {filedSittings === null || filedSittings.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">
                  {filedSittings === null
                    ? "Not read — the sitting list has not come back from the school yet."
                    : `No sitting has been filed for this pupil in ${schoolTerm} ${schoolSession}.`}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filedSittings.map((s) => (
                    <div key={s.id} className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-800">
                          {s.subject || "Mixed paper"} · {s.questionCount} question(s) · {s.cbtScore} of {s.maxMarks}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {formatRecordedAt(s.completedAt)} · {s.strikes} strike(s)
                          {s.isExpelled ? " · ended at the third strike, scored 0" : ""} · not filed as a mark
                        </p>
                      </div>
                      <Link
                        href="/operations/update-ca"
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                      >
                        Enter the mark <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
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
                  {candidateName} • {candidateNo} • {schoolShortName} CBT
                </div>
              ))}
            </div>

            {/* Warning Strike Modal */}
            {activeWarningModal && !isExpelled && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-red-500 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 text-center">
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
              <div className="bg-accent-950 border-2 border-accent-600 rounded-2xl p-8 text-white shadow-2xl space-y-6 max-w-3xl mx-auto text-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-accent-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <Lock className="w-10 h-10" />
                </div>
                <div>
                  <span className="bg-red-800 text-red-100 text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-red-500">
                    Security Incident: 3 Strikes Exceeded
                  </span>
                  <h2 className="text-3xl font-black text-white mt-3 tracking-tight uppercase">
                    Examination Session Terminated & Candidate Expelled
                  </h2>
                  <p className="text-xs text-red-200 max-w-lg mx-auto mt-2">
                    Disqualified from this assessment due to repeated anti-cheat violations. The attempt is scored{" "}
                    <strong className="text-white">0 / {totalMaxMarks}</strong> and is filed on {candidateName}&apos;s
                    record with its {strikes} infractions. It is not filed as a mark — the exam column stays empty until
                    a teacher or the exam office enters what they decide in CA Entry.
                  </p>
                  {filingOutcome && !filingOutcome.ok && (
                    <p className="text-[11px] font-bold text-rose-300 max-w-lg mx-auto mt-2 leading-relaxed">
                      {filingOutcome.text}
                    </p>
                  )}
                </div>

                {/* What the office has to do next */}
                <div className="bg-red-900/60 border border-red-500 rounded-xl p-4 text-xs font-medium text-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-red-400" />
                    <span>
                      No mark entered: <strong className="text-white font-bold">0 / {totalMaxMarks}</strong> for {candidateName} is an
                      attempt on the school&apos;s records, and the gradebook column is a person&apos;s to fill
                    </span>
                  </div>
                  <Link
                    href="/operations/update-ca"
                    className="underline text-red-200 font-bold hover:text-white flex items-center gap-1"
                  >
                    Open CA Entry <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* Forensic Audit Log Preview */}
                <div className="bg-black/50 border border-red-800 rounded-xl p-4 text-left space-y-2 text-xs font-mono max-h-40 overflow-y-auto">
                  <p className="text-red-400 font-bold border-b border-red-900 pb-1">
                    {filingOutcome?.ok
                      ? "Infractions filed with this attempt:"
                      : "Infractions noted on this screen — filed with the attempt only if it reached the school:"}
                  </p>
                  {malpracticeLogs.map((log) => (
                    <div key={log.id} className="text-[11px] text-red-300 flex items-start gap-2">
                      <span className="text-red-500 font-bold">[{log.timestamp}]</span>
                      <span>{log.description}</span>
                    </div>
                  ))}
                  {malpracticeLogs.length === 0 && (
                    <p className="text-[11px] text-red-300">No incident was logged on this browser.</p>
                  )}
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
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    filingOutcome === null
                      ? "bg-slate-100 text-slate-700"
                      : filingOutcome.ok
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-rose-100 text-rose-900"
                  }`}>
                    {filingOutcome === null
                      ? "Filing this attempt\u2026"
                      : filingOutcome.ok
                        ? "Attempt filed on the school\u2019s records \u2022 not yet a mark"
                        : "Attempt NOT filed \u2022 this screen only"}
                  </span>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-2">
                    This sitting is over
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Candidate: <strong className="text-slate-800">{candidateName}</strong> ({candidateNo})
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-lg mx-auto leading-relaxed">
                    {examQuestions.length} question{examQuestions.length === 1 ? "" : "s"} from{" "}
                    {questionsSource === "server"
                      ? `the school\u2019s bank${bankSubjects.length === 1 ? ` (${bankSubjects[0]})` : bankSubjects.length > 1 ? ` (${bankSubjects.length} subjects mixed into one paper)` : ""}`
                      : "this browser\u2019s copy of the bank, which the school\u2019s records could not confirm"}
                    .
                  </p>
                  {filingOutcome && (
                    <p className={`text-[11px] font-semibold mt-2 max-w-lg mx-auto leading-relaxed ${
                      filingOutcome.ok ? "text-emerald-800" : "text-rose-800"
                    }`}>
                      {filingOutcome.text}
                    </p>
                  )}
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl max-w-xs mx-auto space-y-2">
                  <p className="text-xs font-semibold text-slate-500">CBT Raw Score</p>
                  <p className="text-4xl font-extrabold text-blue-600">{currentScore} <span className="text-lg text-slate-400 font-normal">/ {totalMaxMarks}</span></p>
                  <p className="text-xs font-bold text-slate-700">
                    Percentage: {((currentScore / totalMaxMarks) * 100).toFixed(0)}%
                  </p>
                  {/* The old badge called anything at or above 30 raw marks "PASSED
                      (Distinction)" and everything below it "FAILED", whatever the paper was
                      worth and whatever the class's own scale says. A practice run on one
                      laptop cannot hand a pupil a verdict that belongs to the school's
                      grading tier, so the number is shown and judged nowhere. */}
                  <p className="text-[10px] text-slate-500 leading-snug pt-1">
                    No grade is given here. The letter and remark come from this class&apos;s
                    grading scale when a teacher files the mark in CA Entry.
                  </p>
                </div>

                {/* What became of this score. The attempt is on the records; the
                    figure below is what it scales to against the class's own exam
                    weight, which is the number a person then enters. */}
                {syncFeedback && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-semibold text-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      <div>
                        <p className="font-bold">Scaled for the gradebook as {syncFeedback.scaledScore} / 60</p>
                        <p className="text-[11px] text-slate-600 font-normal">
                          Against the {syncFeedback.target} weight. Nobody has entered it: the exam column on{" "}
                          {candidateName}&apos;s card changes when a teacher or the exam office files it in CA Entry.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/operations/update-ca"
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-[11px] whitespace-nowrap shadow-xs flex items-center gap-1"
                    >
                      Open CA Entry <ArrowUpRight className="w-3.5 h-3.5" />
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {schoolShortName} Live Assessment
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-1">
                        {bankSubjectLabel} ({candidateClass})
                      </h2>
                      <p className="text-xs text-slate-500">Candidate: {candidateName} ({candidateNo})</p>
                      {questionsSource === "device" && (
                        <p className="text-[11px] font-bold text-amber-800 mt-1">
                          This browser&apos;s own copy of the bank — the school&apos;s records could not be read, so the
                          paper may not be the one {schoolShortName} set.
                        </p>
                      )}
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
                            className={`w-full text-left p-4 rounded-xl border text-xs md:text-sm font-medium transition-all flex items-start gap-3.5 cursor-pointer ${
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
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
                        Submit and Show the Score
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

                {/* Right 4 Cols: Browser Lockdown HUD */}
                <div className="lg:col-span-4 space-y-4">
                  
                  {/* What this screen actually watches */}
                  <div className="bg-brand-950 border border-white/10 rounded-2xl p-5 text-white shadow-lg space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <h4 className="text-xs font-bold tracking-wide uppercase">Browser Lockdown</h4>
                      </div>
                      <span className="text-[10px] bg-white/10 text-white/75 font-mono px-2 py-0.5 rounded">
                        {isFullscreen ? "Full-screen" : "Not full-screen"}
                      </span>
                    </div>

                    {/* The panel used to show a camera viewfinder stamped "Face Verified &
                        Centered", "Gaze Tracking: Screen Locked", an "HD 1080p" badge and a
                        decibel meter fed by Math.random(). No route in this app ever opens a
                        camera or a microphone, so every one of those readings was invented — and
                        a pupil sat an exam believing their face was being watched. These are the
                        four things this page really detects, because they are the four listeners
                        actually attached. */}
                    <ul className="space-y-1.5 text-[11px] text-white/70">
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        Leaving full-screen while the clock is running
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        Switching tab or losing window focus
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        Copy, paste, print-screen, right-click and F12 — blocked, and logged
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        Three of the above ends this sitting and scores it 0
                      </li>
                    </ul>
                    <p className="text-[10px] leading-relaxed text-white/55 border-t border-white/10 pt-2.5">
                      No camera, microphone, face or gaze check runs here — this portal never asks
                      the browser for that access. The log below is what this browser noticed of the
                      four events above; when the sitting ends it is filed alongside the attempt, so
                      it records what a browser detected, not what an invigilator saw.
                    </p>
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
                        : `Warning: ${strikes} infraction(s) logged. Strike 3 triggers instant expulsion.`}
                    </p>
                  </div>

                  {/* Live Proctoring Logs */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                    <h5 className="text-xs font-bold text-slate-800">Live Invigilation Audit Trail</h5>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto text-[10px] font-mono text-slate-600 divide-y divide-slate-100">
                      <div className="text-emerald-600 pt-1">✓ Session initialized & locked</div>
                      <div className="text-slate-500 pt-1">No camera, face or gaze check — none is asked for</div>
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
