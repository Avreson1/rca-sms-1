"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRealtimeAuth, useRealtimeStaff } from "@/lib/realtime-store";
import { isRouteAllowed } from "@/lib/rbac";
import { fetchDutyRosterOnServer, type StaffDutyRow } from "@/lib/supabase/db";
import { formatDutyDate } from "@/lib/duties/roster";
import { ArrowRight, ClipboardList, RefreshCw, TriangleAlert } from "lucide-react";

const ROWS_ON_DASHBOARD = 6;

/**
 * The one thing on this screen that says what the school asked of you today.
 *
 * Everything else on the dashboard is what the portal holds; this is what an
 * office decided, for a date, with a login recorded against it. It is read from
 * the school's records on every visit and never remembered here, because a duty
 * cached in a browser is a duty that quietly stops being true.
 */
export function TodayDutyPanel() {
  const { currentUser } = useRealtimeAuth();
  const { staff } = useRealtimeStaff();

  const [today, setToday] = useState("");
  const [duties, setDuties] = useState<StaffDutyRow[]>([]);
  const [scope, setScope] = useState<"school" | "self" | "">("");
  const [staffRecordLinked, setStaffRecordLinked] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const role = currentUser?.role;
  const isParent = role === "STUDENT_PARENT";

  const load = useCallback(async () => {
    setLoading(true);
    // No date is sent: the server answers for its own idea of today, in West
    // African time. A browser several hours behind would otherwise ask for —
    // and be shown — yesterday's roster.
    const roster = await fetchDutyRosterOnServer({});
    if (!roster.ok) {
      setDuties([]);
      setProblem(roster.reason ?? "the portal server did not answer");
    } else {
      setDuties(roster.duties);
      setToday(roster.today);
      setScope(roster.scope);
      setStaffRecordLinked(roster.staffRecordLinked);
      setNote(roster.note);
      setProblem(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isParent) return;
    void load();
  }, [isParent, load]);

  if (isParent) return null;

  const member = staff.find((s) => (currentUser?.staffId && s.staffId === currentUser.staffId) || s.username === currentUser?.username);
  const designation = member?.designation?.trim() ?? "";
  const shown = duties.slice(0, ROWS_ON_DASHBOARD);
  const hidden = duties.length - shown.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            On Duty Today
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {today
              ? formatDutyDate(today)
              : problem
                ? "The school could not say what day it is"
                : "Asking the school what day it is…"}
            {scope === "school" ? " · the whole school" : scope === "self" ? " · your own roster" : ""}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            <span className="font-semibold text-slate-700">Designation:</span>{" "}
            {designation ? designation : <em className="text-slate-400">the staff register does not state one</em>}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          title="Read the roster again"
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {problem && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-lg p-3 text-[11px] font-semibold leading-snug flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p>
            Today&apos;s duties could not be read: {problem}. Nothing is shown below in place of them — this screen will
            not guess who is at the gate.
          </p>
        </div>
      )}

      {!problem && !staffRecordLinked && note && (
        <p className="text-[11px] text-slate-500 leading-snug bg-slate-50 border border-slate-200 rounded-lg p-3">{note}</p>
      )}

      {!problem && loading && duties.length === 0 && (
        <p className="text-[11px] text-slate-500">Reading today&apos;s roster from the school&apos;s records…</p>
      )}

      {!problem && staffRecordLinked && duties.length === 0 && !loading && (
        <p className="text-[11px] text-slate-600 leading-snug">
          {scope === "school"
            ? "No duty is filed for anyone today."
            : "No duty is filed for you today."}{" "}
          That is what the school&apos;s records hold.{" "}
          {scope === "self" ? "If you expected one, the office has not assigned it yet." : "The office files them in Operations → Duty Roster."}
        </p>
      )}

      {!problem && shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((row) => (
            <li key={row.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-100">
                  {row.time_window}
                </span>
                <p className="text-xs font-bold text-slate-900">{row.duty}</p>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {row.staff_name}
                {row.designation ? ` · ${row.designation}` : ""}
                {row.location ? ` · ${row.location}` : ""}
              </p>
              {row.notes && <p className="text-[11px] text-slate-500 mt-0.5 italic">{row.notes}</p>}
              <p className="text-[10px] text-slate-400 mt-1">
                Assigned by <span className="font-mono">{row.assigned_by || "a login no longer named"}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <p className="text-[11px] text-slate-500 mt-2">
          And {hidden} more filed for today — the roster prints all of them.
        </p>
      )}

      {isRouteAllowed(role, "/operations/duties") && (
        <Link
          href="/operations/duties"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 hover:text-blue-800"
        >
          Open the duty roster
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
