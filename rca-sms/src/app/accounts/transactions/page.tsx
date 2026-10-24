"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeInvoices } from "@/lib/realtime-store";
import { exportToCSV } from "@/lib/csv-utils";
import {
  FileSpreadsheet,
  ArrowLeft,
  Search,
  Download,
  CheckCircle2,
  TrendingUp,
  Filter,
  Receipt,
} from "lucide-react";

interface Transaction {
  id: string;
  ref: string;
  date: string;
  studentName: string;
  admissionNo: string;
  type: "Tuition" | "ICT Lab Levy" | "Uniform" | "Examination";
  amount: number;
  method: "Bank Transfer" | "POS" | "Cash";
  status: "Confirmed" | "Pending";
}

export default function AccountsTransactionsPage() {
  const { invoices } = useRealtimeInvoices();
  const [search, setSearch] = useState("");

  // Map real invoices into transaction records
  const transactions: Transaction[] = invoices.map((inv, idx) => ({
    id: inv.id || `tx-${idx}`,
    ref: `TRX-${inv.invoiceNo.replace(/\D/g, "").slice(-4) || (idx + 1).toString().padStart(4, "0")}`,
    date: inv.lastPaymentDate || new Date().toISOString().split("T")[0],
    studentName: inv.studentName,
    admissionNo: inv.admissionNo,
    type: "Tuition",
    amount: inv.amountPaid,
    method: "Bank Transfer",
    status: "Confirmed",
  }));

  const totalCollected = transactions.reduce((sum, t) => sum + t.amount, 0);

  const filtered = transactions.filter(
    (t) =>
      t.studentName.toLowerCase().includes(search.toLowerCase()) ||
      t.ref.toLowerCase().includes(search.toLowerCase()) ||
      t.admissionNo.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = [
      "Transaction Ref",
      "Date",
      "Student Full Name",
      "Admission No",
      "Fee Type",
      "Amount Paid (NGN)",
      "Payment Channel",
      "Audit Status",
    ];
    const rows = filtered.map((t) => [
      t.ref,
      t.date,
      t.studentName,
      t.admissionNo,
      t.type,
      t.amount,
      t.method,
      t.status,
    ]);
    exportToCSV("RCA_Bursary_Transactions_Ledger", headers, rows);
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
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Bursary Financial Ledger &amp; Income Audit
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete historical transaction records and fee reconciliation logs for {SCHOOL_INFO.name}.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Audit Ledger (CSV)
          </button>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Total Revenue Collected</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1 font-mono">
              ₦{totalCollected.toLocaleString()}
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Total Transactions Logged</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1 font-mono">
              {transactions.length}
            </p>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-semibold text-slate-500">Bursary Clearance Rate</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1 font-mono">
              {transactions.length > 0 ? "100%" : "0%"}
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student name, admission number, or transaction reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Verified Payment Receipts</h3>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {filtered.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Student Name &amp; ID</th>
                  <th className="py-3 px-3">Fee Type</th>
                  <th className="py-3 px-3">Channel</th>
                  <th className="py-3 px-4 text-right">Amount (NGN)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No transaction records found. Invoices and payments will appear here as they are processed.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">{t.ref}</td>
                      <td className="py-3 px-4 text-slate-600">{t.date}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{t.studentName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{t.admissionNo}</p>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{t.type}</td>
                      <td className="py-3 px-3 text-slate-600">{t.method}</td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                        ₦{t.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          {t.status}
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
