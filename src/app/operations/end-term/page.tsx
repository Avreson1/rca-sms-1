"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeAuth,
  useRealtimeClasses,
  useRealtimeStudents,
  useRealtimeSubjectScores,
} from "@/lib/realtime-store";
import {
  closeTermOnServer,
  countCBTSittingsForTerm,
  fetchAssessmentsFromSupabase,
  fetchClosedTermsFromSupabase,
  fetchPublicationsFromSupabase,
  reopenTermOnServer,
  saveSchoolConfigToSupabase,
  type ClosedTermRow,
} from "@/lib/supabase/db";
import { useSchoolConfig } from "@/lib/school-config";
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  LockOpen,
  RefreshCw,
} from "lucide-react";

const TERMS = ["First Term", "Second Term", "Third Term"] as const;
type Term = (typeof TERMS)[number];

/** The term after this one, rolling the session over at the end of the year. */
function nextScope(session: string, term: Term): { session: string; term: Term } {
  const index = TERMS.indexOf(term);
  if (index < 0 || index < TERMS.length - 1) {
    return { session, term: TERMS[index + 1] ?? "First Term" };
  }
  const match = /^(\d{4})[\/\s-]+(\d{4})$/.exec(session);
  const rolled = match ? `${Number(match[1]) + 1}/${Number(match[2]) + 1}` : session;
  return { session: rolled, term: "First Term" };
}

/**
 * Closing a term used to be a two-second timer that then printed
 * "First Term (2025/2026) successfully archived! Next term initialized." No
 * term was closed, no mark was locked and the portal was still on the same term
 * — and the four ticks above the button were hard-coded into the page, three of
 * them permanently green whatever the school had actually filed.
 *
 * Everything on this screen is now read from the school's records, and the
 * button writes a row that /api/ca checks before it accepts a mark.
 */
export default function EndTermOperationsPage() {
  const { classes } = useRealtimeClasses();
  const { students } = useRealtimeStudents();
  const { currentUser } = useRealtimeAuth();

  const canClose = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  const { config, usingDefaults, reload: reloadSchoolConfig } = useSchoolConfig();
  const [selectedTerm, setSelectedTerm] = useState<Term>((SCHOOL_INFO.currentTerm as Term) ?? "First Term");
  const [termApplied, setTermApplied] = useState(false);

  const [closed, setClosed] = useState<{ rows: ClosedTermRow[] | null; reason: string | null; loading: boolean }>({
    rows: null,
    reason: null,
    loading: true,
  });
  const [releasedCount, setReleasedCount] = useState<{ value: number | null; reason: string | null }>({
    value: null,
    reason: null,
  });
  const [cbtCount, setCbtCount] = useState<{ value: number | null; reason: string | null }>({
    value: null,
    reason: null,
  });
  const [traitCount, setTraitCount] = useState<{ value: number | null; reason: string | null }>({
    value: null,
    reason: null,
  });

  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // The screen opens on the term the school is in, then leaves the choice to the
  // office: a re-read must not overwrite a term someone picked by hand.
  useEffect(() => {
    if (!config || termApplied) return;
    if ((TERMS as readonly string[]).includes(config.current_term)) setSelectedTerm(config.current_term as Term);
    setTermApplied(true);
  }, [config, termApplied]);

  const session = config?.current_session ?? SCHOOL_INFO.currentSession;

  const loadState = useCallback(async () => {
    setClosed((previous) => ({ ...previous, loading: true }));
    const [closings, publications, sittings, assessments] = await Promise.all([
      fetchClosedTermsFromSupabase(),
      fetchPublicationsFromSupabase(session, selectedTerm),
      countCBTSittingsForTerm(session, selectedTerm),
      fetchAssessmentsFromSupabase({ session, terms: [selectedTerm] }),
    ]);
    setClosed({ rows: closings.rows, reason: closings.reason, loading: false });
    setReleasedCount({
      value: publications.reason ? null : (publications.rows ?? []).length,
      reason: publications.reason,
    });
    setCbtCount(sittings);
    setTraitCount({
      value: assessments === null ? null : new Set(assessments.map((row) => row.studentId)).size,
      reason: assessments === null ? "the school's assessment list could not be read" : null,
    });
  }, [session, selectedTerm]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Marks filed for the term being considered, counted from ca_scores.
  const { subjectScores, filedLoaded } = useRealtimeSubjectScores({ session, terms: [selectedTerm] });
  const pupilsWithMarks = useMemo(
    () => new Set(subjectScores.filter((row) => row.session === session && row.term === selectedTerm).map((row) => row.studentId)).size,
    [subjectScores, session, selectedTerm]
  );

  const isClosed = (closed.rows ?? []).some((row) => row.session === session && row.term === selectedTerm);
  const isCurrentTerm = config?.current_term === selectedTerm && config?.current_session === session;
  const upcoming = nextScope(session, selectedTerm);

  const close = async () => {
    setBusy(true);
    setMessage(null);
    const { ok, reason } = await closeTermOnServer(session, selectedTerm);
    setBusy(false);
    if (!ok) {
      setMessage({ kind: "bad", text: `The term was NOT closed: ${reason ?? "the portal server did not answer"}.` });
      return;
    }
    await loadState();
    setMessage({
      kind: "ok",
      text: `${selectedTerm} of ${session} is closed. Its marks are still readable and its cards still print, but nothing can be filed or changed in it.`,
    });
  };

  const reopen = async () => {
    setBusy(true);
    setMessage(null);
    const { ok, reason } = await reopenTermOnServer(session, selectedTerm);
    setBusy(false);
    if (!ok) {
      setMessage({ kind: "bad", text: `The term was NOT re-opened: ${reason ?? "the portal server did not answer"}.` });
      return;
    }
    await loadState();
    setMessage({ kind: "ok", text: `${selectedTerm} of ${session} is open again — marks can be filed in it.` });
  };

  /**
   * Moves the school to the next term. This is the only part of rollover the
   * portal can honestly promise: the session and term the whole portal filters
   * on, stored where every device reads it. It changes no mark and deletes
   * nothing, and it is refused until the term being left behind is closed.
   */
  const advance = async () => {
    if (!config) return;
    setBusy(true);
    setMessage(null);
    const { ok, reason } = await saveSchoolConfigToSupabase({
      ...config,
      current_session: upcoming.session,
      current_term: upcoming.term,
    });
    setBusy(false);
    if (!ok) {
      setMessage({ kind: "bad", text: `The school was NOT moved on: ${reason ?? "the portal server did not answer"}.` });
      return;
    }
    reloadSchoolConfig();
    setSelectedTerm(upcoming.term);
    setMessage({
      kind: "ok",
      text: `The portal is now on ${upcoming.term}, ${upcoming.session}. Every screen that filters on "current term" follows this value.`,
    });
  };

  const checks = [
    {
      label: `Marks filed for ${selectedTerm}`,
      detail: !filedLoaded
        ? "the school's marks could not be read"
        : `${pupilsWithMarks} of ${students.length} pupils on the register have at least one subject filed`,
      state: !filedLoaded ? "unknown" : pupilsWithMarks === 0 ? "bad" : pupilsWithMarks < students.length ? "partial" : "ok",
      href: "/operations/update-ca",
      hrefLabel: "File marks",
    },
    {
      label: `Results released for ${selectedTerm}`,
      detail:
        releasedCount.reason !== null
          ? "the release list could not be read"
          : `${releasedCount.value} of ${classes.length} classes released${
              releasedCount.value === 0 ? " — families cannot open any card yet" : ""
            }`,
      state: releasedCount.reason !== null ? "unknown" : releasedCount.value === 0 ? "partial" : "ok",
      href: "/operations/publish-results",
      hrefLabel: "Release results",
    },
    {
      label: "Behavioural traits",
      detail:
        traitCount.reason !== null
          ? traitCount.reason
          : `${traitCount.value} of ${students.length} pupils have their ratings filed${
              traitCount.value === 0 ? " — every card would print the other half empty" : ""
            }`,
      state: traitCount.value === null ? "unknown" : traitCount.value === 0 ? "bad" : traitCount.value < students.length ? "partial" : "ok",
      href: "/operations/traits-assessments",
      hrefLabel: "Open traits",
    },
    {
      label: "CBT sittings",
      detail:
        cbtCount.reason !== null
          ? `the sitting list could not be read: ${cbtCount.reason}`
          : `${cbtCount.value} attempt(s) filed${
              cbtCount.value === 0 ? " — nobody has run the engine, or its attempts were never filed" : ""
            }. An attempt is not a mark; none of these fill the exam column by themselves.`,
      state: cbtCount.reason !== null ? "unknown" : cbtCount.value === 0 ? "partial" : "ok",
      href: "/cbt",
      hrefLabel: "Open CBT",
    },
  ];

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
              <span className="text-slate-800 font-semibold">End of Term</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Close a term and move the school on
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Closing a term locks the marks filed in it. Nothing is deleted: last term&apos;s cards still print, and the
              office can re-open a term from here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTerm}
              onChange={(event) => setSelectedTerm(event.target.value as Term)}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
              aria-label="Term to review"
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
            <button
              onClick={() => void loadState()}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-read
            </button>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
            The school is on
          </span>
          <h2 className="text-2xl font-black text-white mt-1">
            {selectedTerm} — session {session}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {usingDefaults && !config ? (
              <span className="text-amber-300">
                This is the term built into the portal, not the one read from the school&apos;s records. The settings
                table may not be set up yet.
              </span>
            ) : selectedTerm === config?.current_term && session === config?.current_session ? (
              "This is the current term on every device in the school."
            ) : (
              `The current term on the school's records is ${config?.current_term}, ${config?.current_session}. This screen is reviewing ${selectedTerm}.`
            )}
          </p>
        </div>

        {message && (
          <div
            className={`rounded-xl p-4 text-xs font-semibold flex items-start gap-2 border ${
              message.kind === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {message.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {closed.reason && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span>
              The list of closed terms could not be read: {closed.reason}. Until it can, this screen cannot tell you
              whether a term is locked, and no term will be shown as closed.
            </span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-3xl space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-blue-600" />
            What the school&apos;s records say about {selectedTerm}
          </h3>

          <div className="space-y-2.5 text-xs">
            {checks.map((check) => (
              <div key={check.label} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-800">{check.label}</p>
                  <p className="text-slate-500 mt-0.5">{check.detail}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {check.state === "unknown" ? (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Not verified</span>
                  ) : check.state === "ok" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : check.state === "partial" ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                      Not finished
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded">
                      Nothing filed
                    </span>
                  )}
                  <Link href={check.href} className="text-blue-600 font-semibold hover:underline whitespace-nowrap">
                    {check.hrefLabel} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {canClose ? (
            <div className="pt-4 space-y-3 border-t border-slate-100">
              {!isClosed ? (
                <button
                  onClick={() => void close()}
                  disabled={busy || closed.loading || closed.reason !== null}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  {closed.loading ? "Reading the school's records…" : `Close ${selectedTerm} (${session})`}
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    {selectedTerm} is closed. Marks filed in it are refused by the server.
                  </div>
                  <button
                    onClick={() => void reopen()}
                    disabled={busy}
                    className="px-4 py-3 bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <LockOpen className="w-4 h-4" />
                    Re-open this term
                  </button>
                </div>
              )}

              {isClosed && isCurrentTerm && (
                <button
                  onClick={() => void advance()}
                  disabled={busy || !config}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                  Move the school on to {upcoming.term} ({upcoming.session})
                </button>
              )}
            </div>
          ) : (
            <p className="pt-3 text-xs text-slate-500">
              Your role can read this; only the executive and the exam office close or re-open a term.
            </p>
          )}
        </div>

        {(closed.rows ?? []).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden max-w-3xl">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-800">Terms already signed off</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-2.5 px-4">Session</th>
                    <th className="py-2.5 px-4">Term</th>
                    <th className="py-2.5 px-4">Closed by</th>
                    <th className="py-2.5 px-4">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {closed.rows?.map((row) => (
                    <tr key={`${row.session}|${row.term}`} className="hover:bg-blue-50/20">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{row.session}</td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {row.term}
                        {row.session === session && row.term === selectedTerm && (
                          <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            on screen
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{row.closed_by || "the office"}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {row.closed_at ? new Date(row.closed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
