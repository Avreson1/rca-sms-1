"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeInvoices } from "@/lib/realtime-store";
import {
  CreditCard,
  ArrowLeft,
  Search,
  CheckCircle2,
  Receipt,
  Printer,
  DollarSign,
  Plus,
} from "lucide-react";

export default function RecordPaymentPage() {
  const { invoices, recordPayment } = useRealtimeInvoices();
  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || "");
  const [amountPaid, setAmountPaid] = useState<number>(50000);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [toast, setToast] = useState(false);

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];
  const balance = selectedInvoice ? Math.max(0, selectedInvoice.amountBilled - selectedInvoice.amountPaid) : 0;

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || amountPaid <= 0) return;

    recordPayment(selectedInvoice.id, amountPaid);
    setToast(true);
    setTimeout(() => setToast(false), 4000);
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
              <span className="text-slate-800 font-semibold">Record Payment</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Bursary Fee Collection & Receipts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record bank transfers, cash tellers, and generate instant printable receipts for {SCHOOL_INFO.name}.
            </p>
          </div>

          <Link
            href="/accounts/invoicing"
            className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto"
          >
            <Receipt className="w-4 h-4" />
            View All Invoices
          </Link>
        </div>

        {/* Toast */}
        {toast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Payment of ₦{amountPaid.toLocaleString()} recorded for {selectedInvoice?.studentName}! Invoice balance updated live.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
          
          {/* Payment Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Direct Payment Entry
            </h3>

            <form onSubmit={handlePay} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Student Invoice</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                >
                  {invoices.map((inv) => {
                    const invBalance = inv.amountBilled - inv.amountPaid;
                    return (
                      <option key={inv.id} value={inv.id}>
                        {inv.studentName} ({inv.invoiceNo}) — Due: ₦{invBalance.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount to Pay (₦)</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="POS Terminal">POS Card Terminal</option>
                    <option value="Cash Deposit">Bank Teller Cash Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Reference / Teller No</label>
                <input
                  type="text"
                  placeholder="e.g. GTB/TRF/998231405"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Submit Payment & Print Receipt
              </button>
            </form>
          </div>

          {/* Receipt Preview */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h4 className="font-extrabold text-sm text-slate-900">{SCHOOL_INFO.name}</h4>
              <p className="text-[10px] text-slate-500">Official Electronic Bursary Receipt</p>
            </div>

            {selectedInvoice && (
              <div className="space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Billed:</span>
                  <span className="font-bold text-slate-900">₦{selectedInvoice.amountBilled.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Paid:</span>
                  <span className="font-bold text-emerald-700">₦{selectedInvoice.amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                  <span className="text-slate-700 font-bold">Outstanding:</span>
                  <span className="font-extrabold text-red-600">₦{balance.toLocaleString()}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => alert("Printing official payment receipt...")}
              className="w-full py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt Slip
            </button>
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}
