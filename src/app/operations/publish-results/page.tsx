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
  fetchPublicationsFromSupabase,
  setPublicationsOnServer,
  type PublicationRow,
} from "@/lib/supabase/db";
import { useSchoolConfig } from "@/lib/school-config";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  LockOpen,
  Printer,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const TERMS = ["First Term", "Second Term", "Third Term"] as const;
type Term = (typeof TERMS)[number];

/**
 * Releasing a class's results used to write into this browser's localStorage
 * under the key `rca_published_classes_v6`. Nothing else in the world changed:
 * the parent on a phone saw the same card before and after the headteacher
 * clicked, and the column that reported CA readiness was a green badge typed
 * into the page, not a fact about the school. This screen now reads and writes
 * `result_publications` through /api/result-publications, and every number in
 * the table is a count of rows the school actually holds.
 */
export default function PublishResultsPage() {
  const { classes } = useRealtimeClasses();
  const { students } = useRealtimeStudents();
  const { currentUser } = useRealtimeAuth();

  const canPublish = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  // The school's own session and term, from the database. The compiled constant
  // is only the fallback for when that read was refused, and says so on screen.
  const { config: school, usingDefaults } = useSchoolConfig();
  const [selectedTerm, setSelectedTerm] = useState<Term>(SCHOOL_INFO.currentTerm as Term);
  const [termApplied, setTermApplied] = useState(false);

  useEffect(() => {
    if (!school || termApplied) return;
    if ((TERMS as readonly string[]).includes(school.current_term)) {
      setSelectedTerm(school.current_term as Term);
    }
    setTermApplied(true);
  }, [school, termApplied]);

  const [publishedByClass, setPublishedByClass] = useState<Record<string, PublicationRow>>({});
  const [publicationRead, setPublicationRead] = useState<{ ok: boolean; reason: string | null }>({ ok: false, reason: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const session = school?.current_session ?? SCHOOL_INFO.currentSession;

  // Filed marks for the whole school in one read, so the "marks filed" column is
  // a count of ca_scores rows rather than a badge that always said Complete.
  const { subjectScores, filedLoaded } = useRealtimeSubjectScores({ session, terms: [selectedTerm] });

  const marksByClass = useMemo(() => {
    const perClass = new Map<string, { pupils: Set<string>; subjects: Set<string> }>();
    for (const row of subjectScores) {
      if (row.session !== session || row.term !== selectedTerm) continue;
      const name = row.className;
      if (!name) continue;
      const bucket = perClass.get(name) ?? { pupils: new Set<string>(), subjects: new Set<string>() };
      bucket.pupils.add(row.studentId);
      bucket.subjects.add(row.subjectName);
      perClass.set(name, bucket);
    }
    return perClass;
  }, [subjectScores, session, selectedTerm]);

  const loadPublications = useCallback(async () => {
    setPublicationRead({ ok: false, reason: "loading" });
    const { rows, reason } = await fetchPublicationsFromSupabase(session, selectedTerm);
    if (reason) {
      setPublicationRead({ ok: false, reason });
      return;
    }
    const map: Record<string, PublicationRow> = {};
    for (const row of rows ?? []) map[row.class_name] = row;
    setPublishedByClass(map);
    setPublicationRead({ ok: true, reason: null });
  }, [session, selectedTerm]);

  useEffect(() => {
    void loadPublications();
  }, [loadPublications]);

  const applyToClasses = async (classNames: string[], published: boolean) => {
    if (classNames.length === 0) {
      setActionNote(published ? "There is no class on the register to publish." : "Nothing is released for this term, so there is nothing to withdraw.");
      setActionError(null);
      setTimeout(() => setActionNote(null), 6000);
      return;
    }

    setBusy(true);
    setActionError(null);
    const { ok, reason } = await setPublicationsOnServer(session, selectedTerm, classNames, published);
    setBusy(false);

    if (!ok) {
      // The server refused, so the screen says refused. Before this it printed
      // "Published and authorized results for SS 2!" whatever had just happened.
      setActionError(
        `${published ? "Publishing" : "Withdrawing"} did not happen: ${reason ?? "the portal server did not answer"}.`
      );
      return;
    }

    await loadPublications();
    setActionNote(
      published
        ? `${classNames.length} ${classNames.length === 1 ? "class is" : "classes are"} now released for ${selectedTerm}, ${session}. A parent sees the card as soon as they open it.`
        : `${classNames.length} ${classNames.length === 1 ? "class is" : "classes are"} locked again for ${selectedTerm}, ${session}. Families can no longer open those cards.`
    );
    setTimeout(() => setActionNote(null), 8000);
  };

  const publishEligible = useMemo(
    () => classes.filter((c) => (marksByClass.get(c.name)?.pupils.size ?? 0) > 0).map((c) => c.name),
    [classes, marksByClass]
  );
  const publishedCount = classes.filter((c) => publishedByClass[c.name]).length;

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
              <span className="text-slate-800 font-semibold">Publish Results</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Terminal Result Release
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Releasing a class is what lets a family open that report card. Nothing here changes a mark.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedTerm}
              onChange={(event) => setSelectedTerm(event.target.value as Term)}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
              aria-label="Term to publish"
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
            <button
              onClick={() => void loadPublications()}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-read
            </button>
            <Link
              href="/operations/score-card"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Inspect Score Cards
            </Link>
          </div>
        </div>

        {usingDefaults && (
          <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <span>
              The school&apos;s session and term could not be read from the database, so this screen is showing the values
              built into the portal ({SCHOOL_INFO.currentSession}). Set the session and term in Settings once the
              database is reachable and this notice goes away.
            </span>
          </div>
        )}

        {publicationRead.reason === "loading" ? null : !publicationRead.ok ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span>
              What is already released could not be read: {publicationRead.reason}. The states below are not confirmed —
              do not assume any class has been published until this notice clears.
            </span>
          </div>
        ) : null}

        {actionError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-4 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionNote && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>{actionNote}</span>
          </div>
        )}

        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
              Release status
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              {publishedCount} of {classes.length} classes released
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Session <strong className="text-white">{session}</strong> • Term{" "}
              <strong className="text-blue-400">{selectedTerm}</strong> • {students.length} pupils on the register •{" "}
              {filedLoaded ? `${publishEligible.length} classes have marks filed` : "marks are still being read"}
            </p>
          </div>

          {canPublish && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => void applyToClasses(publishEligible, true)}
                disabled={busy || !filedLoaded || publishEligible.length === 0}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                Release every class with marks
              </button>
              <button
                onClick={() => void applyToClasses(Object.keys(publishedByClass), false)}
                disabled={busy || publishedCount === 0}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Lock all released classes
              </button>
            </div>
          )}
        </div>

        {!canPublish && (
          <p className="text-xs text-slate-500">
            Your role can see what has been released; only the executive and the exam office can change it.
          </p>
        )}

        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Classes for {selectedTerm}</h3>
            <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
              {publishedCount}/{classes.length} released
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-3">Section</th>
                  <th className="py-3 px-3">On register</th>
                  <th className="py-3 px-4">Marks filed this term</th>
                  <th className="py-3 px-4">Release state</th>
                  {canPublish && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((c) => {
                  const enrolled = students.filter((s) => s.className === c.name).length;
                  const filed = marksByClass.get(c.name);
                  const publication = publishedByClass[c.name];
                  const noMarks = (filed?.pupils.size ?? 0) === 0;

                  return (
                    <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-3 text-slate-600">{c.section}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{enrolled}</td>
                      <td className="py-3 px-4">
                        {!filedLoaded ? (
                          <span className="text-[10px] font-bold text-slate-400">reading…</span>
                        ) : noMarks ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            No marks filed
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-700">
                            {filed!.pupils.size} of {enrolled} pupils • {filed!.subjects.size}{" "}
                            {filed!.subjects.size === 1 ? "subject" : "subjects"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {publication ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Released by {publication.published_by || "the office"}
                            {publication.published_at ? ` on ${new Date(publication.published_at).toLocaleDateString()}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <Lock className="w-3.5 h-3.5" />
                            Not released
                          </span>
                        )}
                      </td>
                      {canPublish && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => void applyToClasses([c.name], !publication)}
                            disabled={busy}
                            title={noMarks && !publication ? "This class has no filed marks; releasing it would show families an empty card." : undefined}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                              publication
                                ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            {publication ? (
                              <>
                                <LockOpen className="w-3.5 h-3.5 inline mr-1" />
                                Withdraw
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                                Release
                              </>
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
