"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import {
  useRealtimeCalendar,
  useRealtimeActivityTemplates,
  CalendarEventRecord,
  ActivityTemplateRecord,
} from "@/lib/realtime-store";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import {
  Calendar,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Trash2,
  Filter,
  Activity,
  Send,
  MapPin,
  DollarSign,
  Users,
  Target,
  BookmarkPlus,
  TriangleAlert,
} from "lucide-react";

const CALENDAR_CATEGORIES: CalendarEventRecord["category"][] = [
  "Academic",
  "Examination",
  "Holiday",
  "Administrative",
];

/**
 * What a blueprint says, in the blueprint's own words, with the gaps named.
 *
 * A scheduled milestone keeps this text after the template is gone, which is why
 * the parts the school left blank are written as blank instead of dropped: a
 * circular drawn from this row should not look like an event with no venue when
 * the truth is that nobody has said one yet.
 */
function templateNotes(template: ActivityTemplateRecord): string {
  const stated = [
    template.targetSection ? `For: ${template.targetSection}` : "",
    template.coordinator ? `Led by: ${template.coordinator}` : "",
    template.venue ? `Venue: ${template.venue}` : "",
    template.budget ? `Budget: ${template.budget}` : "",
    template.objectives ? `Objectives: ${template.objectives}` : "",
  ].filter(Boolean);

  const notSaid = [
    template.targetSection ? "" : "who it is for",
    template.coordinator ? "" : "who leads it",
    template.venue ? "" : "where it is held",
    template.budget ? "" : "what it costs",
  ].filter(Boolean);

  return [
    `From the activity blueprint “${template.title}” (${template.category}).`,
    `Planned length: ${template.defaultDurationDays} day${template.defaultDurationDays === 1 ? "" : "s"}.`,
    stated.length > 0 ? stated.join(". ") + "." : "",
    notSaid.length > 0 ? `Still not decided by the school: ${notSaid.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The starting outline the "Populate" button files when a school asks for it.
 *
 * These used to arrive dated "September 8, 2025" and marked Completed, which is a
 * history the school never lived. They come in undated and upcoming, so the dates
 * and the conclusions are the office's to make.
 */
const STARTER_MILESTONES: {
  title: string;
  category: CalendarEventRecord["category"];
  description: string;
}[] = [
  {
    title: "Staff Resumption & Pre-Term Harmonization Workshop",
    category: "Administrative",
    description: "Curriculum harmonization, test pool development, and staff onboarding.",
  },
  {
    title: "Student Resumption & Commencement of Lectures",
    category: "Academic",
    description: "All returning and newly admitted students commence classroom lectures.",
  },
  {
    title: "Continuous Assessment (Test 1) Week",
    category: "Examination",
    description: "Classroom Test 1 assessments across all subjects (10 Marks).",
  },
  {
    title: "Mid-Term Examination & Open Day",
    category: "Academic",
    description: "Parent-Teacher interactive consultation and mid-term grade reviews.",
  },
  {
    title: "Proctored CBT Examination Week",
    category: "Examination",
    description:
      "Computer-Based Testing in the ICT lab; each finished sitting is filed on the school's records as an attempt for the gradebook.",
  },
  {
    title: "Final Examination & Score Entry Deadline",
    category: "Examination",
    description: "Theory examinations and final Continuous Assessment gradebook locking.",
  },
  {
    title: "Result Compilation, Speech & Prize-Giving Day",
    category: "Administrative",
    description: "Official report card release and vacation commencement.",
  },
];

export default function AcademicCalendarPage() {
  const {
    calendarEvents,
    calendarSource,
    addCalendarEvents,
    setMilestoneStatus,
    deleteCalendarEvent,
    clearAllCalendarEvents,
  } = useRealtimeCalendar();

  const {
    activityTemplates,
    activityTemplatesSource,
    addActivityTemplate,
    deleteActivityTemplate,
  } = useRealtimeActivityTemplates();

  // Milestones are stamped with the session and term the school says it is in. The
  // frozen constants in `SCHOOL_INFO` were the year compiled into the bundle, so a
  // school that moved into a new session kept filing its calendar under the old one.
  const { config: school } = useSchoolConfig();
  const scope = effectiveScope(school, {
    session: SCHOOL_INFO.currentSession,
    term: SCHOOL_INFO.currentTerm,
  });

  const [activeTab, setActiveTab] = useState<"calendar" | "activity-templates">("calendar");
  const [termFilter, setTermFilter] = useState<string>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isFiling, setIsFiling] = useState(false);

  // Calendar Event Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDateRange, setNewDateRange] = useState("");
  const [newCat, setNewCat] = useState<CalendarEventRecord["category"]>("Academic");
  // Filed under the term the school says it is in, not the first one the portal
  // has always defaulted to — a school resuming in Third Term was filing its
  // milestones into a term that had closed.
  const [newTerm, setNewTerm] = useState<CalendarEventRecord["term"]>(scope.term as CalendarEventRecord["term"]);
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState<CalendarEventRecord["status"]>("Upcoming");

  // Activity Template Form State — every box starts empty, because a box the
  // portal filled says something about the school that the school has not said.
  const [actTitle, setActTitle] = useState("");
  const [actCategory, setActCategory] = useState<ActivityTemplateRecord["category"]>("Sports");
  const [actTargetSection, setActTargetSection] = useState("");
  const [actCoordinator, setActCoordinator] = useState("");
  const [actVenue, setActVenue] = useState("");
  const [actBudget, setActBudget] = useState("");
  const [actObjectives, setActObjectives] = useState("");
  const [actDuration, setActDuration] = useState(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setIsFiling(true);
    const outcome = await addCalendarEvents([
      {
        title,
        // An unfilled box stays unfilled. The portal used to type "TBD" here,
        // which made a date nobody had decided look like one on the record.
        dateRange: newDateRange.trim(),
        category: newCat,
        term: newTerm,
        session: scope.session,
        description: newDesc.trim(),
        status: newStatus,
      },
    ]);
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the milestone was not filed on the school's calendar");
      return;
    }

    setRefusal(null);
    setIsModalOpen(false);
    setNewTitle("");
    setNewDateRange("");
    setNewDesc("");
    setNewStatus("Upcoming");
    showToast(
      `“${title}” filed on the school's calendar for ${newTerm} of ${scope.session}.${
        newDateRange.trim() ? "" : " It is undated, because the school has not fixed a date."
      }`
    );
  };

  const handleCreateActivityTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = actTitle.trim();
    if (!title) return;

    setIsFiling(true);
    const outcome = await addActivityTemplate({
      title,
      category: actCategory,
      targetSection: actTargetSection.trim(),
      coordinator: actCoordinator.trim(),
      venue: actVenue.trim(),
      budget: actBudget.trim(),
      objectives: actObjectives.trim(),
      defaultDurationDays: Number(actDuration) || 1,
    });
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the template was not filed on the school's records");
      return;
    }

    setRefusal(null);
    setIsActivityModalOpen(false);
    setActTitle("");
    setActTargetSection("");
    setActCoordinator("");
    setActVenue("");
    setActBudget("");
    setActObjectives("");
    setActDuration(1);
    showToast(`“${title}” filed on the school's activity templates — every machine now offers the same blueprint.`);
  };

  const handleScheduleTemplate = async (template: ActivityTemplateRecord) => {
    setIsFiling(true);
    const outcome = await addCalendarEvents([
      {
        title: template.title,
        // A blueprint says how long an event runs, never when. This used to file
        // it with today's date, which put a plan on the calendar the office had
        // not made and marked a day as the school's when it was only the day the
        // button was pressed.
        dateRange: "",
        category: template.category,
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: templateNotes(template),
        status: "Upcoming",
      },
    ]);
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the activity was not scheduled on the school's calendar");
      return;
    }

    setRefusal(null);
    setActiveTab("calendar");
    showToast(
      `“${template.title}” scheduled into ${scope.term} of ${scope.session}, undated — set the date when the school fixes it.`
    );
  };

  const handleSeedStandardTermMilestones = async () => {
    setIsFiling(true);
    const outcome = await addCalendarEvents(
      STARTER_MILESTONES.map((milestone) => ({
        ...milestone,
        dateRange: "",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        status: "Upcoming" as const,
      }))
    );
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the starter milestones were not filed on the school's calendar");
      return;
    }

    setRefusal(null);
    showToast(
      `${STARTER_MILESTONES.length} starter milestones filed on the school's calendar for ${scope.term} of ${scope.session}, undated and upcoming. Every machine sees them; set each date as the school fixes it.`
    );
  };

  const handleSetStatus = async (event: CalendarEventRecord, status: CalendarEventRecord["status"]) => {
    setIsFiling(true);
    const outcome = await setMilestoneStatus(event.id, status);
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? `the status of “${event.title}” was not changed on the school's calendar`);
      return;
    }

    setRefusal(null);
    showToast(`“${event.title}” marked ${status.toLowerCase()} on the school's calendar for every machine.`);
  };

  const handleDeleteEvent = async (event: CalendarEventRecord) => {
    if (!confirm(`Remove “${event.title}” from the school's calendar? Every machine loses it with this one, and there is no copy to bring it back from.`)) return;

    setIsFiling(true);
    const outcome = await deleteCalendarEvent(event.id);
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? `“${event.title}” was not removed from the school's calendar`);
      return;
    }

    setRefusal(null);
    showToast(`“${event.title}” removed from the school's calendar.`);
  };

  const handleClearCalendar = async () => {
    if (
      !confirm(
        `Clear all ${calendarEvents.length} milestones on the school's calendar? This is not this browser's copy alone — every machine loses them, including the ones filed under other sessions and terms, and nothing keeps them.`
      )
    )
      return;

    setIsFiling(true);
    const outcome = await clearAllCalendarEvents();
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the calendar was not cleared");
      return;
    }

    setRefusal(null);
    showToast("The school's calendar is empty on every machine.");
  };

  const handleDeleteTemplate = async (template: ActivityTemplateRecord) => {
    if (!confirm(`Remove the blueprint “${template.title}” from the school's activity templates? Milestones already filed from it keep their own text.`)) return;

    setIsFiling(true);
    const outcome = await deleteActivityTemplate(template.id);
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? `“${template.title}” was not removed from the school's templates`);
      return;
    }

    setRefusal(null);
    showToast(`“${template.title}” removed from the school's activity templates.`);
  };

  // The calendar on screen is this session's. A milestone filed under last year's
  // session belongs to last year's circular, so it is not dropped silently — the
  // screen counts them and says where they are.
  const sessionEvents = calendarEvents.filter((ev) => ev.session === scope.session);
  const otherSessions = [...new Set(calendarEvents.filter((ev) => ev.session !== scope.session).map((ev) => ev.session))];
  const filteredEvents =
    termFilter === "All" ? sessionEvents : sessionEvents.filter((ev) => ev.term === termFilter);
  const templatesFromDevice = activityTemplatesSource === "device";
  const calendarFromDevice = calendarSource === "device";

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div role="status" className="fixed top-20 right-4 sm:right-6 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3 text-ink shadow-lg animate-in slide-in-from-top-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="flex min-h-6 items-center gap-1 font-semibold hover:text-brand-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Setup</span>
              <span>/</span>
              <span className="text-slate-900 font-extrabold">Calendar & Activity Hub</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Academic Calendar & Activity Management</span>
              <span className="text-xs bg-blue-100 text-brand-600 font-black px-2.5 py-0.5 rounded-full border border-blue-300 uppercase">
                Scheme 1
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Current Session: <strong className="text-slate-800">{scope.session}</strong> • Term:{" "}
              <strong className="text-brand-600">{scope.term}</strong> • Milestones this session:{" "}
              <strong className="text-slate-800">{sessionEvents.length}</strong> • Activity templates:{" "}
              <strong className="text-slate-800">{activityTemplates.length}</strong>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {calendarFromDevice && templatesFromDevice
                ? "Neither list has been read from the school's records, so what is below is this browser's own copy."
                : calendarFromDevice
                  ? "The activity templates are the school's records; the milestone list below is still this browser's copy."
                  : templatesFromDevice
                    ? "The milestones below are the school's records; the activity templates are still this browser's copy."
                    : "Both lists are the school's own records — what you file here is what every other machine shows."}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "calendar" ? (
              <>
                {sessionEvents.length === 0 && (
                  <button
                    onClick={() => void handleSeedStandardTermMilestones()}
                    disabled={isFiling}
                    className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                    title="Files the standard term outline on the school's records, undated and upcoming, for every machine to see."
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                    {isFiling ? "Filing on the school's records…" : "Populate Term Milestones"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setRefusal(null);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Calendar Milestone
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setRefusal(null);
                  setIsActivityModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Activity Template
              </button>
            )}
          </div>
        </div>

        {(calendarFromDevice || templatesFromDevice) && (
          <DeviceOnlyNotice
            what={
              calendarFromDevice && templatesFromDevice
                ? "The school calendar and the activity templates"
                : calendarFromDevice
                  ? "The milestone list on this screen"
                  : "The activity templates on this screen"
            }
          />
        )}

        {refusal && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold rounded-xl flex items-start gap-2 animate-in fade-in">
            <TriangleAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Nothing was filed on the school&apos;s records.</strong> {refusal}
            </span>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`pb-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "calendar"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Academic Calendar Schedule ({sessionEvents.length} this session)</span>
          </button>

          <button
            onClick={() => setActiveTab("activity-templates")}
            className={`pb-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "activity-templates"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-600" />
            <span>Dedicated Activity Templates ({activityTemplates.length})</span>
          </button>
        </div>

        {/* TAB 1: ACADEMIC CALENDAR */}
        {activeTab === "calendar" && (
          <div className="space-y-6">
            {/* Filter Toolbar */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex-wrap gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">Filter by Term:</span>
                <div className="flex flex-wrap gap-1">
                  {["All", "First Term", "Second Term", "Third Term"].map((term) => (
                    <button
                      key={term}
                      onClick={() => setTermFilter(term)}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        termFilter === term
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {calendarEvents.length > 0 && (
                <button
                  onClick={() => void handleClearCalendar()}
                  disabled={isFiling}
                  className="text-xs text-accent-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear the school&apos;s calendar
                </button>
              )}
            </div>

            {otherSessions.length > 0 && (
              <p className="text-[11px] text-slate-500">
                The school&apos;s calendar also holds {calendarEvents.length - sessionEvents.length} milestone
                {calendarEvents.length - sessionEvents.length === 1 ? "" : "s"} filed under{" "}
                {otherSessions.join(" and ")}. Switch the session on the school config screen to see them.
              </p>
            )}

            {/* Timeline View */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  Official Term Schedule ({scope.session} Session)
                </h3>
                <span className="text-xs bg-cyan-50 text-cyan-900 font-black px-2.5 py-0.5 rounded-full border border-cyan-200">
                  {filteredEvents.length} Milestones Scheduled
                </span>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                  <div className="text-sm font-bold text-slate-700">Nothing on this part of the calendar</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {sessionEvents.length === 0
                      ? calendarFromDevice
                        ? "This browser holds milestones of its own, but none of them are the school's records, so nothing here is a date another machine would agree to. Connect the portal to the school database before filing a term's plan."
                        : `No milestone is filed on the school's calendar for ${scope.session}. Use "Add Calendar Milestone" to file one, or "Populate Term Milestones" to file the standard outline undated and adjust each date as the school fixes it.`
                      : `Nothing here falls in ${termFilter === "All" ? "this session" : termFilter}. ${sessionEvents.length} milestone${sessionEvents.length === 1 ? " is filed elsewhere in" : "s are filed elsewhere in"} ${scope.session}.`}
                  </p>
                </div>
              ) : (
                <div className="relative border-l-2 border-blue-100 ml-4 space-y-6 pl-6">
                  {filteredEvents.map((ev) => (
                    <div key={ev.id} className="relative group">
                      {/* Dot */}
                      <div
                        className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white transition-all ${
                          ev.status === "Current"
                            ? "border-brand-600 ring-4 ring-blue-100 bg-brand-600"
                            : ev.status === "Completed"
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300"
                        }`}
                      />

                      <div className="space-y-1.5 bg-slate-50/70 hover:bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-300 transition-all shadow-2xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-mono font-black px-2 py-0.5 rounded border ${
                                ev.dateRange
                                  ? "text-slate-800 bg-white border-slate-200"
                                  : "text-amber-800 bg-amber-50 border-amber-200"
                              }`}
                            >
                              {ev.dateRange || "Date not fixed"}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                ev.category === "Examination"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : ev.category === "Academic"
                                  ? "bg-blue-100 text-brand-600 border border-blue-200"
                                  : ev.category === "Holiday"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : ev.category === "Sports"
                                  ? "bg-orange-100 text-orange-800 border border-orange-200"
                                  : ev.category === "Cultural"
                                  ? "bg-pink-100 text-pink-800 border border-pink-200"
                                  : ev.category === "Excursion"
                                  ? "bg-teal-100 text-teal-800 border border-teal-200"
                                  : ev.category === "Club"
                                  ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                  : "bg-slate-100 text-slate-800 border border-slate-200"
                              }`}
                            >
                              {ev.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {ev.term}
                            </span>
                            {ev.status === "Current" && (
                              <span className="text-[10px] font-black bg-brand-600 text-white px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
                                Active Now
                              </span>
                            )}
                            {ev.status === "Completed" && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Concluded
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={ev.status}
                              disabled={isFiling}
                              onChange={(e) =>
                                void handleSetStatus(ev, e.target.value as CalendarEventRecord["status"])
                              }
                              className="text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 cursor-pointer shadow-2xs disabled:cursor-wait"
                            >
                              <option value="Upcoming">Upcoming</option>
                              <option value="Current">Active / Current</option>
                              <option value="Completed">Completed</option>
                            </select>
                            <button
                              onClick={() => void handleDeleteEvent(ev)}
                              disabled={isFiling}
                              className="text-slate-400 hover:text-accent-600 p-1.5 transition-all cursor-pointer rounded-lg hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"
                              title="Remove this milestone from the school's calendar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-sm font-black text-slate-900">{ev.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {ev.description || (calendarFromDevice ? "" : "The school has written no notes for this milestone.")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVITY INPUT TEMPLATES */}
        {activeTab === "activity-templates" && (
          <div className="space-y-6">
            <div className="texture-grid-light relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-800 via-brand-950 to-night-900 p-6 text-white shadow-lg md:flex-row md:items-center">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-200">
                  <Activity className="h-3 w-3" strokeWidth={2} /> Dedicated Template Engine
                </div>
                <h3 className="font-display text-xl font-extrabold tracking-tight text-white">Input Templates for Extracurricular & Co-Curricular Activities</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/70">
                  A blueprint is one activity the school runs often, written down once — who it is for, who leads it,
                  where it is held, what it costs and how long it takes. Scheduling one files a milestone on the
                  school&apos;s calendar carrying this text, undated until the office fixes a date.
                </p>
              </div>
              <button
                onClick={() => {
                  setRefusal(null);
                  setIsActivityModalOpen(true);
                }}
                className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors duration-150 hover:bg-accent-700"
              >
                <BookmarkPlus className="h-4 w-4" strokeWidth={2} />
                <span>Add New Template</span>
              </button>
            </div>

            {activityTemplates.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2 shadow-xs">
                <Activity className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <div className="text-sm font-bold text-slate-700">The school has written no activity blueprints</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {templatesFromDevice
                    ? "What this browser holds is its own copy, and the portal no longer fills the list with invented events. Connect the portal to the school database, then file the activities the school actually runs."
                    : "Nothing is filed on the school's records, so no other machine has a template to offer. Use “Create Activity Template” to file one; leave any box you have not decided blank."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activityTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider bg-blue-50 text-brand-600 border border-blue-200">
                        {template.category}
                      </span>
                      <button
                        onClick={() => void handleDeleteTemplate(template)}
                        disabled={isFiling}
                        className="text-slate-300 hover:text-accent-600 p-1 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50"
                        title="Remove this blueprint from the school's activity templates"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-base font-black text-slate-900 leading-snug">{template.title}</h4>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Section:</span>
                        <span className={`font-bold truncate ${template.targetSection ? "text-slate-800" : "text-slate-400 italic"}`}>
                          {template.targetSection || "not said"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <Target className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Coordinator:</span>
                        <span className={`font-bold truncate ${template.coordinator ? "text-slate-800" : "text-slate-400 italic"}`}>
                          {template.coordinator || "not said"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Venue:</span>
                        <span className={`font-bold truncate ${template.venue ? "text-slate-800" : "text-slate-400 italic"}`}>
                          {template.venue || "not said"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Budget:</span>
                        <span className={`font-bold ${template.budget ? "text-emerald-700" : "text-slate-400 italic"}`}>
                          {template.budget || "not said"}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-bold text-slate-700">
                          {template.defaultDurationDays} day{template.defaultDurationDays === 1 ? "" : "s"} planned
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Objectives & Scope</span>
                      <p className={`text-xs line-clamp-2 leading-relaxed ${template.objectives ? "text-slate-600" : "text-slate-400 italic"}`}>
                        {template.objectives || "The school has written no objectives for this blueprint."}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {calendarFromDevice ? "Not on the school's calendar yet" : "Filing this adds a milestone every machine sees"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleScheduleTemplate(template)}
                      disabled={isFiling}
                      className="px-3.5 py-1.5 bg-brand-600 hover:bg-cyan-500 hover:text-slate-950 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                      title="Files a milestone on the school's calendar under the current session and term, undated."
                    >
                      <Send className="w-3 h-3" />
                      <span>Schedule into Term</span>
                    </button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Add Calendar Milestone */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-600" />
                  Add Calendar Milestone
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[11px] text-slate-500 -mt-1">
                Files on the school&apos;s calendar under <strong>{scope.session}</strong>, the session the portal
                says the school is in now.
              </p>

              <form onSubmit={handleAddEvent} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Milestone / Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Fair & Inter-House Sports"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date or Range</label>
                    <input
                      type="text"
                      placeholder="Leave blank until the school fixes it"
                      value={newDateRange}
                      onChange={(e) => setNewDateRange(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      The portal does not fill this in. Blank shows as &quot;Date not fixed&quot; rather than a day
                      nobody chose.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value as CalendarEventRecord["category"])}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-brand-600"
                    >
                      {CALENDAR_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      A milestone brought in from a sports, cultural, excursion or club blueprint keeps that
                      category; the four above are what this screen offers to type.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Academic Term</label>
                    <select
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value as CalendarEventRecord["term"])}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-brand-600"
                    >
                      <option value="First Term">First Term</option>
                      <option value="Second Term">Second Term</option>
                      <option value="Third Term">Third Term</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Initial Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as CalendarEventRecord["status"])}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-brand-600"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Current">Active Now</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the event, requirements or scope..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFiling}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-blue-700 text-white font-black cursor-pointer shadow-2xs disabled:cursor-wait disabled:opacity-60"
                  >
                    {isFiling ? "Filing…" : "File on the school's calendar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Activity Template */}
        {isActivityModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-600" />
                  Create Activity Input Template
                </h3>
                <button
                  onClick={() => setIsActivityModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[11px] text-slate-500 -mt-1">
                Every box may be left blank. A blank stays blank on the school&apos;s records and reads
                &quot;not said&quot; on the card — the portal no longer fills in a coordinator, a venue or a budget
                for an activity the school has not described.
              </p>

              <form onSubmit={handleCreateActivityTemplate} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Activity Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inter-House Football & Athletics Tournament"
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-brand-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Activity Category</label>
                    <select
                      value={actCategory}
                      onChange={(e) => setActCategory(e.target.value as ActivityTemplateRecord["category"])}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-brand-600"
                    >
                      <option value="Sports">Sports</option>
                      <option value="Academic">Academic</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Excursion">Excursion</option>
                      <option value="Club">Club / Society</option>
                      <option value="Administrative">Administrative / PTA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Section</label>
                    <input
                      type="text"
                      placeholder="e.g. Primary 3-5, Secondary"
                      value={actTargetSection}
                      onChange={(e) => setActTargetSection(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Coordinator / Lead</label>
                    <input
                      type="text"
                      placeholder="e.g. Head of Sports"
                      value={actCoordinator}
                      onChange={(e) => setActCoordinator(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Venue / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Sports Complex, Rayfield"
                      value={actVenue}
                      onChange={(e) => setActVenue(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Budget Allocation</label>
                    <input
                      type="text"
                      placeholder="e.g. ₦350,000"
                      value={actBudget}
                      onChange={(e) => setActBudget(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono outline-none focus:border-brand-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Default Duration (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={actDuration}
                      onChange={(e) => setActDuration(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono outline-none focus:border-brand-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Objectives & Strategic Outcome</label>
                  <textarea
                    rows={2}
                    placeholder="State key learning goals, developmental milestones, or event outcomes..."
                    value={actObjectives}
                    onChange={(e) => setActObjectives(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsActivityModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFiling}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-blue-700 text-white font-black cursor-pointer shadow-2xs disabled:cursor-wait disabled:opacity-60"
                  >
                    {isFiling ? "Filing…" : "File on the school's records"}
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
