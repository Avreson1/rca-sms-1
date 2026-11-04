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
} from "lucide-react";

export default function AcademicCalendarPage() {
  const {
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    clearAllCalendarEvents,
  } = useRealtimeCalendar();

  const {
    activityTemplates,
    addActivityTemplate,
    deleteActivityTemplate,
    resetActivityTemplatesToDefault,
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

  // Calendar Event Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDateRange, setNewDateRange] = useState("");
  const [newCat, setNewCat] = useState<CalendarEventRecord["category"]>("Academic");
  const [newTerm, setNewTerm] = useState<CalendarEventRecord["term"]>("First Term");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState<CalendarEventRecord["status"]>("Upcoming");

  // Activity Template Form State
  const [actTitle, setActTitle] = useState("");
  const [actCategory, setActCategory] = useState<ActivityTemplateRecord["category"]>("Sports");
  const [actTargetSection, setActTargetSection] = useState("All School Sections");
  const [actCoordinator, setActCoordinator] = useState("");
  const [actVenue, setActVenue] = useState("");
  const [actBudget, setActBudget] = useState("");
  const [actObjectives, setActObjectives] = useState("");
  const [actDuration, setActDuration] = useState(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addCalendarEvent({
      title: newTitle.trim(),
      dateRange: newDateRange.trim() || "TBD",
      category: newCat,
      term: newTerm,
      session: scope.session,
      description: newDesc.trim() || "Official academic milestone.",
      status: newStatus,
    });

    setIsModalOpen(false);
    setNewTitle("");
    setNewDateRange("");
    setNewDesc("");
    setNewStatus("Upcoming");
    showToast("Calendar milestone saved on this browser.");
  };

  const handleCreateActivityTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;

    addActivityTemplate({
      title: actTitle.trim(),
      category: actCategory,
      targetSection: actTargetSection.trim() || "All School Sections",
      coordinator: actCoordinator.trim() || "Unassigned",
      venue: actVenue.trim() || "Main Campus Hall",
      budget: actBudget.trim() || "₦0",
      objectives: actObjectives.trim() || "Standard co-curricular activity.",
      defaultDurationDays: Number(actDuration) || 1,
    });

    setIsActivityModalOpen(false);
    setActTitle("");
    setActCoordinator("");
    setActVenue("");
    setActBudget("");
    setActObjectives("");
    setActDuration(1);
    showToast("Activity template saved on this browser — other machines will not see it.");
  };

  const handleInstantiateActivityIntoCalendar = (template: ActivityTemplateRecord) => {
    const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    addCalendarEvent({
      title: template.title,
      dateRange: `${todayStr} (${template.defaultDurationDays} Day${template.defaultDurationDays > 1 ? "s" : ""})`,
      category: template.category === "Sports" || template.category === "Cultural" || template.category === "Excursion" || template.category === "Club" ? "Academic" : (template.category as any),
      term: scope.term as any,
      session: scope.session,
      description: `[Activity Template: ${template.targetSection}] Coordinator: ${template.coordinator}. Venue: ${template.venue}. Budget: ${template.budget}. Objectives: ${template.objectives}`,
      status: "Upcoming",
    });

    showToast(`Scheduled "${template.title}" into the ${scope.term}, ${scope.session} calendar on this browser.`);
  };

  const handleSeedStandardTermMilestones = () => {
    // These used to arrive dated "September 8, 2025" and marked Completed, which is a
    // history the school never lived: seeded in the next session, the calendar claimed
    // seven past events had happened. They come in as undated, upcoming rows to edit.
    const defaultMilestones: Omit<CalendarEventRecord, "id">[] = [
      {
        title: "Staff Resumption & Pre-Term Harmonization Workshop",
        dateRange: "Set the date",
        category: "Administrative",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "Curriculum harmonization, test pool development, and staff onboarding.",
        status: "Upcoming",
      },
      {
        title: "Student Resumption & Commencement of Lectures",
        dateRange: "Set the date",
        category: "Academic",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "All returning and newly admitted students commence classroom lectures.",
        status: "Upcoming",
      },
      {
        title: "Continuous Assessment (Test 1) Week",
        dateRange: "Set the date",
        category: "Examination",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "Classroom Test 1 assessments across all subjects (10 Marks).",
        status: "Upcoming",
      },
      {
        title: "Mid-Term Examination & Open Day",
        dateRange: "Set the date",
        category: "Academic",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "Parent-Teacher interactive consultation and mid-term grade reviews.",
        status: "Upcoming",
      },
      {
        title: "Proctored CBT Examination Week",
        dateRange: "Set the date",
        category: "Examination",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "Online Computer-Based Testing in the ICT Lab; the score shows on that machine for a teacher to file.",
        status: "Upcoming",
      },
      {
        title: "Final Examination & Score Entry Deadline",
        dateRange: "Set the date",
        category: "Examination",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "Theory examinations and final Continuous Assessment gradebook locking.",
        status: "Upcoming",
      },
      {
        title: "Result Compilation, Speech & Prize-Giving Day",
        dateRange: "Set the date",
        category: "Administrative",
        term: scope.term as CalendarEventRecord["term"],
        session: scope.session,
        description: "Official report card release and vacation commencement.",
        status: "Upcoming",
      },
    ];

    defaultMilestones.forEach((m) => addCalendarEvent(m));
    showToast("Starter milestones added on this browser only, undated and upcoming — set each date as the school fixes it.");
  };

  const filteredEvents = calendarEvents.filter((ev) => {
    if (termFilter === "All") return true;
    return ev.term === termFilter;
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-6 bg-[#0a1128] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-in slide-in-from-top-3 border border-cyan-400">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-[#0000FF] flex items-center gap-1 font-semibold">
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
              <span className="text-xs bg-blue-100 text-[#0000FF] font-black px-2.5 py-0.5 rounded-full border border-blue-300 uppercase">
                Scheme 1
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Current Session: <strong className="text-slate-800">{scope.session}</strong> • Term:{" "}
              <strong className="text-[#0000FF]">{scope.term}</strong> • Scheduled Events:{" "}
              <strong className="text-slate-800">{calendarEvents.length}</strong> • Activity Templates:{" "}
              <strong className="text-slate-800">{activityTemplates.length}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "calendar" ? (
              <>
                {calendarEvents.length === 0 && (
                  <button
                    onClick={handleSeedStandardTermMilestones}
                    className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#0000FF]" />
                    Populate Term Milestones
                  </button>
                )}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold bg-[#0000FF] hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Calendar Milestone
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={resetActivityTemplatesToDefault}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                  Reset Default Templates
                </button>
                <button
                  onClick={() => setIsActivityModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold bg-[#0000FF] hover:bg-blue-700 text-white rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Activity Template
                </button>
              </>
            )}
          </div>
        </div>

        <DeviceOnlyNotice what="The school calendar and the activity templates" />

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 gap-4">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`pb-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "calendar"
                ? "border-[#0000FF] text-[#0000FF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Academic Calendar Schedule ({calendarEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("activity-templates")}
            className={`pb-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "activity-templates"
                ? "border-[#0000FF] text-[#0000FF]"
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
                          ? "bg-[#0000FF] text-white shadow-xs"
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
                  onClick={() => {
                    if (
                      confirm(
                        "Clear every calendar milestone stored on this browser? Other machines keep theirs, and this browser's list cannot be brought back."
                      )
                    ) {
                      clearAllCalendarEvents();
                    }
                  }}
                  className="text-xs text-[#FF0000] hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Calendar Events
                </button>
              )}
            </div>

            {/* Timeline View */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0000FF]" />
                  Official Term Schedule ({scope.session} Session)
                </h3>
                <span className="text-xs bg-cyan-50 text-cyan-900 font-black px-2.5 py-0.5 rounded-full border border-cyan-200">
                  {filteredEvents.length} Milestones Scheduled
                </span>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                  <div className="text-sm font-bold text-slate-700">No Calendar Milestones Found</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No events currently scheduled. Click &apos;Add Calendar Milestone&apos; or switch to Activity Templates to schedule events.
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
                            ? "border-[#0000FF] ring-4 ring-blue-100 bg-[#0000FF]"
                            : ev.status === "Completed"
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300"
                        }`}
                      />

                      <div className="space-y-1.5 bg-slate-50/70 hover:bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-300 transition-all shadow-2xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {ev.dateRange}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                ev.category === "Examination"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : ev.category === "Academic"
                                  ? "bg-blue-100 text-[#0000FF] border border-blue-200"
                                  : ev.category === "Holiday"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-slate-100 text-slate-800 border border-slate-200"
                              }`}
                            >
                              {ev.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {ev.term}
                            </span>
                            {ev.status === "Current" && (
                              <span className="text-[10px] font-black bg-[#0000FF] text-white px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
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
                              onChange={(e) =>
                                updateCalendarEvent(ev.id, { status: e.target.value as CalendarEventRecord["status"] })
                              }
                              className="text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 cursor-pointer shadow-2xs"
                            >
                              <option value="Upcoming">Upcoming</option>
                              <option value="Current">Active / Current</option>
                              <option value="Completed">Completed</option>
                            </select>
                            <button
                              onClick={() => deleteCalendarEvent(ev.id)}
                              className="text-slate-400 hover:text-[#FF0000] p-1.5 transition-all cursor-pointer rounded-lg hover:bg-rose-50"
                              title="Delete Milestone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-sm font-black text-slate-900">{ev.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{ev.description}</p>
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
            <div className="bg-gradient-to-r from-blue-900 to-[#0a1128] text-white rounded-3xl p-6 shadow-xl border border-cyan-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[10px] uppercase tracking-wider mb-2 border border-cyan-400/30">
                  <Activity className="w-3 h-3" /> Dedicated Template Engine
                </div>
                <h3 className="text-xl font-black text-white">Input Templates for Extracurricular & Co-Curricular Activities</h3>
                <p className="text-xs text-blue-200/80 max-w-2xl mt-1 leading-relaxed">
                  Design reusable activity blueprints for sports tournaments, science exhibitions, cultural festivals, student excursions, career symposiums, and PTA deliberations. Instantiate any template into the live academic calendar with 1 click.
                </p>
              </div>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4 text-blue-950" />
                <span>Add New Template</span>
              </button>
            </div>

            {/* Grid of Activity Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activityTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider bg-blue-50 text-[#0000FF] border border-blue-200">
                        {template.category}
                      </span>
                      <button
                        onClick={() => deleteActivityTemplate(template.id)}
                        className="text-slate-300 hover:text-[#FF0000] p-1 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-base font-black text-slate-900 leading-snug">{template.title}</h4>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Section:</span>
                        <span className="font-bold text-slate-800 truncate">{template.targetSection}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <Target className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Coordinator:</span>
                        <span className="font-bold text-slate-800 truncate">{template.coordinator}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Venue:</span>
                        <span className="font-bold text-slate-800 truncate">{template.venue}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold text-slate-500">Budget:</span>
                        <span className="font-bold text-emerald-700">{template.budget}</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-bold text-slate-700">{template.defaultDurationDays} Day(s)</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Objectives & Scope</span>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{template.objectives}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold">Ready for dispatch</span>
                    <button
                      type="button"
                      onClick={() => handleInstantiateActivityIntoCalendar(template)}
                      className="px-3.5 py-1.5 bg-[#0000FF] hover:bg-cyan-500 hover:text-slate-950 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Schedule into Term</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Add Calendar Milestone */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#0000FF]" />
                  Add Calendar Milestone
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Milestone / Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Fair & Inter-House Sports"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-[#0000FF] focus:ring-1 focus:ring-[#0000FF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Date or Range</label>
                    <input
                      type="text"
                      placeholder="e.g. Nov 18, 2025"
                      value={newDateRange}
                      onChange={(e) => setNewDateRange(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-[#0000FF]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value as CalendarEventRecord["category"])}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-[#0000FF]"
                    >
                      <option value="Academic">Academic</option>
                      <option value="Examination">Examination</option>
                      <option value="Holiday">Holiday</option>
                      <option value="Administrative">Administrative</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Academic Term</label>
                    <select
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value as CalendarEventRecord["term"])}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-[#0000FF]"
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-[#0000FF]"
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-[#0000FF]"
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
                    className="px-5 py-2 rounded-xl bg-[#0000FF] hover:bg-blue-700 text-white font-black cursor-pointer shadow-md shadow-blue-600/30"
                  >
                    Add Milestone
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

              <form onSubmit={handleCreateActivityTemplate} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Activity Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inter-House Football & Athletics Tournament"
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-[#0000FF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Activity Category</label>
                    <select
                      value={actCategory}
                      onChange={(e) => setActCategory(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-[#0000FF]"
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-[#0000FF]"
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-[#0000FF]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Venue / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Sports Complex, Rayfield"
                      value={actVenue}
                      onChange={(e) => setActVenue(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-[#0000FF]"
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono outline-none focus:border-[#0000FF]"
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
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono outline-none focus:border-[#0000FF]"
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-[#0000FF]"
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
                    className="px-5 py-2 rounded-xl bg-[#0000FF] hover:bg-blue-700 text-white font-black cursor-pointer shadow-md shadow-blue-600/30"
                  >
                    Save Template
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
