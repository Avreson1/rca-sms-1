"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useSchoolConfig } from "@/lib/school-config";
import {
  useRealtimeStaff,
  useRealtimeClasses,
  useRealtimeSubjects,
  useRealtimeAuth,
  type StaffRecord,
} from "@/lib/realtime-store";
import {
  clearClassTimetableOnServer,
  draftTimetableOnServer,
  fetchTimetableDayShape,
  fetchTimetableFromSupabase,
  fileTimetableBatchOnServer,
  removeTimetableLessonOnServer,
  saveTimetableDayShapeOnServer,
  saveTimetableLessonOnServer,
  type TimetableDayShape,
  type TimetableDraftLesson,
  type TimetableDraftResult,
  type TimetableLessonDraft,
  type TimetableLessonRow,
  type TimetablePlanRow,
} from "@/lib/supabase/db";
import { findAllClashes, isUnassigned, sameTeacher, slotLabel, type TimetableLesson } from "@/lib/timetable/clashes";
import {
  DEFAULT_TIMETABLE_DAYS,
  DEFAULT_TIMETABLE_PERIODS,
  teachablePeriods,
  type TimetablePeriod,
} from "@/lib/timetable/day-shape";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
const TERMS = ["First Term", "Second Term", "Third Term"];
const ALL_DAYS: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** The key the timetable lived under while it was only ever this browser's copy. */
const LEGACY_TIMETABLE_KEY = "rca_timetable_store_v7";

const NO_PERIODS: TimetablePeriod[] = [];
const NO_DAYS: string[] = [];

interface LegacyLesson {
  className?: string;
  day?: string;
  periodIndex?: number;
  periodLabel?: string;
  subject?: string;
  teacherName?: string;
  teacherId?: string;
  room?: string;
}

/**
 * Reads a timetable this browser may still be holding from the version of the
 * screen that saved nothing to the school.
 *
 * It is read once, offered up for filing, and cleared when it lands — so nobody
 * loses a term of planning to an upgrade, and the screen never ends up with two
 * timetables to choose between.
 */
function readLegacyCopy(): LegacyLesson[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(LEGACY_TIMETABLE_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as LegacyLesson[]) : [];
  } catch {
    return [];
  }
}

interface DraftSlot {
  day: Day;
  periodIndex: number;
  periodLabel: string;
}

/** One line of the plan a person writes before asking for a draft. The key is only for the list. */
interface PlanRow extends TimetablePlanRow {
  key: number;
}

const INITIAL_PLAN: PlanRow[] = [{ key: 0, className: "", subject: "", teacherName: "", teacherId: "", periodsWanted: 2 }];

/** Keys for rows added after the screen has mounted, where a module counter is safe. */
let planRowKey = 0;
function blankPlanRow(className: string): PlanRow {
  planRowKey += 1;
  return { key: planRowKey, className, subject: "", teacherName: "", teacherId: "", periodsWanted: 2 };
}

export default function OperationsAcademicsPage() {
  const { staff } = useRealtimeStaff();
  const { classes } = useRealtimeClasses();
  const { subjects } = useRealtimeSubjects();
  const { currentUser } = useRealtimeAuth();
  const { config, usingDefaults } = useSchoolConfig();

  const session = (config?.current_session ?? "").trim() || SCHOOL_INFO.currentSession;
  const schoolTerm = (config?.current_term ?? "").trim() || SCHOOL_INFO.currentTerm;

  const [term, setTerm] = useState<string>(schoolTerm);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"class" | "master" | "workload" | "draft">("class");

  const [lessons, setLessons] = useState<TimetableLessonRow[] | null>(null);
  const [readProblem, setReadProblem] = useState<string | null>(null);
  const [dayShape, setDayShape] = useState<TimetableDayShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "warn"; message: string } | null>(null);

  const [slot, setSlot] = useState<DraftSlot | null>(null);
  const [subjectInput, setSubjectInput] = useState("");
  const [teacherInput, setTeacherInput] = useState("");
  const [roomInput, setRoomInput] = useState("");

  const [legacyCopy, setLegacyCopy] = useState<LegacyLesson[]>([]);

  const [shapeDraft, setShapeDraft] = useState<{ periods: TimetablePeriod[]; days: Day[] } | null>(null);

  const [plan, setPlan] = useState<PlanRow[]>(INITIAL_PLAN);
  const [capInput, setCapInput] = useState("");
  /** The week the portal proposed, and the session and term it was proposed for. */
  const [draft, setDraft] = useState<{ scope: string; result: TimetableDraftResult } | null>(null);
  const [drafting, setDrafting] = useState(false);

  const canWrite = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  // The screen opens on whatever term the school's own record says it is in, and
  // keeps following that record until the person reading the grid picks a different
  // term themselves. The compiled value is only reached when the record could not
  // be read, and the banner below says which of the two is being used — a timetable
  // printed under the wrong term is worse than no timetable.
  const [termTouched, setTermTouched] = useState(false);
  useEffect(() => {
    if (!termTouched && schoolTerm) setTerm(schoolTerm);
  }, [schoolTerm, termTouched]);

  useEffect(() => {
    if (!selectedClass && classes.length > 0) setSelectedClass(classes[0].name);
  }, [classes, selectedClass]);

  useEffect(() => {
    setLegacyCopy(readLegacyCopy());
  }, []);

  const load = useCallback(async () => {
    if (!term) return;
    setLoading(true);
    const [grid, shape] = await Promise.all([fetchTimetableFromSupabase({ session, term }), fetchTimetableDayShape(session, term)]);
    setLessons(grid.rows);
    setReadProblem(grid.reason);
    setDayShape(shape);
    setLoading(false);
  }, [session, term]);

  useEffect(() => {
    void load();
  }, [load]);

  const periods = dayShape?.periods ?? NO_PERIODS;
  const days = (dayShape?.days ?? NO_DAYS) as Day[];
  const slots = useMemo(() => teachablePeriods(periods), [periods]);
  const weeklyCapacity = slots.length * days.length;

  // A draft is a proposal for one session and one term. Once either changes, what is
  // on the screen is a plan for a different week, and filing it into the new one
  // would be a mistake the portal made easy to make.
  const scopedDraft = draft && draft.scope === `${session}|${term}` ? draft.result : null;

  const classLessons = useMemo(
    () => (lessons ?? []).filter((lesson) => lesson.className === selectedClass),
    [lessons, selectedClass]
  );

  const lessonFor = (day: Day, periodIndex: number) =>
    classLessons.find((lesson) => lesson.day === day && lesson.periodIndex === periodIndex);

  const openSlot = (day: Day, periodIndex: number) => {
    const label = periods.find((period) => period.index === periodIndex)?.label ?? `Period ${periodIndex + 1}`;
    setSlot({ day, periodIndex, periodLabel: label });
    setSubjectInput("");
    setTeacherInput("");
    setRoomInput(selectedClass);
  };

  const handleFileLesson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!slot || !selectedClass) return;
    setBusy(true);

    const newLesson: TimetableLessonDraft = {
      session,
      term,
      className: selectedClass,
      day: slot.day,
      periodIndex: slot.periodIndex,
      periodLabel: slot.periodLabel,
      subject: subjectInput.trim(),
      teacherName: teacherInput.trim(),
      teacherId: staff.find((member) => member.fullName === teacherInput)?.staffId ?? "",
      room: roomInput.trim(),
    };

    const result = await saveTimetableLessonOnServer(newLesson);
    if (result.ok) {
      setOutcome({
        tone: "ok",
        message: `${selectedClass} · ${slot.day} · ${slot.periodLabel}: ${newLesson.subject}${
          newLesson.teacherName && !isUnassigned(newLesson.teacherName, newLesson.teacherId) ? ` with ${newLesson.teacherName}` : " (no teacher named yet)"
        } is on the school's timetable${result.replaced ? " (replacing what was in that slot)" : ""}.`,
      });
      setSlot(null);
      await load();
    } else {
      setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not take the lesson." });
    }
    setBusy(false);
  };

  const handleRemoveLesson = async (lesson: TimetableLessonRow) => {
    if (!window.confirm(`Remove ${lesson.subject} from ${lesson.className}, ${lesson.day}, ${lesson.periodLabel || `Period ${lesson.periodIndex + 1}`}?`)) return;
    setBusy(true);
    const result = await removeTimetableLessonOnServer(lesson.id);
    if (result.ok) {
      setOutcome({ tone: "ok", message: `That slot in ${lesson.className} is empty again on the school's timetable.` });
      await load();
    } else {
      setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not remove the lesson." });
    }
    setBusy(false);
  };

  const handleClearClass = async () => {
    if (!selectedClass) return;
    const count = classLessons.length;
    if (!window.confirm(`Clear all ${count} scheduled period(s) for ${selectedClass} in ${term}, ${session}? The lessons come off the school's timetable and cannot be brought back.`)) return;
    setBusy(true);
    const result = await clearClassTimetableOnServer({ session, term, className: selectedClass });
    if (result.ok) {
      setOutcome({ tone: "ok", message: `${result.removed} lesson(s) were taken off ${selectedClass}'s timetable.` });
      await load();
    } else {
      setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not clear that class." });
    }
    setBusy(false);
  };

  /**
   * Files the copy this browser is holding, into the school's timetable.
   *
   * The server answers with what landed and a reason for every row it would not
   * take, so a double-booked teacher in the old copy stops that one lesson and
   * names it instead of losing the rest of the term's work.
   */
  const handleCarryOver = async () => {
    if (legacyCopy.length === 0) return;
    setBusy(true);
    const entries: TimetableLessonDraft[] = legacyCopy.map((lesson) => ({
      session,
      term,
      className: (lesson.className ?? "").trim(),
      day: (lesson.day ?? "").trim(),
      periodIndex: Number(lesson.periodIndex) || 0,
      periodLabel: lesson.periodLabel ?? "",
      subject: (lesson.subject ?? "").trim(),
      teacherName: lesson.teacherName ?? "",
      teacherId: lesson.teacherId ?? "",
      room: lesson.room ?? "",
    }));

    const result = await fileTimetableBatchOnServer({ session, term }, entries);
    if (result.filed > 0) {
      window.localStorage.removeItem(LEGACY_TIMETABLE_KEY);
      setLegacyCopy([]);
    }

    const refusedText =
      result.refused.length > 0
        ? ` ${result.refused.length} could not be filed: ${result.refused
            .slice(0, 3)
            .map((row) => `${row.className || "?"} · ${row.day || "?"} · ${row.subject || "?"} — ${row.reason}`)
            .join(" / ")}${result.refused.length > 3 ? ` (and ${result.refused.length - 3} more)` : ""}`
        : "";

    setOutcome({
      tone: result.filed > 0 && result.refused.length === 0 ? "ok" : "warn",
      message: result.filed > 0
        ? `${result.filed} of ${entries.length} period(s) from this browser are now on the school's timetable for ${term}, ${session}.${refusedText}`
        : `Nothing was filed from this browser's copy: ${result.reason ?? result.refused[0]?.reason ?? "the school's records refused every row."}${refusedText}`,
    });
    await load();
    setBusy(false);
  };

  /**
   * Opens the day the school teaches, prefilled from what is on the record — or,
   * when nothing is on the record, from the shape the portal prints by default,
   * which the panel itself says out loud rather than passing off as a choice.
   */
  const openShapeEditor = () => {
    setShapeDraft({
      periods: (dayShape?.periods ?? DEFAULT_TIMETABLE_PERIODS).map((period) => ({ ...period })),
      days: ((dayShape?.days?.length ? dayShape.days : DEFAULT_TIMETABLE_DAYS) as Day[]).map((day) => day),
    });
  };

  const handleFileDayShape = async () => {
    if (!shapeDraft) return;
    setBusy(true);
    const result = await saveTimetableDayShapeOnServer({ session, term, periods: shapeDraft.periods, days: shapeDraft.days });
    if (result.ok) {
      const teaching = shapeDraft.periods.filter((period) => !period.is_break).length;
      setOutcome({
        tone: "ok",
        message: `${term}, ${session} now runs ${teaching} teaching period(s) on ${shapeDraft.days.join(", ")} — ${teaching * shapeDraft.days.length} slots a week, filed as the school's own day.`,
      });
      setShapeDraft(null);
      await load();
    } else {
      setOutcome({ tone: "warn", message: result.reason ?? "The school's records did not take that day." });
    }
    setBusy(false);
  };

  /**
   * Asks the portal to place the plan into the school's week.
   *
   * The plan is what a person wrote; the placement is what the machine decides. This
   * call saves nothing — the draft comes back on the screen to be read, and only a
   * separate, deliberate filing puts it on the timetable.
   */
  const handleDraft = async () => {
    const cap = capInput.trim() === "" ? null : Math.trunc(Number(capInput));
    if (cap !== null && (!Number.isFinite(cap) || cap < 1)) {
      setOutcome({ tone: "warn", message: "The limit for one teacher must be a whole number of periods, or blank to mean no limit." });
      return;
    }

    const demands: TimetablePlanRow[] = plan
      .map((row) => {
        const teacherName = (row.teacherName ?? "").trim();
        const member = staff.find((someone) => someone.fullName === teacherName);
        return {
          className: row.className.trim(),
          subject: row.subject.trim(),
          teacherName,
          // The staff id is taken from the school's own staff file, so two spellings of
          // one name are one teacher to the clash rule and to the load limit.
          teacherId: member?.staffId ?? "",
          periodsWanted: Math.trunc(Number(row.periodsWanted)) || 0,
        };
      })
      .filter((row) => row.className && row.subject.length >= 2 && row.periodsWanted > 0);

    if (demands.length === 0) {
      setOutcome({
        tone: "warn",
        message: "The plan has nothing in it yet. Each line needs a class arm, a subject of at least two letters, and at least one period wanted.",
      });
      return;
    }

    setDrafting(true);
    const result = await draftTimetableOnServer({ session, term, plan: demands, maxPeriodsPerTeacher: cap });
    setDraft({ scope: `${session}|${term}`, result });
    if (!result.ok) {
      setOutcome({ tone: "warn", message: result.reason ?? "The draft could not be built." });
    } else {
      const placed = result.lessons.filter((lesson) => !lesson.onSchoolRecord).length;
      setOutcome({
        tone: result.unplaced.length === 0 ? "ok" : "warn",
        message:
          placed === 0
            ? `The plan's ${demands.length} line(s) placed no lesson at all. The first reason is listed under “what did not fit” below.`
            : `${placed} lesson(s) drafted for ${term}, ${session}. Nothing is on the timetable yet — read it, then file it or change the plan.`,
      });
    }
    setDrafting(false);
  };

  /**
   * Files the draft. The school's clash rule judges every row again, from the
   * records as they are now rather than as they were when the draft was built —
   * so a lesson someone filed by hand in the meantime is refused by name instead of
   * quietly overwritten.
   */
  const handleFileDraft = async () => {
    const rows = (scopedDraft?.lessons ?? []).filter((lesson) => !lesson.onSchoolRecord);
    if (rows.length === 0) return;
    if (
      !window.confirm(
        `File ${rows.length} drafted lesson(s) into ${term}, ${session}? The ${
          (scopedDraft?.lessons ?? []).length - rows.length
        } lesson(s) already on the school's timetable are left where they are. This cannot be undone as a block — lessons come back out one slot at a time.`
      )
    )
      return;

    setBusy(true);
    const entries: TimetableLessonDraft[] = rows.map((lesson) => ({
      session,
      term,
      className: lesson.class_name,
      day: lesson.day,
      periodIndex: lesson.period_index,
      periodLabel: lesson.period_label,
      subject: lesson.subject,
      teacherName: lesson.teacher_name,
      teacherId: lesson.teacher_ref ?? "",
      room: "",
    }));

    const result = await fileTimetableBatchOnServer({ session, term }, entries);
    const refusedText =
      result.refused.length > 0
        ? ` Refused: ${result.refused
            .slice(0, 3)
            .map((row) => `${row.className} · ${row.day} · ${row.subject} — ${row.reason}`)
            .join(" / ")}${result.refused.length > 3 ? ` (and ${result.refused.length - 3} more)` : ""}`
        : "";
    setOutcome({
      tone: result.filed > 0 && result.refused.length === 0 ? "ok" : "warn",
      message: result.filed > 0
        ? `${result.filed} of ${entries.length} drafted lesson(s) are now on the school's timetable for ${term}, ${session}.${refusedText}`
        : `None of the ${entries.length} drafted lesson(s) were filed: ${result.reason ?? refusedText}`,
    });
    setDraft(null);
    await load();
    setBusy(false);
  };

  const draftProposed = useMemo(
    () => (scopedDraft?.lessons ?? []).filter((lesson) => !lesson.onSchoolRecord),
    [scopedDraft]
  );

  /** The drafted week, one arm at a time, in the order a person reads a grid. */
  const draftByClass = useMemo(() => {
    const dayOrder = days.length > 0 ? days : (DEFAULT_TIMETABLE_DAYS as Day[]);
    const groups = new Map<string, TimetableDraftLesson[]>();
    for (const lesson of draftProposed) {
      const list = groups.get(lesson.class_name) ?? [];
      list.push(lesson);
      groups.set(lesson.class_name, list);
    }
    return [...groups.entries()]
      .map(([className, rows]) => ({
        className,
        rows: rows.sort(
          (a, b) =>
            dayOrder.indexOf(a.day as Day) - dayOrder.indexOf(b.day as Day) || a.period_index - b.period_index
        ),
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [draftProposed, days]);

  const draftEmptyByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of scopedDraft?.emptySlots ?? []) {
      counts.set(slot.class_name, (counts.get(slot.class_name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [scopedDraft]);

  // The clash list is computed by the school's own rule, imported rather than
  // re-typed here, so the warning printed under a grid is the same test the save
  // button is judged by. Two rules is how a clash sits unnoticed until a class
  // arrives empty.
  const clashes = useMemo(() => {
    if (!lessons) return [];
    const shaped: TimetableLesson[] = lessons.map((lesson) => ({
      session: lesson.session,
      term: lesson.term,
      class_name: lesson.className,
      day: lesson.day,
      period_index: lesson.periodIndex,
      period_label: lesson.periodLabel,
      subject: lesson.subject,
      teacher_name: lesson.teacherName,
      teacher_ref: lesson.teacherId || null,
    }));
    return findAllClashes(shaped);
  }, [lessons]);

  const workload = useMemo(
    () =>
      staff.map((member: StaffRecord) => {
        const held = (lessons ?? []).filter((lesson) =>
          sameTeacher({ teacher_name: lesson.teacherName, teacher_ref: lesson.teacherId || null }, { teacher_name: member.fullName, teacher_ref: member.staffId })
        );
        const byName = held.some((lesson) => !lesson.teacherId);
        return { member, periods: held.length, matchedByName: byName };
      }),
    [staff, lessons]
  );

  const unassignedCount = classLessons.filter((lesson) => isUnassigned(lesson.teacherName, lesson.teacherId || null)).length;

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
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Academic Operations &amp; Master Timetable
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Class schedules and faculty workloads for {config?.school_name?.trim() || SCHOOL_INFO.name}.{" "}
              {readProblem
                ? "The grid below could not be read from the school's records, so nothing is being shown in its place."
                : (
                  <>
                    Every lesson below was read from the school&apos;s own records for{" "}
                    <strong className="text-slate-700">
                      {session}, {term}
                    </strong>
                    .
                  </>
                )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={term}
              onChange={(event) => {
                setTermTouched(true);
                setTerm(event.target.value);
              }}
              className="text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold text-blue-900 outline-none cursor-pointer"
              title="A timetable is a term's document. This one is filed under the term chosen here."
            >
              {TERMS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Reading…" : "Refresh"}
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              Print Schedule
            </button>
            {canWrite && (
              <button
                onClick={openShapeEditor}
                disabled={busy}
                className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="How many periods a school day has, where the breaks sit and which weekdays are taught."
              >
                <Clock className="w-4 h-4 text-purple-600" />
                Set the school&apos;s day
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => selectedClass && openSlot(days[0] ?? "Monday", slots[0]?.index ?? 0)}
                disabled={!selectedClass || slots.length === 0}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Schedule Class Period
              </button>
            )}
          </div>
        </div>

        {/* Whether the grid could be read at all, and which day shape is being printed. */}
        <div className="grid gap-2">
          <div
            className={`rounded-xl border p-3 text-[11px] leading-snug flex items-start gap-2 print:hidden ${
              readProblem
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
            role="status"
          >
            {readProblem ? <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
            <p>
              {readProblem ? (
                <>
                  <strong>The timetable could not be read.</strong> {readProblem}. Nothing is printed below in place of
                  it — a schedule that showed an empty week because the read failed would send a whole class to the wrong
                  room. Run <code className="font-mono">supabase/timetable.sql</code> if this project has never had the
                  grid set up.
                </>
              ) : (
                <>
                  <strong>{lessons?.length ?? 0} lesson(s) read from the school&apos;s records.</strong> This is the grid
                  every machine sees, not this browser&apos;s copy of it. An empty slot is a slot nobody has filled.
                </>
              )}
            </p>
          </div>

          {dayShape && (
            <p className="text-[11px] text-slate-500">
              {dayShape.fromSchoolRecords ? (
                <>
                  Day shape: <strong>{slots.length} teaching period(s) × {dayShape.days.length} days</strong> ={" "}
                  {slots.length * dayShape.days.length} slots a week, as the school filed it for {term}.
                </>
              ) : (
                <>
                  Day shape: the {slots.length} periods the portal ships with, over {dayShape.days.length} days — the
                  school has not filed its own. Nothing here claims the office chose them.
                </>
              )}
            </p>
          )}

          {shapeDraft && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 print:hidden">
              <div className="flex items-start gap-2 text-[11px] leading-snug text-slate-700">
                <Clock className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>The day {term} is taught on.</strong> This decides how many lessons a class can hold and what
                  the printed grid looks like.{" "}
                  {dayShape?.fromSchoolRecords
                    ? "It opened with the day the school filed for this term."
                    : "It opened with the periods the portal ships with, because the school has not filed a day yet — changing nothing and saving would put that shape on the record under the school's name."}{" "}
                  A period cannot be removed while a lesson still sits in it; the school refuses that save and names the
                  lessons.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">Weekdays taught:</span>
                {ALL_DAYS.map((day) => {
                  const on = shapeDraft.days.includes(day);
                  return (
                    <label key={day} className="flex items-center gap-1 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(event) =>
                          setShapeDraft({
                            ...shapeDraft,
                            days: event.target.checked
                              ? ALL_DAYS.filter((name) => shapeDraft.days.includes(name) || name === day)
                              : shapeDraft.days.filter((name) => name !== day),
                          })
                        }
                      />
                      {day}
                    </label>
                  );
                })}
                <span className="text-[11px] text-slate-500">
                  {shapeDraft.days.length === 0
                    ? "No weekday is ticked, so nothing can be saved."
                    : `${shapeDraft.days.length} day(s) a week`}
                </span>
              </div>

              <div className="space-y-1.5">
                {shapeDraft.periods.map((period, position) => (
                  <div key={`${period.index}-${position}`} className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="number"
                      min={period.is_break ? undefined : 0}
                      max={period.is_break ? undefined : 11}
                      value={period.index}
                      disabled={period.is_break}
                      onChange={(event) => {
                        const periods = [...shapeDraft.periods];
                        periods[position] = { ...period, index: Math.trunc(Number(event.target.value)) };
                        setShapeDraft({ ...shapeDraft, periods });
                      }}
                      className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-center disabled:text-slate-400"
                      title={period.is_break ? "A break is not a slot, so its position does not matter" : "Position in the day, from 0"}
                    />
                    <input
                      type="text"
                      value={period.label}
                      onChange={(event) => {
                        const periods = [...shapeDraft.periods];
                        periods[position] = { ...period, label: event.target.value };
                        setShapeDraft({ ...shapeDraft, periods });
                      }}
                      className="flex-1 min-w-40 p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold"
                      placeholder="Period 1 (08:00 - 08:45 AM)"
                    />
                    <label className="flex items-center gap-1 text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(period.is_break)}
                        onChange={(event) => {
                          const periods = [...shapeDraft.periods];
                          const isBreak = event.target.checked;
                          periods[position] = isBreak
                            ? { index: -1 - position, label: period.label, is_break: true }
                            : { index: periods.filter((row) => !row.is_break && row !== period).length, label: period.label };
                          setShapeDraft({ ...shapeDraft, periods });
                        }}
                      />
                      break
                    </label>
                    <button
                      type="button"
                      onClick={() => setShapeDraft({ ...shapeDraft, periods: shapeDraft.periods.filter((_, i) => i !== position) })}
                      className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                      title="Take this entry out of the day"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setShapeDraft({
                      ...shapeDraft,
                      periods: [
                        ...shapeDraft.periods,
                        { index: shapeDraft.periods.filter((row) => !row.is_break).length, label: "" },
                      ],
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add period
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setShapeDraft({
                      ...shapeDraft,
                      periods: [...shapeDraft.periods, { index: -1 - shapeDraft.periods.length, label: "Break", is_break: true }],
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add break
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShapeDraft(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleFileDayShape()}
                  disabled={busy || shapeDraft.days.length === 0}
                  className="px-4 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  {busy ? "Filing…" : "File this day on the school's records"}
                </button>
              </div>
            </div>
          )}

          {usingDefaults && (
            <p className="text-[11px] text-amber-800">
              The school&apos;s current session and term could not be read, so the grid is opened at{" "}
              <strong>
                {session}, {term}
              </strong>{" "}
              from the values compiled into the portal. Check that before filing anything into it.
            </p>
          )}

          {legacyCopy.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-[11px] leading-snug text-sky-950 flex items-start gap-2 print:hidden">
              <Upload className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p>
                  <strong>This browser is still holding {legacyCopy.length} period(s)</strong> from the version of this
                  screen that saved to nothing but itself. They are not on the school&apos;s timetable yet. File them
                  under <strong>{term}, {session}</strong> — the school&apos;s rule that a teacher is in one class at a
                  time will be applied, and anything that clashes is named rather than dropped.
                </p>
                <button
                  onClick={() => void handleCarryOver()}
                  disabled={busy}
                  className="px-3.5 py-2 text-xs font-bold bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {busy ? "Filing…" : `Carry these ${legacyCopy.length} period(s) into the school's records`}
                </button>
              </div>
            </div>
          )}

          {/* The arms themselves are still typed into this browser, so the grid can
              only be grouped by names the school has not filed. */}
          <DeviceOnlyNotice what="The class-arm list" />

          {clashes.length > 0 && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-[11px] leading-snug text-rose-950 space-y-1 print:hidden">
              <p className="flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
                <strong>{clashes.length} teacher(s) are in two classes at the same time on this timetable.</strong> The
                school saves a lesson into one empty slot at a time, so these came in through the older browser copy or
                a name that does not match the staff file. Fix them before the schedule is printed.
              </p>
              <ul className="list-disc pl-6 space-y-0.5">
                {clashes.slice(0, 8).map((pair, index) => (
                  <li key={index}>
                    {pair[0].teacher_name || pair[0].teacher_ref}: {slotLabel(pair[0])} and {slotLabel(pair[1])}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {outcome && (
            <div
              className={`rounded-xl border p-3 text-xs font-semibold flex items-start gap-2 print:hidden ${
                outcome.tone === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-950" : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
              role="status"
            >
              {outcome.tone === "ok" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              )}
              <p>{outcome.message}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
          <button
            onClick={() => setActiveTab("class")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "class" ? "bg-slate-900 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Class Arm Timetable ({classLessons.length} scheduled)
          </button>
          {canWrite && (
            <button
              onClick={() => setActiveTab("master")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "master" ? "bg-slate-900 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Master Institutional Schedule ({lessons?.length ?? 0} lessons)
            </button>
          )}
          <button
            onClick={() => setActiveTab("workload")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "workload" ? "bg-slate-900 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Faculty Workload Matrix ({staff.length} instructors)
          </button>
          <button
            onClick={() => setActiveTab("draft")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "draft" ? "bg-slate-900 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Draft The Week{scopedDraft && draftProposed.length > 0 ? ` (${draftProposed.length} proposed)` : ""}
          </button>
        </div>

        {/* Tab 1: one class arm */}
        {activeTab === "class" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 border border-slate-200 rounded-xl shadow-xs print:hidden">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-xs font-bold text-slate-700">Class arm:</span>
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="min-w-0 max-w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-blue-900 outline-none"
                >
                  {classes.map((arm) => (
                    <option key={arm.id} value={arm.name}>
                      {arm.name} ({arm.section})
                    </option>
                  ))}
                </select>

                {canWrite && classLessons.length > 0 && (
                  <button
                    onClick={() => void handleClearClass()}
                    disabled={busy}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 ml-2 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Class Schedule
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500">
                Session: <strong className="text-slate-800">{session}</strong> • Term:{" "}
                <strong className="text-blue-700">{term}</strong>
                {unassignedCount > 0 && (
                  <span className="ml-2 text-amber-700 font-semibold">
                    {unassignedCount} slot{unassignedCount === 1 ? "" : "s"} with no teacher named
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Official Timetable: {selectedClass || "no class chosen"}</h3>
                  <p className="text-[11px] text-slate-500">
                    {config?.school_name?.trim() || SCHOOL_INFO.name} • {session}, {term}
                  </p>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {readProblem
                    ? "not read"
                    : `${classLessons.length} filled of ${slots.length * (days.length || 5)}`}
                </span>
              </div>

              {readProblem ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-bold text-slate-700">The lessons for {term} could not be read</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    An empty grid would read the same as an unfilled week and send a class to the wrong room, so
                    nothing is printed here until the read works. {readProblem}.
                  </p>
                </div>
              ) : slots.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-bold text-slate-700">No day structure to print</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    The school has filed no periods for this term, and the fallback shape came back empty.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-3 px-4 w-48">Period / Time</th>
                        {days.map((day) => (
                          <th key={day} className="py-3 px-3">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periods.map((period) => {
                        if (period.is_break) {
                          return (
                            <tr key={period.index} className="bg-amber-50/50 font-semibold text-amber-900 text-center">
                              <td className="py-2.5 px-4 font-mono text-left">{period.label}</td>
                              <td colSpan={days.length || 5} className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-amber-800">
                                Intermission / Break
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={period.index} className="hover:bg-blue-50/20">
                            <td className="py-3 px-4 font-mono font-semibold text-slate-600">{period.label}</td>
                            {days.map((day) => {
                              const lesson = lessonFor(day, period.index);
                              return (
                                <td key={day} className="py-2.5 px-3">
                                  {lesson ? (
                                    <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-200/80 space-y-0.5 relative group">
                                      <p className="font-bold text-blue-950 text-xs">{lesson.subject}</p>
                                      <p className="text-[10px] text-slate-600 font-medium">
                                        {lesson.teacherName || <span className="text-amber-700">no teacher named</span>}
                                      </p>
                                      {lesson.room && <p className="text-[10px] text-slate-400">{lesson.room}</p>}
                                      {canWrite && (
                                        <button
                                          onClick={() => void handleRemoveLesson(lesson)}
                                          className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-rose-600 hover:text-rose-800 transition-opacity cursor-pointer"
                                          title="Take this lesson off the timetable"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ) : canWrite ? (
                                    <button
                                      onClick={() => openSlot(day, period.index)}
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
              )}

              {classLessons.length === 0 && slots.length > 0 && !readProblem && (
                <div className="p-8 text-center bg-slate-50/50 border-t border-slate-100">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Nothing is scheduled for {selectedClass} this term</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {canWrite
                      ? "Pick any empty slot above, or use Schedule Class Period. The grid is read from the school's records, so this really is an unfilled week."
                      : "No lessons have been filed for this class on the school's timetable."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: every class arm at once */}
        {activeTab === "master" && canWrite && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                  Institutional Master Schedule
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Master Allocation Matrix Across All Class Arms</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Every lesson filed for {term}, {session}, counted per class arm on the school&apos;s records.
                </p>
              </div>
              <button
                onClick={() => window.print()}
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
                      <th className="py-3 px-3">Subjects Scheduled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lessons === null && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                          The school&apos;s lessons for {term}, {session} could not be read, so no class arm is counted
                          here. A column of zeroes would look like a school with no timetable.
                        </td>
                      </tr>
                    )}
                    {lessons !== null &&
                      classes.map((arm) => {
                      const own = (lessons ?? []).filter((lesson) => lesson.className === arm.name);
                      const uniqueSubjects = Array.from(new Set(own.map((lesson) => lesson.subject)));
                      const unfilled = slots.length * (days.length || 5) - own.length;
                      return (
                        <tr key={arm.id} className="hover:bg-blue-50/20">
                          <td className="py-3 px-4 font-bold text-blue-900">{arm.name}</td>
                          <td className="py-3 px-3 text-slate-600">{arm.section}</td>
                          <td className="py-3 px-3 font-medium text-slate-800">{arm.formTeacher || <span className="text-slate-400">none named</span>}</td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${own.length > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                              {own.length} of {slots.length * (days.length || 5)}
                            </span>
                            {own.length > 0 && unfilled > 0 && (
                              <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{unfilled} slot(s) empty</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {uniqueSubjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {uniqueSubjects.map((subject) => (
                                  <span key={subject} className="text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                                    {subject}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">No lessons filed for this arm</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {lessons !== null && classes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                          This browser holds no class-arm list, so there is nothing to line the filed lessons up against.
                          Whatever is on the school&apos;s timetable still saves — it just cannot be grouped here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: workload, read off the same grid */}
        {activeTab === "workload" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800">Staff Workload &amp; Classroom Allocations ({staff.length} instructors)</h3>
              <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">{session} session</span>
            </div>
            <p className="px-4 pt-3 text-[11px] text-slate-500">
              {lessons === null
                ? `The school's timetable for ${term} could not be read, so no teacher is counted below. A column of "Awaiting Schedule" would look like a staff nobody has booked.`
                : `These counts are the lessons on the school's timetable for ${term}, added up per teacher — not the periods one browser remembers. A teacher matched by a typed name rather than a staff id is flagged, because two spellings of one person read as two people here.`}
            </p>

            {lessons === null ? null : staff.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <div className="text-sm font-semibold text-slate-600">No staff file to count against</div>
                <p className="text-xs text-slate-400">
                  Onboard staff members in <Link href="/operations/staff" className="text-blue-600 font-bold">Staff Management</Link> to
                  see how many periods each one is holding.
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
                    {workload.map(({ member, periods: held, matchedByName }) => (
                      <tr key={member.id} className="hover:bg-blue-50/20">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {member.fullName}
                          <span className="block text-[10px] text-slate-400 font-mono">{member.staffId}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{member.role}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {member.assignedSubjects.length > 0 ? (
                              member.assignedSubjects.map((subject) => (
                                <span key={subject} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  {subject}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">None assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{member.assignedClass || "None"}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${held > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"}`}>
                            {held} period{held === 1 ? "" : "s"}
                          </span>
                          {matchedByName && <span className="block text-[10px] text-amber-700 font-normal mt-0.5">by name, not staff id</span>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              held > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"
                            }`}
                          >
                            {held > 0 ? "Allocated" : "Awaiting Schedule"}
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

        {/* Tab 4: a draft, built from a plan and filed only when a person says so */}
        {activeTab === "draft" && (
          <div className="space-y-4 print:hidden">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 print:hidden">
              <div className="flex items-start gap-2 text-[11px] leading-snug text-slate-700">
                <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>A draft is a proposal, not a timetable.</strong> You write what each
                  arm needs — subject, teacher, how many periods — and the portal chooses the
                  times so that no teacher stands in two class arms at once, judged by the same
                  rule that refuses a lesson filed by hand. It builds around the{" "}
                  {lessons?.length ?? 0} lesson(s) already filed for {term}, {session} and moves
                  none of them. Nothing is saved until you file the draft yourself.
                </p>
              </div>

              <p className="text-[11px] text-slate-500">
                It places into {weeklyCapacity} slot(s) a week —{" "}
                {slots.length} teaching period(s) × {days.length} day(s) —{" "}
                {dayShape?.fromSchoolRecords
                  ? "as the school filed that day for this term."
                  : "using the day the portal ships with, because the school has not filed its own. If this school teaches a different day, file it above first: a draft placed into the wrong week is worse than no draft."}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">What the week must hold</p>
                {plan.map((row, position) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={row.className}
                      onChange={(event) =>
                        setPlan(plan.map((line, i) => (i === position ? { ...line, className: event.target.value } : line)))
                      }
                      className="w-40 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-blue-900 outline-none"
                      title="Which class arm this line is for"
                    >
                      <option value="">Choose a class arm…</option>
                      {classes.map((arm) => (
                        <option key={arm.id} value={arm.name}>
                          {arm.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={row.subject}
                      onChange={(event) =>
                        setPlan(plan.map((line, i) => (i === position ? { ...line, subject: event.target.value } : line)))
                      }
                      list="academics-plan-subjects"
                      placeholder="Subject"
                      className="flex-1 min-w-36 p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none"
                    />
                    <select
                      value={row.teacherName}
                      onChange={(event) =>
                        setPlan(plan.map((line, i) => (i === position ? { ...line, teacherName: event.target.value } : line)))
                      }
                      className="w-44 p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none"
                      title="Left on “not named yet”, the lesson is placed as a gap for the office to fill"
                    >
                      <option value="">Not named yet</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.fullName}>
                          {member.fullName} ({member.role})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={row.periodsWanted}
                      onChange={(event) =>
                        setPlan(
                          plan.map((line, i) =>
                            i === position ? { ...line, periodsWanted: Math.trunc(Number(event.target.value)) || 0 } : line
                          )
                        )
                      }
                      className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center outline-none"
                      title="Periods of this subject the arm needs this week"
                    />
                    <button
                      type="button"
                      onClick={() => setPlan(plan.filter((_, i) => i !== position))}
                      className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                      title="Take this line out of the plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <datalist id="academics-plan-subjects">
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.name} />
                  ))}
                </datalist>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlan([...plan, blankPlanRow(selectedClass)])}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add a line
                  </button>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="font-bold">Limit one teacher to</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={capInput}
                      onChange={(event) => setCapInput(event.target.value)}
                      className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center outline-none"
                      placeholder="—"
                    />
                    <span>periods a week</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Blank means no limit. The portal has no record of what one teacher should
                    carry, so it will not invent a number for you.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  disabled={!scopedDraft || busy}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 rounded-lg font-semibold text-xs cursor-pointer"
                >
                  Discard the draft
                </button>
                <button
                  type="button"
                  onClick={() => void handleDraft()}
                  disabled={drafting || busy || loading}
                  className="px-4 py-2 text-xs font-bold bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {drafting ? "Placing the week…" : "Draft the week"}
                </button>
              </div>
            </div>

            {draft && !scopedDraft && (
              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 print:hidden">
                The draft held on this screen was built for{" "}
                <strong>{draft.scope.replace("|", ", ")}</strong>, and the grid is now reading{" "}
                <strong>{term}, {session}</strong>. It is not shown and cannot be filed: a week
                planned for one term filed into another is how a class arrives for a lesson that was
                never put there. Press “Draft the week” again to plan the term you are in.
              </p>
            )}

            {scopedDraft?.ok && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Draft for {term}, {session}
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {draftProposed.length} lesson(s) placed · {scopedDraft.unplaced.length} line(s) of
                      the plan could not be ·{" "}
                      {scopedDraft.emptySlots.length} slot(s) left empty in the arms planned.{" "}
                      <strong>None of this is on the school&apos;s timetable yet.</strong>
                    </p>
                  </div>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => void handleFileDraft()}
                      disabled={busy || draftProposed.length === 0}
                      className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      {busy ? "Filing…" : `File these ${draftProposed.length} lesson(s)`}
                    </button>
                  ) : (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      Your role can plan a week but not file one — only the Exam Office puts
                      lessons on the school&apos;s timetable.
                    </p>
                  )}
                </div>

                {scopedDraft.unplaced.length > 0 && (
                  <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-[11px] leading-snug text-rose-950 space-y-1">
                    <p className="flex items-start gap-2">
                      <TriangleAlert className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
                      <strong>
                        {scopedDraft.unplaced.length} part(s) of the plan did not fit, and are not on
                        this draft.
                      </strong>
                    </p>
                    <ul className="list-disc pl-6 space-y-0.5">
                      {scopedDraft.unplaced.map((row, index) => (
                        <li key={index}>
                          {row.class_name} · {row.subject}
                          {row.teacher_name ? ` (${row.teacher_name})` : ""}: {row.placed} of{" "}
                          {row.wanted} placed — {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {draftProposed.length === 0 ? (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    The plan placed no lesson at all. Nothing will be filed, because there is
                    nothing to file — the reasons are above.
                  </p>
                ) : (
                  draftByClass.map((group) => (
                    <div key={group.className} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-800">{group.className}</h4>
                        <span className="text-[11px] text-slate-500">
                          {group.rows.length} of {scopedDraft.weeklySlots || weeklyCapacity} slots
                          filled by this draft
                          {(draftEmptyByClass.find(([name]) => name === group.className)?.[1] ?? 0) > 0 &&
                            ` · ${(draftEmptyByClass.find(([name]) => name === group.className)?.[1] ?? 0)} still empty`}
                        </span>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-[11px]">
                          <thead className="sticky top-0 bg-white">
                            <tr className="text-left text-slate-500">
                              <th className="px-3 py-1.5 font-semibold">Day</th>
                              <th className="px-3 py-1.5 font-semibold">Period</th>
                              <th className="px-3 py-1.5 font-semibold">Subject</th>
                              <th className="px-3 py-1.5 font-semibold">Teacher</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.rows.map((lesson, index) => (
                              <tr key={`${lesson.day}-${lesson.period_index}-${index}`} className="hover:bg-indigo-50/30">
                                <td className="px-3 py-1.5 font-semibold text-slate-700">{lesson.day}</td>
                                <td className="px-3 py-1.5 text-slate-600">
                                  {lesson.period_label || `Period ${lesson.period_index + 1}`}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-slate-900">{lesson.subject}</td>
                                <td className="px-3 py-1.5">
                                  {isUnassigned(lesson.teacher_name, lesson.teacher_ref) ? (
                                    <span className="text-amber-700 font-semibold">No teacher named — a gap to fill</span>
                                  ) : (
                                    lesson.teacher_name
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}

                <p className="text-[11px] text-slate-500">
                  A draft places lessons, not rooms: filing these leaves every room blank, which
                  the grid prints as the class&apos;s own room. The school&apos;s clash rule judges
                  each row again when it is filed, so anything a colleague added to the timetable
                  since this draft was built is named and refused rather than overwritten.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal: one lesson into one slot */}
        {slot && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <form onSubmit={handleFileLesson} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Schedule Class Period</h3>
                <button type="button" onClick={() => setSlot(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <strong>{selectedClass}</strong> • {slot.day} • {slot.periodLabel} • {term}, {session}
              </p>

              <label className="block">
                <span className="block font-bold text-slate-700 mb-1 text-xs">Subject</span>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(event) => setSubjectInput(event.target.value)}
                  list="academics-subject-options"
                  placeholder="e.g. English Language, Mathematics, ICT"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-xs"
                  required
                />
                <datalist id="academics-subject-options">
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.name} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="block font-bold text-slate-700 mb-1 text-xs">Teacher</span>
                <select
                  value={teacherInput}
                  onChange={(event) => setTeacherInput(event.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-xs"
                >
                  <option value="">Not named yet</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.fullName}>
                      {member.fullName} ({member.role})
                    </option>
                  ))}
                </select>
                <span className="block text-[10px] text-slate-500 mt-1">
                  A named teacher is checked against the rest of the grid: if they already hold another class in this
                  slot, the save is refused and says where.
                </span>
              </label>

              <label className="block">
                <span className="block font-bold text-slate-700 mb-1 text-xs">Room</span>
                <input
                  type="text"
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-xs"
                  placeholder="Leave blank to mean the class's own room"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setSlot(null)} className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-bold shadow-xs text-xs cursor-pointer"
                >
                  {busy ? "Filing…" : "File On The School's Timetable"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
