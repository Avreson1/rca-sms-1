"use client";

import * as React from "react";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

interface PendingAttempt {
  id: string;
  subject: string;
  class_name: string;
  cbt_score: number;
  max_marks: number;
  strikes: number;
  is_expelled: boolean;
  completed_at: string;
  students: { full_name: string; admission_no: string } | null;
}

export function CBTReviewPanel() {
  const [attempts, setAttempts] = React.useState<PendingAttempt[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [scores, setScores] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const res = await fetch("/api/cbt/attempts", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "Could not load attempts awaiting review.");
      setAttempts([]);
      return;
    }
    setError(null);
    setAttempts(data.data as PendingAttempt[]);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const confirm = async (attempt: PendingAttempt) => {
    const edited = scores[attempt.id];
    const res = await fetch("/api/cbt/attempts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: attempt.id, cbtScore: edited === undefined ? undefined : Number(edited) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Could not confirm the attempt.");
      return;
    }
    load();
  };

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <h4 className="font-bold text-xs text-slate-800">CBT attempts awaiting teacher review</h4>
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      {attempts === null ? (
        <p className="text-[11px] text-slate-500">Loading…</p>
      ) : attempts.length === 0 ? (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> No attempts are waiting for review.
        </p>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Student</th>
              <th>Subject</th>
              <th>Warnings</th>
              <th>Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-1.5">
                  {a.students?.full_name ?? "Unknown"} ({a.students?.admission_no ?? "-"})
                </td>
                <td>{a.subject}</td>
                <td className={a.is_expelled ? "text-rose-600 font-bold" : ""}>{a.strikes}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={a.max_marks}
                    aria-label={`Score for ${a.students?.full_name ?? a.id}`}
                    value={scores[a.id] ?? String(a.cbt_score)}
                    onChange={(e) => setScores((s) => ({ ...s, [a.id]: e.target.value }))}
                    className="w-16 border border-slate-200 rounded px-1 py-0.5"
                  />{" "}
                  / {a.max_marks}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => confirm(a)}
                    className="px-2 py-1 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                  >
                    Confirm
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
