"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import { fetchReceiptLedger, type FiledReceipt } from "@/lib/supabase/db";
import { exportToCSV } from "@/lib/csv-utils";
import {
  FileSpreadsheet,
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle2,
  TriangleAlert,
  Receipt,
} from "lucide-react";

/**
 * The money the bursary actually signed for.
 *
 * This list used to be invented from the invoice table: one row per invoice, a
 * reference built out of the invoice number, "Bank Transfer" and "Tuition" and
 * "Confirmed" stamped on all of it, and the amount taken from whatever balance
 * the invoice showed as paid. An audit ledger made that way is worse than no
 * ledger — it looks like evidence. What is shown now is only what
 * /api/payments holds: the receipt rows written when money was received, with
 * the login that filed them and the bank reference typed at the time.
 */
export default function AccountsTransactionsPage() {
  const { config: school } = useSchoolConfig();
  const scope = effectiveScope(school, { session: SCHOOL_INFO.currentSession, term: SCHOOL_INFO.currentTerm });

  const [receipts, setReceipts] = useState<FiledReceipt[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const outcome = await fetchReceiptLedger(
      showAllTerms ? {} : { session: scope.session, term: scope.term }
    );
    setReceipts(outcome.receipts);
    setProblem(outcome.reason);
    setLoading(false);
  }, [scope.session, scope.term, showAllTerms]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = receipts ?? [];
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(
    (row) =>
      !query ||
      row.studentName.toLowerCase().includes(query) ||
      row.admissionNo.toLowerCase().includes(query) ||
      row.invoiceNo.toLowerCase().includes(query) ||
      row.receipt.ref.toLowerCase().includes(query) ||
      row.receipt.bankReference.toLowerCase().includes(query)
  );

  const totalFiled = rows.reduce((sum, row) => sum + row.receipt.amount, 0);
  const filteredTotal = filtered.reduce((sum, row) => sum + row.receipt.amount, 0);
  const invoiceCount = new Set(rows.map((row) => row.invoiceNo.toUpperCase()).filter(Boolean)).size;

  const handleExportCSV = () => {
    const headers = [
      "Receipt No",
      "Received On",
      "Student Full Name",
      "Admission No",
      "Invoice No",
      "Fee Type",
      "Amount (NGN)",
      "Payment Channel",
      "Bank Reference / Teller",
      "Filed By",
      "Session",
      "Term",
    ];
    const data = filtered.map((row) => [
      row.receipt.ref,
      row.receipt.issuedAt,
      row.studentName,
      row.admissionNo,
      row.invoiceNo,
      row.feeType,
      row.receipt.amount,
      row.receipt.channel,
      row.receipt.bankReference,
      row.receipt.receivedBy,
      row.session,
      row.term,
    ]);
    exportToCSV(
      showAllTerms
        ? "RCA_Receipts_Every_Session_And_Term"
        : `RCA_Receipts_${scope.session.replace(/[^0-9A-Za-z]/g, "")}_${scope.term.replace(/[^0-9A-Za-z]/g, "")}`,
      headers,
      data
    );
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
              <span>Accounts</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Transactions</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Filed Receipts &amp; Income Audit
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Every payment {school?.school_name?.trim() || SCHOOL_INFO.name} has received and filed, one receipt per
              line. Currently showing{" "}
              <strong className="text-slate-700">
                {showAllTerms ? "every session and term on file" : `${scope.session}, ${scope.term}`}
              </strong>
              .
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Reading…" : "Refresh"}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export These Receipts (CSV)
            </button>
          </div>
        </div>

        {/* Whether the school's records could be read at all */}
        {problem && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-4 text-xs font-semibold flex items-start gap-2" role="status">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              The receipt file could not be read: {problem}. Nothing is listed below in place of it — an audit screen
              that filled in from this browser would be reporting money nobody received. Run{" "}
              <code className="font-mono">supabase/operations_state.sql</code> if the school has never been set up.
            </p>
          </div>
        )}

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">
              Fees Filed {showAllTerms ? "On File" : `This Term (${scope.term})`}
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1 font-mono">₦{totalFiled.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Sum of the receipt lines below, not of invoice balances.</p>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Receipts Issued</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1 font-mono">{rows.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"} have taken at least one payment
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Shown By This Search</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1 font-mono">₦{filteredTotal.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">{filtered.length} of {rows.length} receipt lines</p>
          </div>
        </div>

        {/* Search & scope toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAllTerms((current) => !current)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                showAllTerms
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
              title="A ledger covering every term adds last year's money to this term's unless you switch it back"
            >
              {showAllTerms ? `Only ${scope.session} · ${scope.term}` : "Every session and term"}
            </button>
            <span className="text-[10px] text-slate-500">
              A payment filed before the bank reference columns existed shows &quot;not recorded&quot; — it is real, but
              the school has no teller slip against it.
            </span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search pupil, admission number, invoice, receipt or bank reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Receipts table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Receipts Issued By The Bursary</h3>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {filtered.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Receipt No</th>
                  <th className="py-3 px-4">Received On</th>
                  <th className="py-3 px-4">Student &amp; ID</th>
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-3">Fee Type</th>
                  <th className="py-3 px-3">Channel / Bank Ref</th>
                  <th className="py-3 px-4 text-right">Amount (NGN)</th>
                  <th className="py-3 px-3">Filed By</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 space-y-2">
                      {loading ? (
                        <p>Reading the school&apos;s receipt file…</p>
                      ) : rows.length === 0 ? (
                        <p className="max-w-md mx-auto">
                          {showAllTerms
                            ? "No payment has ever been filed on the school's records. Take money in Accounts → Record Payment, and the receipt appears here."
                            : `No payment is filed for ${scope.session}, ${scope.term}. Use “Every session and term” above if the money was taken under another term.`}
                        </p>
                      ) : (
                        <p>
                          {rows.length} receipt{rows.length === 1 ? "" : "s"} on file, none matching “{search}”.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.receipt.ref} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">{row.receipt.ref}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(row.receipt.issuedAt).toLocaleDateString()}
                        <p className="text-[10px] text-slate-400">
                          {row.session || "no session"} · {row.term || "no term"}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{row.studentName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{row.admissionNo}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{row.invoiceNo || "invoice removed"}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{row.feeType || "Fee"}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {row.receipt.channel || "Not recorded"}
                        <p className="text-[10px] font-mono text-slate-500">
                          {row.receipt.bankReference || "no bank reference"}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                        ₦{row.receipt.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                        {row.receipt.receivedBy || "not recorded"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            row.status === "Pending"
                              ? "text-amber-800 bg-amber-50 border-amber-200"
                              : "text-emerald-700 bg-emerald-50 border-emerald-200"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {row.status || "Filed"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
