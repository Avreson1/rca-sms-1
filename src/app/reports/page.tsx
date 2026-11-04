"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import {
  useRealtimeStudents,
  useRealtimeInvoices,
  useRealtimeStaff,
  useRealtimeGradingScales,
  calculateGradeForClass,
} from "@/lib/realtime-store";
import { exportToCSV } from "@/lib/csv-utils";
import { fetchCaScoresFromSupabase } from "@/lib/supabase/db";
import {
  FileText,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Users,
  Award,
  Receipt,
  Printer,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function ReportsHubPage() {
  const { students } = useRealtimeStudents();
  const { invoices } = useRealtimeInvoices();
  const { staff } = useRealtimeStaff();
  const { gradingTiers } = useRealtimeGradingScales();
  const { config: school } = useSchoolConfig();
  // Every export below asks the school's records for one session and term. Taken from
  // the compiled constants, a school that had moved into the next session in Settings
  // was forever reading the old one — and answered "no marks are filed" about marks
  // that exist.
  const scope = effectiveScope(school, {
    session: SCHOOL_INFO.currentSession,
    term: SCHOOL_INFO.currentTerm,
  });
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownloadBroadsheet = async () => {
    const headers = [
      "S/N",
      "Admission No",
      "Student Full Name",
      "Class Level",
      "Session",
      "Term",
      "Subject",
      "1st Test (10)",
      "2nd Test (10)",
      "Project (10)",
      "Mid-Term (10)",
      "Exam (60)",
      "Total Score (100)",
      "Tier Grade",
      "Remark",
    ];

    // A broadsheet is a list of filed marks, so it is built from the marks the
    // school filed. This used to print the roster's single score buffer for
    // every pupil — one arbitrary subject's numbers, labelled as the child's
    // continuous assessment, for a term that may never have been run.
    const filed = await fetchCaScoresFromSupabase({
      session: scope.session,
      terms: [scope.term],
    });

    if (filed === null) {
      setDownloadNotice(
        "The broadsheet could not be built: the filed marks could not be read from the school records. Try again once the sync notice clears."
      );
      setTimeout(() => setDownloadNotice(null), 8000);
      return;
    }
    if (filed.length === 0) {
      setDownloadNotice(
        `No marks are filed for ${scope.session}, ${scope.term}, so there is no broadsheet to export. Enter them under Operations → Update CA Scores.`
      );
      setTimeout(() => setDownloadNotice(null), 8000);
      return;
    }

    const nameByAdmission = new Map(students.map((s) => [s.admissionNo, s.fullName]));

    const rows = filed
      .slice()
      .sort((a, b) =>
        `${a.className}${a.admissionNo}${a.subjectName}`.localeCompare(`${b.className}${b.admissionNo}${b.subjectName}`)
      )
      .map((row, idx) => {
        const gradeInfo = calculateGradeForClass(row.total, row.className, gradingTiers);
        return [
          idx + 1,
          row.admissionNo,
          // The mark row is filed against a pupil; if that pupil is no longer on
          // the roll the number still identifies them, so it is printed rather
          // than a name guessed from somewhere else.
          nameByAdmission.get(row.admissionNo) ?? row.admissionNo,
          row.className,
          row.session,
          row.term,
          row.subjectName,
          row.test1,
          row.test2,
          row.project,
          row.midTerm,
          row.exam,
          row.total,
          gradeInfo.grade,
          gradeInfo.remark,
        ];
      });

    exportToCSV(`RCA_Master_Academic_Broadsheet_${scope.session.replace("/", "-")}`, headers, rows);
    setDownloadNotice(`Broadsheet exported: ${rows.length} filed subject results for ${scope.term}.`);
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const handleDownloadDebtorList = () => {
    const headers = [
      "Invoice No",
      "Admission No",
      "Pupil / Student Name",
      "Class Level",
      "Amount Billed (NGN)",
      "Amount Paid (NGN)",
      "Outstanding Debt Balance (NGN)",
      "Payment Status",
      "Last Payment Date",
    ];

    // Only invoices that actually exist. When the invoice table was empty this used to
    // invent a ₦135,000 bill, a payment figure, an invoice number and a payment date for
    // every enrolled pupil and hand that spreadsheet to the bursary.
    if (invoices.length === 0) {
      setDownloadNotice(
        "No invoices are on file, so there is no debtor ledger to export. Raise bills under Accounts → Invoicing first."
      );
      setTimeout(() => setDownloadNotice(null), 8000);
      return;
    }

    const rows = invoices.map((inv) => {
      const balance = inv.amountBilled - inv.amountPaid;
      return [
        inv.invoiceNo,
        inv.admissionNo,
        inv.studentName,
        inv.className,
        inv.amountBilled,
        inv.amountPaid,
        balance,
        inv.paymentStatus,
        inv.lastPaymentDate,
      ];
    });

    exportToCSV(`RCA_Bursary_Fee_Debtor_Ledger_${scope.session.replace("/", "-")}`, headers, rows);
    setDownloadNotice("Bursary Fee Collection & Debtor Ledger CSV downloaded!");
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleDownloadEnrollmentRoster = () => {
    const headers = [
      "Admission No",
      "Full Legal Name",
      "Class Tier",
      "Gender",
      "Sports House",
      "Parent/Guardian Name",
      "Parent Phone",
      "Fee Status",
    ];

    const rows = students.map((s) => [
      s.admissionNo,
      s.fullName,
      s.className,
      s.gender,
      s.house,
      s.guardianName || "N/A",
      s.guardianPhone || "N/A",
      s.feeStatus,
    ]);

    exportToCSV(`RCA_Master_Enrollment_Registry_${scope.session.replace("/", "-")}`, headers, rows);
    setDownloadNotice("Student Enrollment & Sports House Registry CSV downloaded!");
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleDownloadStaffRoster = () => {
    const headers = [
      "Staff ID",
      "Full Legal Name",
      "Institutional Email",
      "Phone Number",
      "Role Tier",
      "Assigned Subjects",
      "Form Class",
      "Form Master Status",
    ];

    const rows = staff.map((st) => [
      st.staffId,
      st.fullName,
      st.email,
      st.phone,
      st.role,
      st.assignedSubjects.join("; "),
      st.assignedClass,
      st.isFormMaster ? "Yes" : "No",
    ]);

    exportToCSV(`RCA_Faculty_Staff_Directory_${scope.session.replace("/", "-")}`, headers, rows);
    setDownloadNotice("Faculty & Staff Workload Directory CSV downloaded!");
    setTimeout(() => setDownloadNotice(null), 3000);
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
              <span className="text-slate-800 font-semibold">Reports</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Institutional Reports &amp; Broadsheets Hub
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate official academic broadsheets, bursary statements, and demographic exports for {SCHOOL_INFO.name}.
            </p>
          </div>
        </div>

        {/* Download Feedback Banner */}
        {downloadNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            {downloadNotice}
          </div>
        )}

        {/* Reports Grid with Direct CSV Export Triggers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Card 1: Master Broadsheet */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Academic Export
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Master Academic Broadsheet</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Consolidated spreadsheet listing every student&apos;s 1st Test, 2nd Test, Project, Mid-Term, CBT Exam, Total Score, and Tier Grade across all class levels (Pre-Play to Primary 5 &amp; Secondary).
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadBroadsheet}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Broadsheet CSV
            </button>
          </div>

          {/* Card 2: Bursary Debtor List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                  Financial Ledger
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Bursary Fee Collection &amp; Debtor Roster</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Comprehensive audit ledger listing invoiced amounts, verified payments, and outstanding balances across all enrolled candidates.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadDebtorList}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Debtor List CSV
            </button>
          </div>

          {/* Card 3: Student Enrollment Registry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Enrollment Registry
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Student Body &amp; House Distribution</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Demographic breakdown of student body across Pre-Play, Play, Nursery 1-2, Primary 1-5, and Secondary with sports house allocations and guardian contacts.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadEnrollmentRoster}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Student Roster CSV
            </button>
          </div>

          {/* Card 4: Staff & Faculty Directory */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  Faculty Directory
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Staff Workload &amp; Role Allocation</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Export complete faculty list with Staff IDs, institutional emails, RBAC roles, assigned subjects, and form class tutor appointments.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadStaffRoster}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Staff Directory CSV
            </button>
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}
