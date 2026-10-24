"use client";

import React from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmailBanner } from "@/components/dashboard/email-banner";
import { SubjectsCard } from "@/components/dashboard/subjects-card";
import { UsersOnlineWidget } from "@/components/dashboard/users-online";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth, useRealtimeStudents, useRealtimeStaff } from "@/lib/realtime-store";
import {
  FileText,
  Laptop,
  Mail,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Calendar,
  Receipt,
  Users,
  CreditCard,
  BookOpen,
  Settings2,
  ShieldCheck,
  Award,
  Layers,
} from "lucide-react";

export default function DashboardHome() {
  const { currentUser } = useRealtimeAuth();
  const { students } = useRealtimeStudents();
  const { staff } = useRealtimeStaff();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeUser = (mounted ? currentUser : null) || {
    id: "u-025",
    username: "dominic370",
    fullName: "Dr. Dominic Mark",
    role: "SUPER_ADMIN" as const,
    staffId: "RCA/PERS/025",
    email: "dominic370@royalcrownacademy.edu.ng",
    assignedSubject: "Information & Communication Technology",
    assignedClass: "SS 2",
    loginTime: "2026-01-01T00:00:00.000Z",
  };

  const userFullName = activeUser.fullName;
  const userRole = activeUser.role;
  const userStaffId = activeUser.staffId;
  const userEmail = activeUser.email;

  // Dynamic assigned subjects based on active user or curriculum
  const assignedSubjects = activeUser.assignedSubject
    ? [
        {
          id: "sub-assigned",
          name: activeUser.assignedSubject,
          className: activeUser.assignedClass || "Primary 1",
          studentsCount: students.filter((s) => s.className === activeUser.assignedClass).length || 0,
          caSubmitted: false,
        },
      ]
    : [];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return { label: "Tier 1: Super Administrator", bg: "bg-purple-100 text-purple-800 border-purple-200" };
      case "EXAM_OFFICER":
        return { label: "Tier 2: Exam Officer & Dean", bg: "bg-blue-100 text-blue-800 border-blue-200" };
      case "TEACHER":
        return { label: "Tier 3: Form / Subject Teacher", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "ACCOUNTANT":
        return { label: "Tier 4: Bursar & Accounts Officer", bg: "bg-amber-100 text-amber-800 border-amber-200" };
      case "STUDENT_PARENT":
        return { label: "Tier 5: Student & Parent Guardian", bg: "bg-sky-100 text-sky-800 border-sky-200" };
      default:
        return { label: "Authorized Staff Member", bg: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  const roleBadge = getRoleBadge(userRole);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Welcome & Live User Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${roleBadge.bg}`}>
                {roleBadge.label}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {SCHOOL_INFO.currentSession} - {SCHOOL_INFO.currentTerm}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {userFullName}
            </h2>

            <p className="text-xs md:text-sm text-slate-500 flex flex-wrap items-center gap-2">
              <span>Staff ID / Ref: <strong className="font-mono text-slate-800 font-semibold">{userStaffId}</strong></span>
              <span>•</span>
              <span>Institution: <strong className="text-slate-800 font-semibold">{SCHOOL_INFO.name}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl self-start md:self-auto">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Workspace Active</p>
              <p className="text-[11px] text-slate-500">Live VCS Session Synchronized</p>
            </div>
          </div>
        </div>

        {/* Core Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Columns: Role-Specific Overview & Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Subjects / Class Allocation Widget (for Teachers & Academic Staff) */}
            {userRole !== "STUDENT_PARENT" && userRole !== "ACCOUNTANT" && (
              <SubjectsCard subjects={assignedSubjects} />
            )}

            {/* Quick Actions Matrix Customized by Role */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center justify-between">
                <span>Authorized Workspace Actions</span>
                <span className="text-[10px] text-slate-400 font-normal">Filtered by Role Tier</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Actions for SUPER_ADMIN & EXAM_OFFICER */}
                {(userRole === "SUPER_ADMIN" || userRole === "EXAM_OFFICER") && (
                  <>
                    <Link
                      href="/operations/update-ca"
                      className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-600">Update Continuous Assessment</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Input test scores, assignments, and practical marks</p>
                      </div>
                    </Link>

                    <Link
                      href="/setup/ca-structure"
                      className="p-4 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-purple-600">CA Tier Structures</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Assign max marks for Play, Nursery, Primary & Secondary</p>
                      </div>
                    </Link>

                    <Link
                      href="/operations/score-card"
                      className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600">Generate Score Cards</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Compile term grades, position sheets & newsletters</p>
                      </div>
                    </Link>

                    <Link
                      href="/cbt"
                      className="p-4 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-800">CBT Examination Engine</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Manage online questions, tests & invigilation</p>
                      </div>
                    </Link>
                  </>
                )}

                {/* Actions for TEACHER */}
                {userRole === "TEACHER" && (
                  <>
                    <Link
                      href="/operations/update-ca"
                      className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-600">Enter Class CA Scores</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Record continuous assessment marks for assigned students</p>
                      </div>
                    </Link>

                    <Link
                      href="/operations/traits-assessments"
                      className="p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-600">Traits & Psychomotor Rubric</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Rate affective behaviors and practical skills</p>
                      </div>
                    </Link>

                    <Link
                      href="/operations/score-card"
                      className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600">Class Score Cards</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Inspect terminal scores and class report cards</p>
                      </div>
                    </Link>

                    <Link
                      href="/cbt"
                      className="p-4 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-800">CBT Questions & Monitor</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Contribute questions and monitor active sessions</p>
                      </div>
                    </Link>
                  </>
                )}

                {/* Actions for ACCOUNTANT */}
                {userRole === "ACCOUNTANT" && (
                  <>
                    <Link
                      href="/accounts/invoicing"
                      className="p-4 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-600">Generate Student Invoices</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Bill enrolled students by class and fee schedule</p>
                      </div>
                    </Link>

                    <Link
                      href="/accounts/payment"
                      className="p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-600">Record Fee Payments</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Issue payment receipts and update ledger</p>
                      </div>
                    </Link>

                    <Link
                      href="/setup/fees"
                      className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Settings2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-600">Fee Structure Setup</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Manage tuition, development, and optional fee items</p>
                      </div>
                    </Link>

                    <Link
                      href="/accounts/transactions"
                      className="p-4 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-purple-600">Audit & Transactions</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Reconcile payments and track income streams</p>
                      </div>
                    </Link>
                  </>
                )}

                {/* Actions for STUDENT_PARENT */}
                {userRole === "STUDENT_PARENT" && (
                  <>
                    <Link
                      href="/operations/score-card"
                      className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-600">View Terminal Score Card</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Access official report card, grades, and teacher remarks</p>
                      </div>
                    </Link>

                    <Link
                      href="/cbt"
                      className="p-4 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-800">CBT Online Exam Room</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Take scheduled continuous assessments and tests</p>
                      </div>
                    </Link>

                    <Link
                      href="/accounts/invoicing"
                      className="p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-600">Fee Invoices & Receipts</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">View tuition breakdown and payment verification</p>
                      </div>
                    </Link>

                    <Link
                      href="/inmail"
                      className="p-4 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 rounded-xl transition-all group flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-purple-600">Inmail Messages</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Send messages to school management and teachers</p>
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Inmail & Quick Communication Link */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-400/20 px-2.5 py-0.5 rounded-full border border-cyan-400/30">
                  Institutional Inmail Desk
                </span>
                <h4 className="text-base font-bold">Secure Internal Communications</h4>
                <p className="text-xs text-blue-200/80">Connect directly with teachers, coordinators, and school administrators.</p>
              </div>
              <Link
                href="/inmail"
                className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <Mail className="w-4 h-4" />
                <span>Open Desk</span>
              </Link>
            </div>

          </div>

          {/* Right Column: Real-time Users Online Presence Widget */}
          <div className="lg:col-span-1">
            <UsersOnlineWidget />
          </div>

        </div>
      </div>
    </DashboardShell>
  );
}
