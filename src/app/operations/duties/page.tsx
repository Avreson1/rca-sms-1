"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useSchoolConfig } from "@/lib/school-config";
import { useRealtimeAuth, useRealtimeStaff } from "@/lib/realtime-store";
import { isActionAuthorized, rolesAllowedForPath } from "@/lib/rbac";
import {
  assignDutyOnServer,
  fetchDutyRosterOnServer,
  removeDutyOnServer,
  type StaffDutyRow,
} from "@/lib/supabase/db";
import {
  DUTY_SUGGESTIONS,
  DUTY_TIME_WINDOWS,
  formatDutyDate,
  isSchoolWeekday,
  isValidDutyDate,
  schoolToday,
  schoolWeekContaining,
} from "@/lib/duties/roster";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  RefreshCw,
  TriangleAlert,
  Trash2,
  X,
} from "lucide-react";

const WINDOW_ORDER: string[] = [...DUTY_TIME_WINDOWS];

function windowRank(value: string): number {
  const index = WINDOW_ORDER.indexOf(value);
  return index === -1 ? WINDOW_ORDER.length : index;
}

function shiftDate(date: string, days: number): string {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(stamp)) return date;
  return new Date(stamp + days * 86_400_000).toISOString().slice(0, 10);
}

interface DraftDuty {
  date: string;
  staffId: string;
  duty: string;
  timeWindow: string;
  location: string;
  notes: string;
}

/**
 * Who is on duty, for which part of which day, and who said so.
 *
 * Every row on this screen was filed by someone against a real staff record, and
 * nothing here is inferred. A teacher's designation does not predict their duty,
 * yesterday's roster does not carry itself into today, and an empty day is
 * printed as an empty day — because a gate that appears covered on a screen
 * nobody actually assigned is worse than a gate that plainly says it is not.
 *
 * The week is read from the school's records and never stored on this browser:
 * two machines with two different rosters is how two people turn up for one duty.
 */
export default function OperationsDutyRosterPage() {
  const { currentUser } = useRealtimeAuth();
  const { staff } = useRealtimeStaff();
  const { config: school } = useSchoolConfig();

  const canAssign = isActionAuthorized(currentUser?.role, "ASSIGN_DUTIES");

  /** The server's date for the school, in West African Time — not this browser's. */
  const [today, setToday] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [view, setView] = useState<"week" | "day">("week");

  const [duties, setDuties] = useState<StaffDutyRow[]>([]);
  const [scope, setScope] = useState<"school" | "self" | "">("");
  const [staffRecordLinked, setStaffRecordLinked] = useState(true);
  const [scopeNote, setScopeNote] = useState<string | null>(null);

  const [readProblem, setReadProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "warn"; message: string } | null>(null);
  const [draft, setDraft] = useState<DraftDuty | null>(null);

  const range = useMemo(() => {
    if (days.length === 0) return null;
    return { from: days[0], to: days[days.length - 1] };
  }, [days]);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const roster = await fetchDutyRosterOnServer({ from, to });
    if (!roster.ok) {
      // A roster that could not be read is not a roster with nobody on it. Printing
      // the empty version is how an office files a second gate duty over the top of
      // the first, believing the day was uncovered.
      setDuties([]);
      setReadProblem(roster.reason ?? "The duty roster could not be read.");
    } else {
      setDuties(roster.duties);
      setReadProblem(null);
      setScope(roster.scope);
      setStaffRecordLinked(roster.staffRecordLinked);
      setScopeNote(roster.note);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Ask the server which day it is before choosing which week to print. The
      // portal runs on a host several hours behind the school, so a week built from
      // the browser's clock can be the wrong week for someone in Jos.
      const opening = await fetchDutyRosterOnServer({});
      if (cancelled) return;
      const anchor = opening.ok && isValidDutyDate(opening.today) ? opening.today : schoolToday();
      setToday(anchor);
      if (!opening.ok) setReadProblem(opening.reason ?? "The duty roster could not be read.");

      const week = schoolWeekContaining(anchor);
      setView("week");
      setDays(week);
      await load(week[0], week[week.length - 1]);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const showWeek = useCallback(
    async (weekStart: string) => {
      const week = schoolWeekContaining(weekStart);
      setView("week");
      setDays(week);
      await load(week[0], week[week.length - 1]);
    },
    [load]
  );

  const showDay = useCallback(
    async (date: string) => {
      if (!isValidDutyDate(date)) return;
      setView("day");
      setDays([date]);
      await load(date, date);
    },
    [load]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, StaffDutyRow[]>();
    for (const date of days) map.set(date, []);
    for (const row of duties) {
      const bucket = map.get(row.duty_date) ?? [];
      bucket.push(row);
      map.set(row.duty_date, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort(
        (a, b) =>
          windowRank(a.time_window) - windowRank(b.time_window) ||
          a.staff_name.localeCompare(b.staff_name) ||
          a.duty.localeCompare(b.duty)
      );
    }
    return map;
  }, [days, duties]);

  const rostered = useMemo(() => new Set(duties.map((row) => row.staff_id)).size, [duties]);

  const assignable = useMemo(
    () => staff.filter((member) => member.status !== "Suspended" && member.staffId),
    [staff]
  );
  const suspendedCount = staff.length - assignable.length;

  const handleFile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);

    const result = await assignDutyOnServer({
      date: draft.date,
      staffId: draft.staffId,
      duty: draft.duty,
      timeWindow: draft.timeWindow,
      location: draft.location,
      notes: draft.notes,
    });

    if (result.ok && result.duty) {
      const person = assignable.find((member) => member.staffId === draft.staffId);
      const whoseName = person?.fullName ?? result.duty.staff_name;
      const parts = [
        `Filed: ${result.duty.duty} — ${result.duty.time_window.toLowerCase()} of ${formatDutyDate(result.duty.duty_date)}, for ${whoseName}.`,
      ];
      if (result.replaced) parts.push(`It replaces “${result.replaced}” in that slot.`);
      if (result.staffStatus && result.staffStatus !== "Active")
        parts.push(`Note: ${whoseName} is marked ${result.staffStatus} on the register.`);
      setOutcome({ tone: result.staffStatus && result.staffStatus !== "Active" ? "warn" : "ok", message: parts.join(" ") });
      setDraft(null);
      if (range) await load(range.from, range.to);
    } else {
      setOutcome({
        tone: "warn",
        message: result.reason ?? "The school's records did not take the duty. Nothing was filed.",
      });
    }
    setBusy(false);
  };

  const handleRemove = async (row: StaffDutyRow) => {
    if (
      !window.confirm(
        `Take “${row.duty}” off ${row.staff_name} for ${row.time_window.toLowerCase()} of ${formatDutyDate(row.duty_date)}?\n\n` +
          "The duty disappears from every machine the moment this is filed. Nobody is told on their way in."
      )
    )
      return;

    const result = await removeDutyOnServer(row.id);
    if (result.ok) {
      setOutcome({
        tone: "ok",
        message: `Removed: ${row.duty} — ${row.time_window.toLowerCase()} of ${formatDutyDate(row.duty_date)}, taken off ${row.staff_name}.`,
      });
      if (range) await load(range.from, range.to);
    } else {
      setOutcome({
        tone: "warn",
        message: result.reason ?? "The school's records did not remove the duty. It is still on the roster.",
      });
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
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
              <span className="text-slate-800 font-semibold">Duty Roster</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              Daily Duty Roster
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Who is on duty at {school?.school_name?.trim() || SCHOOL_INFO.name}, for which part of which day, and
              which login filed it — read from the school&apos;s records, never from this browser.
            </p>
            {today && (
              <p className="text-[11px] text-slate-600 mt-1.5 font-semibold">
                Today at the school: <span className="font-mono">{formatDutyDate(today)}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => range && void load(range.from, range.to)}
              disabled={loading || !range}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Reading…" : "Refresh"}
            </button>
            {canAssign && (
              <button
                onClick={() =>
                  setDraft({
                    date: days[0] ?? today ?? schoolToday(),
                    staffId: assignable[0]?.staffId ?? "",
                    duty: "",
                    timeWindow: "Morning Assembly",
                    location: "",
                    notes: "",
                  })
                }
                disabled={assignable.length === 0}
                title={
                  assignable.length === 0
                    ? "Register somebody in Operations → Staff first: a duty needs a real staff record to fall on."
                    : undefined
                }
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                File A Duty
              </button>
            )}
          </div>
        </div>

        {/* Who may change the roster at all. */}
        {!canAssign && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-[11px] leading-snug text-sky-950 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>You are reading the roster.</strong> Only a{" "}
              {rolesAllowedForPath("/operations/duties")
                .filter((role) => isActionAuthorized(role, "ASSIGN_DUTIES"))
                .join(" or ") || "Head of School or Exam Officer"}{" "}
              login files, replaces or removes a duty. What you see is what the office assigned to you — and a duty you
              cannot see here was never filed.
            </p>
          </div>
        )}

        {scope === "self" && staffRecordLinked && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] leading-snug text-slate-700">
            This is <strong>your own roster</strong> — the rows below are the duties filed against your staff record.
            The school&apos;s full roster, with everybody&apos;s names on it, is an office screen.
          </div>
        )}

        {!staffRecordLinked && scopeNote && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3 text-[11px] font-semibold leading-snug flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>{scopeNote}</p>
          </div>
        )}

        {readProblem && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-4 text-xs font-semibold flex items-start gap-2" role="status">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              The duty roster could not be read: {readProblem}. Nothing is listed below in place of it — a day that
              looks uncovered when the read merely failed is how a second duty gets filed over the first. Run{" "}
              <code className="font-mono">supabase/staff_duties.sql</code> if this project has never had the roster set
              up.
            </p>
          </div>
        )}

        {outcome && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold flex items-start gap-2 ${
              outcome.tone === "ok"
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : "bg-amber-50 border-amber-300 text-amber-950"
            }`}
            role="status"
          >
            <TriangleAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${outcome.tone === "ok" ? "text-emerald-600" : "text-amber-700"}`} />
            <p>{outcome.message}</p>
          </div>
        )}

        {/* Which stretch of days is on screen. */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center gap-2">
          <button
            onClick={() => range && void showWeek(shiftDate(range.from, -7))}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            title="The week before"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-xs font-bold text-slate-800 min-w-[210px] text-center">
            {range ? `${formatDutyDate(range.from)} → ${formatDutyDate(range.to)}` : "Reading the school's date…"}
          </div>
          <button
            onClick={() => range && void showWeek(shiftDate(range.from, 7))}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            title="The week after"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => today && void showWeek(today)}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold cursor-pointer flex items-center gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
            This week
          </button>

          <label className="flex items-center gap-2 ml-auto text-[11px] font-semibold text-slate-600">
            One day instead
            <input
              type="date"
              value={view === "day" ? days[0] : ""}
              onChange={(event) => showDay(event.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Duties Shown</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1 font-mono">{duties.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">Filed for the dates above, by any login with the right.</p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Staff With A Duty</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1 font-mono">{rostered}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {assignable.length > 0
                ? `Of ${assignable.length} staff members on the register who could be rostered.`
                : "Nobody on the staff register could be rostered."}
            </p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Days Fully Covered</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1 font-mono">
              {days.filter((date) => (byDate.get(date) ?? []).length > 0).length}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              A day with one duty is counted here like a day with six. Coverage means “somebody was filed”, not
              “enough people”.
            </p>
          </div>
        </div>

        {suspendedCount > 0 && canAssign && (
          <p className="text-[11px] text-slate-500">
            {suspendedCount} member{ suspendedCount === 1 ? " is" : "s are" } marked Suspended on the register and are
            not offered here — their login is closed, so a duty filed on them would never reach them.
          </p>
        )}

        {/* The roster itself — printed only when the read answered. */}
        {readProblem ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <p className="text-xs text-slate-600 leading-snug">
              No day is listed above the refusal. Five cards each saying “nobody filed” would look exactly like a week
              the office left empty, and it is the read that failed, not the roster.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((date) => (
              <DayPanel
                key={date}
                date={date}
                isToday={Boolean(today) && date === today}
                duties={byDate.get(date) ?? []}
                canAssign={canAssign}
                busy={busy}
                loading={loading}
                onFile={() =>
                  setDraft({
                    date,
                    staffId: assignable[0]?.staffId ?? "",
                    duty: "",
                    timeWindow: "Morning Assembly",
                    location: "",
                    notes: "",
                  })
                }
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        {draft && (
          <DutyFormModal
            draft={draft}
            setDraft={setDraft}
            staffOptions={assignable}
            busy={busy}
            onSubmit={handleFile}
          />
        )}
      </div>
    </DashboardShell>
  );
}

function DayPanel({
  date,
  isToday,
  duties,
  canAssign,
  busy,
  loading,
  onFile,
  onRemove,
}: {
  date: string;
  isToday: boolean;
  duties: StaffDutyRow[];
  canAssign: boolean;
  busy: boolean;
  loading: boolean;
  onFile: () => void;
  onRemove: (row: StaffDutyRow) => void;
}) {
  const teachingDay = isSchoolWeekday(date);

  return (
    <div className={`bg-white border rounded-xl shadow-xs overflow-hidden ${isToday ? "border-blue-300" : "border-slate-200"}`}>
      <div
        className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${
          isToday ? "bg-blue-50 border-blue-200" : "bg-slate-50/70 border-slate-100"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900">{formatDutyDate(date)}</h3>
          {isToday && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
              Today
            </span>
          )}
          {!teachingDay && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              Outside the teaching week
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">
            {loading ? "Reading…" : duties.length === 0 ? "Nobody filed" : `${duties.length} filed`}
          </span>
          {canAssign && (
            <button
              onClick={onFile}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              Duty
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-4 text-xs text-slate-500">Reading the school&apos;s records for this day…</p>
      ) : duties.length === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-500">
          No duty is filed for {formatDutyDate(date)}. That is what the school&apos;s records hold — not a screen that
          failed to load. {canAssign ? "Use “Duty” above to assign one." : "Only the office can assign one."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {duties.map((row) => (
            <li key={row.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-100 whitespace-nowrap mt-0.5">
                {row.time_window}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{row.duty}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <span className="font-semibold text-slate-800">{row.staff_name}</span>
                  <span className="text-slate-400"> · </span>
                  {row.designation ? row.designation : <em className="text-slate-400">no designation on record</em>}
                  <span className="text-slate-400"> · </span>
                  <span className="font-mono text-[10px]">{row.staff_id}</span>
                </p>
                {(row.location || row.notes) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {row.location && (
                      <>
                        <span className="font-semibold text-slate-700">Where:</span> {row.location}
                      </>
                    )}
                    {row.location && row.notes && <span className="text-slate-400"> — </span>}
                    {row.notes && (
                      <>
                        <span className="font-semibold text-slate-700">Note:</span> {row.notes}
                      </>
                    )}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Filed by <span className="font-mono">{row.assigned_by || "a login no longer named"}</span>
                </p>
              </div>
              {canAssign && (
                <button
                  onClick={() => onRemove(row)}
                  disabled={busy}
                  title="Take this duty off the roster"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DutyFormModal({
  draft,
  setDraft,
  staffOptions,
  busy,
  onSubmit,
}: {
  draft: DraftDuty;
  setDraft: (next: DraftDuty | null) => void;
  staffOptions: { staffId: string; fullName: string; designation?: string; standingDuties?: string[]; status: string }[];
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const picked = staffOptions.find((member) => member.staffId === draft.staffId);
  const suggestions = Array.from(new Set([...(picked?.standingDuties ?? []), ...DUTY_SUGGESTIONS]))
    .map((name) => name.trim())
    .filter((name) => name.length > 1);
  const dateIsReadable = isValidDutyDate(draft.date);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            File A Duty
          </h3>
          <button onClick={() => setDraft(null)} className="text-slate-400 font-bold cursor-pointer" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Which day</label>
            <input
              type="date"
              required
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            {!dateIsReadable && (
              <p className="text-[10px] text-amber-700 mt-1 font-semibold">
                Pick a real date. A duty filed against a date the school cannot read is a duty nobody turns up to.
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Who it falls to</label>
            <select
              required
              value={draft.staffId}
              onChange={(event) => setDraft({ ...draft, staffId: event.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {staffOptions.length === 0 && <option value="">Nobody is on the staff register</option>}
              {staffOptions.map((member) => (
                <option key={member.staffId} value={member.staffId}>
                  {member.fullName} — {member.staffId}
                  {member.designation ? ` · ${member.designation}` : ""}
                  {member.status !== "Active" ? ` (${member.status})` : ""}
                </option>
              ))}
            </select>
            {picked && picked.status !== "Active" && (
              <p className="text-[10px] text-amber-700 mt-1 font-semibold">
                {picked.fullName} is marked {picked.status} on the register. The duty will still be filed — it simply
                says the school knows they may not be there for it.
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">The duty</label>
            <input
              type="text"
              required
              maxLength={120}
              list="duty-names"
              placeholder="e.g. Gate Duty"
              value={draft.duty}
              onChange={(event) => setDraft({ ...draft, duty: event.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <datalist id="duty-names">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="text-[10px] text-slate-500 mt-1">
              Pick from the list or write your own — the school&apos;s wording is what gets filed, never a category
              invented by the portal.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Which part of the day</label>
            <select
              required
              value={draft.timeWindow}
              onChange={(event) => setDraft({ ...draft, timeWindow: event.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {DUTY_TIME_WINDOWS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              One person holds one duty per part of a day. Filing a second into the same slot replaces the first, and
              the screen says so.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Where (optional)</label>
              <input
                type="text"
                maxLength={120}
                placeholder="e.g. Main gate"
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Note (optional)</label>
              <input
                type="text"
                maxLength={500}
                placeholder="e.g. With the prefect"
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !dateIsReadable || !draft.staffId || !draft.duty.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Filing…" : "File This Duty"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
