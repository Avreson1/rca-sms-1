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
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-2xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-[13px] font-bold tracking-tight text-ink">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
            </span>
            On Duty Today
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {today
              ? formatDutyDate(today)
              : problem
                ? "The school could not say what day it is"
                : "Asking the school what day it is…"}
            {scope === "school" ? " · the whole school" : scope === "self" ? " · your own roster" : ""}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-slate-600">Designation:</span>{" "}
            {designation ? designation : <em className="text-slate-400">the staff register does not state one</em>}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          title="Read the roster again"
          aria-label="Read the roster again"
          className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-hairline text-slate-400 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 disabled:cursor-default disabled:opacity-40 lg:h-8 lg:w-8"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} strokeWidth={1.75} />
        </button>
      </div>

      {problem && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-snug text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" strokeWidth={1.75} />
          <p>
            Today&apos;s duties could not be read: {problem}. Nothing is shown below in place of them — this screen will
            not guess who is at the gate.
          </p>
        </div>
      )}

      {!problem && !staffRecordLinked && note && (
        <p className="rounded-xl border border-hairline bg-canvas p-3 text-[11px] leading-snug text-muted">{note}</p>
      )}

      {!problem && loading && duties.length === 0 && (
        <p className="text-[11px] text-muted">Reading today&apos;s roster from the school&apos;s records…</p>
      )}

      {!problem && staffRecordLinked && duties.length === 0 && !loading && (
        <p className="text-[11px] leading-relaxed text-slate-600">
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
            <li key={row.id} className="rounded-xl border border-hairline bg-canvas p-3 transition-colors duration-150 hover:border-brand-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-azure-100 bg-azure-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-azure-800">
                  {row.time_window}
                </span>
                <p className="font-display text-xs font-bold tracking-tight text-ink">{row.duty}</p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {row.staff_name}
                {row.designation ? ` · ${row.designation}` : ""}
                {row.location ? ` · ${row.location}` : ""}
              </p>
              {row.notes && <p className="mt-0.5 text-[11px] italic leading-relaxed text-muted">{row.notes}</p>}
              <p className="mt-1 text-[10px] text-slate-400">
                Assigned by <span className="font-mono">{row.assigned_by || "a login no longer named"}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <p className="mt-2 text-[11px] tabular-nums text-muted">
          And {hidden} more filed for today — the roster prints all of them.
        </p>
      )}

      {isRouteAllowed(role, "/operations/duties") && (
        <Link
          href="/operations/duties"
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-[11px] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-800"
        >
          Open the duty roster
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      )}
    </section>
  );
}
