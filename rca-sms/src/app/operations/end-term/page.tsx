"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Archive,
  Sparkles,
} from "lucide-react";

export default function EndTermOperationsPage() {
  const [checklist, setChecklist] = useState({
    caScoresSubmitted: true,
    cbtExamsFinished: true,
    traitsEvaluated: true,
    bursaryCleared: false,
    resultsApproved: true,
  });

  const [isArchiving, setIsArchiving] = useState(false);
  const [archivedSuccess, setArchivedSuccess] = useState(false);

  const handleArchive = () => {
    setIsArchiving(true);
    setTimeout(() => {
      setIsArchiving(false);
      setArchivedSuccess(true);
    }, 2000);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header */}
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
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              End of Term Rollover & Archival
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Lock current gradebooks, archive academic records, and transition to the next academic term for {SCHOOL_INFO.name}.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {archivedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            {SCHOOL_INFO.currentTerm} ({SCHOOL_INFO.currentSession}) successfully archived! Next term initialized.
          </div>
        )}

        {/* Readiness Checklist */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-2xl space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-blue-600" />
            Term Closure Audit Checklist
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800">1. All Subject Continuous Assessment (CA) Scores Locked</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800">2. Proctored CBT Assessments Finalized & Synced</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800">3. Affective & Psychomotor Form Teacher Traits Submitted</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800">4. Dean of Studies Result Release Approval</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleArchive}
              disabled={isArchiving}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              {isArchiving ? "Locking & Archiving Term Data..." : "Archive Term & Initialize Second Term"}
            </button>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
