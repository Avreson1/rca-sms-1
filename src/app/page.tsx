"use client";

import React from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SubjectsCard } from "@/components/dashboard/subjects-card";
import { TodayDutyPanel } from "@/components/dashboard/today-duty-panel";
import { UsersOnlineWidget } from "@/components/dashboard/users-online";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth, useRealtimeStudents } from "@/lib/realtime-store";
import {
  FileText,
  Laptop,
  Mail,
  GraduationCap,
  CheckCircle2,
  Calendar,
  Receipt,
  CreditCard,
  Settings2,
  Award,
  Layers,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardHome() {
  const { currentUser } = useRealtimeAuth();
  const { students } = useRealtimeStudents();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Identity comes from the server session only; naming a super admin here used to
  // greet visitors as someone who may never have signed in.
  const activeUser = mounted ? currentUser : null;

  const userFullName = activeUser?.fullName;
  const userRole = activeUser?.role;
  const userStaffId = activeUser?.staffId;

  // Dynamic assigned subjects based on active user or curriculum
  const assignedSubjects = activeUser?.assignedSubject
    ? [
        {
          id: "sub-assigned",
          name: activeUser.assignedSubject,
          className: activeUser.assignedClass || "",
          studentsCount: students.filter((s) => s.className === activeUser.assignedClass).length || 0,
          caSubmitted: false,
        },
      ]
    : [];

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return { label: "Tier 1: Super Administrator", bg: "bg-brand-50 text-brand-700 border-brand-200" };
      case "EXAM_OFFICER":
        return { label: "Tier 2: Exam Officer & Dean", bg: "bg-azure-50 text-azure-700 border-azure-200" };
      case "TEACHER":
        return { label: "Tier 3: Form / Subject Teacher", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "ACCOUNTANT":
        return { label: "Tier 4: Bursar & Accounts Officer", bg: "bg-amber-50 text-amber-800 border-amber-200" };
      case "STUDENT_PARENT":
        return { label: "Tier 5: Student & Parent Guardian", bg: "bg-slate-100 text-slate-600 border-slate-200" };
      case "TESTERS":
        return { label: "Tester Access", bg: "bg-accent-50 text-accent-700 border-accent-200" };
      default:
        return { label: "Authorized Staff Member", bg: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  const roleBadge = getRoleBadge(userRole);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Welcome & Live User Header */}
        <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-6 shadow-2xs">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-600" />
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2 pl-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                {userRole && (
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${roleBadge.bg}`}>
                    {roleBadge.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-2.5 py-1 font-mono text-[10px] font-medium tabular-nums text-slate-500">
                  <Calendar className="h-3 w-3 text-brand-600" strokeWidth={2} />
                  {SCHOOL_INFO.currentSession} · {SCHOOL_INFO.currentTerm}
                </span>
              </div>

              <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
                {userFullName ? `Welcome back, ${userFullName}` : "Signing in…"}
              </h2>

              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
                <span>
                  Staff ID / Ref:{" "}
                  <strong className="font-mono font-semibold tabular-nums text-slate-700">{userStaffId || "—"}</strong>
                </span>
                <span aria-hidden="true" className="text-slate-300">•</span>
                <span>
                  Institution: <strong className="font-semibold text-slate-700">{SCHOOL_INFO.name}</strong>
                </span>
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3 self-start rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 md:self-auto">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <div>
                <p className="font-display text-[13px] font-bold tracking-tight text-emerald-900">Signed in</p>
                <p className="text-[11px] text-emerald-800">On this browser, for this session</p>
              </div>
            </div>
          </div>
        </div>

        {/* Core Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* Left 8 Columns: Role-Specific Overview & Quick Actions */}
          <div className="space-y-6 lg:col-span-8">

            {/* Subjects / Class Allocation Widget (for Teachers & Academic Staff) */}
            {userRole !== "STUDENT_PARENT" && userRole !== "ACCOUNTANT" && (
              <SubjectsCard subjects={assignedSubjects} />
            )}

            {/* Quick Actions Matrix Customized by Role */}
            <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-2xs sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-extrabold tracking-tight text-ink">
                  Authorized workspace actions
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Filtered by role tier
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Actions for SUPER_ADMIN & EXAM_OFFICER */}
                {(userRole === "SUPER_ADMIN" || userRole === "EXAM_OFFICER") && (
                  <>
                    <Link
                      href="/operations/update-ca"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition-colors duration-150 group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600">
                        <FileText className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-brand-700">
                            Update Continuous Assessment
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-brand-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Input test scores, assignments, and practical marks</p>
                      </div>
                    </Link>

                    <Link
                      href="/setup/ca-structure"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-azure-200 hover:bg-azure-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-azure-50 text-azure-600 ring-1 ring-inset ring-azure-100 transition-colors duration-150 group-hover:bg-azure-600 group-hover:text-white group-hover:ring-azure-600">
                        <Layers className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-azure-700">
                            CA Tier Structures
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-azure-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Assign max marks for Play, Nursery, Primary &amp; Secondary</p>
                      </div>
                    </Link>

                    <Link
                      href="/operations/score-card"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-accent-200 hover:bg-accent-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-100 transition-colors duration-150 group-hover:bg-accent-600 group-hover:text-white group-hover:ring-accent-600">
                        <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-accent-700">
                            Generate Score Cards
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-accent-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Compile term grades, position sheets &amp; newsletters</p>
                      </div>
                    </Link>

                    <Link
                      href="/cbt"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-amber-200 hover:bg-amber-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 transition-colors duration-150 group-hover:bg-amber-600 group-hover:text-white group-hover:ring-amber-600">
                        <Laptop className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-amber-800">
                            CBT Examination Engine
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-amber-700" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Manage online questions, tests &amp; invigilation</p>
                      </div>
                    </Link>
                  </>
                )}

                {/* Actions for TEACHER */}
                {userRole === "TEACHER" && (
                  <>
                    <Link
                      href="/operations/update-ca"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition-colors duration-150 group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600">
                        <FileText className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-brand-700">
                            Enter Class CA Scores
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-brand-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Record continuous assessment marks for assigned students</p>
                      </div>
                    </Link>

                    <Link
                      href="/operations/traits-assessments"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-emerald-200 hover:bg-emerald-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 transition-colors duration-150 group-hover:bg-emerald-600 group-hover:text-white group-hover:ring-emerald-600">
                        <Award className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-emerald-700">
                            Traits &amp; Psychomotor Rubric
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-emerald-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Rate affective behaviors and practical skills</p>
                      </div>
                    </Link>

                    <Link
                      href="/operations/score-card"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-accent-200 hover:bg-accent-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-100 transition-colors duration-150 group-hover:bg-accent-600 group-hover:text-white group-hover:ring-accent-600">
                        <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-accent-700">
                            Class Score Cards
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-accent-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Inspect terminal scores and class report cards</p>
                      </div>
                    </Link>

                    <Link
                      href="/cbt"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-amber-200 hover:bg-amber-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 transition-colors duration-150 group-hover:bg-amber-600 group-hover:text-white group-hover:ring-amber-600">
                        <Laptop className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-amber-800">
                            CBT Questions &amp; Monitor
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-amber-700" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Contribute questions and monitor active sessions</p>
                      </div>
                    </Link>
                  </>
                )}

                {/* Actions for ACCOUNTANT */}
                {userRole === "ACCOUNTANT" && (
                  <>
                    <Link
                      href="/accounts/invoicing"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-amber-200 hover:bg-amber-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 transition-colors duration-150 group-hover:bg-amber-600 group-hover:text-white group-hover:ring-amber-600">
                        <Receipt className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-amber-800">
                            Generate Student Invoices
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-amber-700" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Bill enrolled students by class and fee schedule</p>
                      </div>
                    </Link>

                    <Link
                      href="/accounts/payment"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-emerald-200 hover:bg-emerald-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 transition-colors duration-150 group-hover:bg-emerald-600 group-hover:text-white group-hover:ring-emerald-600">
                        <CreditCard className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-emerald-700">
                            Record Fee Payments
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-emerald-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Issue payment receipts and update ledger</p>
                      </div>
                    </Link>

                    <Link
                      href="/setup/fees"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition-colors duration-150 group-hover:bg-brand-600 group-hover:text-white group-hover:ring-brand-600">
                        <Settings2 className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-brand-700">
                            Fee Structure Setup
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-brand-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Manage tuition, development, and optional fee items</p>
                      </div>
                    </Link>

                    <Link
                      href="/accounts/transactions"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-100/70"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors duration-150 group-hover:bg-slate-700 group-hover:text-white group-hover:ring-slate-700">
                        <FileText className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-slate-700">
                            Audit &amp; Transactions
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-slate-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Reconcile payments and track income streams</p>
                      </div>
                    </Link>
                  </>
                )}

                {/* Actions for STUDENT_PARENT */}
                {userRole === "STUDENT_PARENT" && (
                  <>
                    <Link
                      href="/operations/score-card"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-accent-200 hover:bg-accent-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-100 transition-colors duration-150 group-hover:bg-accent-600 group-hover:text-white group-hover:ring-accent-600">
                        <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-accent-700">
                            View Terminal Score Card
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-accent-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Access official report card, grades, and teacher remarks</p>
                      </div>
                    </Link>

                    <Link
                      href="/cbt"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-amber-200 hover:bg-amber-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 transition-colors duration-150 group-hover:bg-amber-600 group-hover:text-white group-hover:ring-amber-600">
                        <Laptop className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-amber-800">
                            CBT Online Exam Room
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-amber-700" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Take scheduled continuous assessments and tests</p>
                      </div>
                    </Link>

                    <Link
                      href="/accounts/invoicing"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-emerald-200 hover:bg-emerald-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 transition-colors duration-150 group-hover:bg-emerald-600 group-hover:text-white group-hover:ring-emerald-600">
                        <Receipt className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-emerald-700">
                            Fee Invoices &amp; Receipts
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-emerald-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">View tuition breakdown and payment verification</p>
                      </div>
                    </Link>

                    <Link
                      href="/inmail"
                      className="group flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-azure-200 hover:bg-azure-50/60"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-azure-50 text-azure-600 ring-1 ring-inset ring-azure-100 transition-colors duration-150 group-hover:bg-azure-600 group-hover:text-white group-hover:ring-azure-600">
                        <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-display text-[13px] font-bold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-azure-700">
                            Memo Drafts
                          </h4>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-300 transition-colors duration-150 group-hover:text-azure-600" strokeWidth={2} />
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">Write a memo on this machine — nothing is sent</p>
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </section>

            {/* Memo draft pad — deliberately not a mailbox */}
            <div className="texture-grid-light relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-900 to-night-900 p-5 text-white shadow-lg ring-1 ring-inset ring-white/10 sm:flex-row sm:items-center sm:p-6">
              <div className="relative space-y-2">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-200">
                  Memo draft pad
                </span>
                <h4 className="font-display text-base font-extrabold tracking-tight text-white">
                  Write it here, send it yourself
                </h4>
                <p className="max-w-xl text-[12px] leading-relaxed text-white/65">
                  Drafts stay on the machine that wrote them. The portal sends no messages: copy the memo into the
                  school&apos;s email, print it, or make the call.
                </p>
              </div>
              <Link
                href="/inmail"
                className="group relative inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-accent-600 px-4 font-display text-[13px] font-bold tracking-tight text-white transition-colors duration-150 hover:bg-accent-700"
              >
                <Mail className="h-4 w-4" strokeWidth={2} />
                <span>Open the pad</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>
            </div>

          </div>

          {/* Right Column: Today's duties, then the live presence widget */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <TodayDutyPanel />
            <UsersOnlineWidget />
          </div>

        </div>
      </div>
    </DashboardShell>
  );
}