"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeInvoices,
  InvoiceRecord,
  useRealtimeStudents,
  useRealtimeFees,
} from "@/lib/realtime-store";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Printer,
  Sparkles,
  Trash2,
} from "lucide-react";

export default function InvoicingAccountsPage() {
  const { invoices, recordPayment } = useRealtimeInvoices();
  const { students } = useRealtimeStudents();
  const { fees } = useRealtimeFees();

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount) return;

    const added = parseInt(paymentAmount, 10) || 0;
    recordPayment(selectedInvoice.id, added);

    setNotificationMsg(
      `Payment of ₦${added.toLocaleString()} recorded for ${selectedInvoice.studentName} (${selectedInvoice.invoiceNo})`
    );
    setTimeout(() => setNotificationMsg(null), 4000);

    setSelectedInvoice(null);
    setPaymentAmount("");
  };

  const handleSyncInvoicesFromStudents = () => {
    if (students.length === 0) {
      alert("No students registered. Please enroll students first in Students Management.");
      return;
    }

    const standardTermFee =
      fees.length > 0
        ? fees.reduce((s, f) => s + f.amount, 0)
        : 145000;

    const existingMap = new Map(invoices.map((i) => [i.admissionNo, i]));
    const newInvoices: InvoiceRecord[] = [];

    students.forEach((std, idx) => {
      if (!existingMap.has(std.admissionNo)) {
        const invSeq = (invoices.length + newInvoices.length + 1).toString().padStart(4, "0");
        newInvoices.push({
          id: `inv-${Date.now()}-${idx}`,
          invoiceNo: `RCA/INV/${new Date().getFullYear()}/${invSeq}`,
          admissionNo: std.admissionNo,
          studentName: std.fullName,
          className: std.className,
          amountBilled: standardTermFee,
          amountPaid: std.feeStatus === "Fully Cleared" ? standardTermFee : 0,
          paymentStatus: std.feeStatus === "Fully Cleared" ? "Paid" : "Unpaid",
          lastPaymentDate: std.feeStatus === "Fully Cleared" ? new Date().toISOString().split("T")[0] : "",
        });
      }
    });

    if (newInvoices.length === 0) {
      setNotificationMsg("All registered students already have active invoices for this term.");
    } else {
      const updated = [...newInvoices, ...invoices];
      if (typeof window !== "undefined") {
        localStorage.setItem("rca_invoices_store_v6", JSON.stringify(updated));
        window.location.reload();
      }
      setNotificationMsg(`Generated ${newInvoices.length} new student invoices!`);
    }
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const totalBilled = invoices.reduce((s, i) => s + i.amountBilled, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = totalBilled - totalCollected;
  const collectionRate = ((totalCollected / (totalBilled || 1)) * 100).toFixed(1);

  const filtered = invoices.filter((i) => {
    const matchesStatus = statusFilter === "all" || i.paymentStatus === statusFilter;
    const matchesSearch =
      i.studentName.toLowerCase().includes(search.toLowerCase()) ||
      i.admissionNo.toLowerCase().includes(search.toLowerCase()) ||
      i.invoiceNo.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
              <span className="text-slate-800 font-semibold">Invoicing &amp; Billing</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                School Fees &amp; Billing Operations
              </h1>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                Realtime Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bursary management, termly tuition invoicing, and payment reconciliation for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncInvoicesFromStudents}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Sync Invoices from Students ({students.length})
            </button>
            <Link
              href="/setup/fees"
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <CreditCard className="w-4 h-4 text-blue-600" />
              Fee Structure
            </Link>
          </div>
        </div>

        {/* Notification Toast */}
        {notificationMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            {notificationMsg}
          </div>
        )}

        {/* Financial Metrics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-medium text-slate-500">Total Invoiced (Term)</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">₦{totalBilled.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400">{invoices.length} Registered Invoices</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-medium text-slate-500">Total Fees Collected</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-1">₦{totalCollected.toLocaleString()}</p>
            <span className="text-[10px] text-emerald-600 font-medium">Reconciled in Bursary</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-medium text-slate-500">Outstanding Balance</p>
            <p className="text-xl font-extrabold text-amber-600 mt-1">₦{totalOutstanding.toLocaleString()}</p>
            <span className="text-[10px] text-amber-700 font-medium">Pending payments</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-medium text-slate-500">Collection Efficiency</p>
            <p className="text-xl font-extrabold text-blue-600 mt-1">{collectionRate}%</p>
            <span className="text-[10px] text-blue-600 font-medium">
              {invoices.filter((i) => i.paymentStatus === "Paid").length} Cleared Students
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Invoices
            </button>
            <button
              onClick={() => setStatusFilter("Paid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "Paid"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Fully Paid
            </button>
            <button
              onClick={() => setStatusFilter("Partial")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "Partial"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Partial
            </button>
            <button
              onClick={() => setStatusFilter("Unpaid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "Unpaid"
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Unpaid
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search invoice number, student or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Receipt className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <div className="text-sm font-semibold text-slate-600">No Invoices Found</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No invoices match current filter. Click &apos;Sync Invoices from Students&apos; to generate invoices for all registered students.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Student &amp; ID</th>
                    <th className="py-3 px-3">Class</th>
                    <th className="py-3 px-4 text-right">Billed Amount</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Bursary Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((inv) => {
                    const balance = inv.amountBilled - inv.amountPaid;
                    return (
                      <tr key={inv.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.invoiceNo}</td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{inv.studentName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{inv.admissionNo}</p>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{inv.className}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₦{inv.amountBilled.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                          ₦{inv.amountPaid.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-amber-700">
                          ₦{balance.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.paymentStatus === "Paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : inv.paymentStatus === "Partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {inv.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.paymentStatus !== "Paid" ? (
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-xs cursor-pointer"
                              >
                                Record Payment
                              </button>
                            ) : (
                              <button
                                onClick={() => alert(`Receipt printed for ${inv.studentName} (${inv.invoiceNo})`)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Record Fee Payment */}
        {selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Record School Fee Payment
                </h3>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border text-xs space-y-1">
                <p>
                  Student: <strong className="text-slate-900">{selectedInvoice.studentName}</strong>
                </p>
                <p>
                  Invoice: <strong className="font-mono text-slate-700">{selectedInvoice.invoiceNo}</strong>
                </p>
                <p>
                  Outstanding Due:{" "}
                  <strong className="text-amber-700">
                    ₦{(selectedInvoice.amountBilled - selectedInvoice.amountPaid).toLocaleString()}
                  </strong>
                </p>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Received (₦)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    max={selectedInvoice.amountBilled - selectedInvoice.amountPaid}
                    placeholder="Enter amount paid e.g. 55000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800">
                    <option>Bank Direct Deposit / Teller</option>
                    <option>Electronic Bank Transfer</option>
                    <option>School Bursary POS</option>
                    <option>Cash Receipt</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Reference / Teller No</label>
                  <input
                    type="text"
                    placeholder="e.g. GTB/TRF/98234710"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Confirm &amp; Print Receipt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
