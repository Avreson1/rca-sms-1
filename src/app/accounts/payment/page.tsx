"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeInvoices, type InvoiceRecord } from "@/lib/realtime-store";
import { PAYMENT_CHANNELS } from "@/lib/fee-billing";
import { type ReceiptDetails } from "@/lib/supabase/db";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import { PaymentReceipt } from "@/components/ui/payment-receipt";
import {
  CreditCard,
  ArrowLeft,
  Search,
  CheckCircle2,
  Receipt,
  Printer,
  TriangleAlert,
  ShieldCheck,
  ShieldAlert,
  SearchCode,
} from "lucide-react";
import {
  calculatePaymentBalance,
  type ExistingTransactionMatch,
  type PaymentType,
} from "@/lib/payment-verification";

export default function RecordPaymentPage() {
  const { invoices, recordPayment } = useRealtimeInvoices();
  const { config: school } = useSchoolConfig();
  const scope = effectiveScope(school, { session: SCHOOL_INFO.currentSession, term: SCHOOL_INFO.currentTerm });

  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_CHANNELS[0]);
  const [reference, setReference] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [narration, setNarration] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [slip, setSlip] = useState<{ invoice: InvoiceRecord; receipt: ReceiptDetails } | null>(null);

  // Dedicated Transaction ID Verification Search Bar
  const [verifyQuery, setVerifyQuery] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<{
    loading: boolean;
    checked: boolean;
    exists: boolean;
    match?: ExistingTransactionMatch;
    normalized?: string;
  }>({ loading: false, checked: false, exists: false });

  // Inline form duplicate detection for reference input
  const [inlineDuplicate, setInlineDuplicate] = useState<ExistingTransactionMatch | null>(null);
  const [isCheckingInline, setIsCheckingInline] = useState(false);

  const schoolName = school?.school_name?.trim() || SCHOOL_INFO.name;
  const owing = invoices.filter((inv) => inv.amountBilled - inv.amountPaid > 0);

  const query = search.trim().toLowerCase();
  const searchable = owing.filter(
    (inv) =>
      !query ||
      inv.studentName.toLowerCase().includes(query) ||
      inv.admissionNo.toLowerCase().includes(query) ||
      inv.invoiceNo.toLowerCase().includes(query)
  );

  const selectedInvoice = searchable.find((inv) => inv.id === selectedInvoiceId) ?? searchable[0] ?? null;
  const balance = selectedInvoice ? Math.max(0, selectedInvoice.amountBilled - selectedInvoice.amountPaid) : 0;

  // Auto-calculated balance and payment type
  const enteredAmount = parseInt(amountPaid, 10) || 0;
  const calculated = selectedInvoice
    ? calculatePaymentBalance(selectedInvoice.amountBilled, selectedInvoice.amountPaid, enteredAmount)
    : { balanceRemaining: 0, paymentType: "PARTIAL" as PaymentType };

  // Real-time verification query in dedicated lookup bar
  useEffect(() => {
    const trimmed = verifyQuery.trim();
    if (!trimmed || trimmed.length < 3) {
      setVerifyStatus({ loading: false, checked: false, exists: false });
      return;
    }

    const timer = setTimeout(async () => {
      setVerifyStatus((prev) => ({ ...prev, loading: true }));
      try {
        const res = await fetch(`/api/payments/verify?transactionId=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success) {
          setVerifyStatus({
            loading: false,
            checked: true,
            exists: data.exists,
            match: data.match,
            normalized: data.normalizedId,
          });
        } else {
          setVerifyStatus({ loading: false, checked: false, exists: false });
        }
      } catch {
        setVerifyStatus({ loading: false, checked: false, exists: false });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [verifyQuery]);

  // Real-time duplicate cross-check for the reference input field in the payment form
  useEffect(() => {
    const trimmed = reference.trim();
    if (!trimmed || trimmed.length < 3) {
      setInlineDuplicate(null);
      setIsCheckingInline(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingInline(true);
      try {
        const res = await fetch(`/api/payments/verify?transactionId=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success && data.exists) {
          setInlineDuplicate(data.match);
        } else {
          setInlineDuplicate(null);
        }
      } catch {
        setInlineDuplicate(null);
      } finally {
        setIsCheckingInline(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [reference]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (inlineDuplicate) {
      setNotice({
        tone: "warn",
        text: `Cannot file payment: Transaction ID "${reference}" was already logged for ${inlineDuplicate.studentName} (${inlineDuplicate.className}) on ${inlineDuplicate.paymentDate}. Duplicate submission is blocked.`,
      });
      return;
    }

    const amount = parseInt(amountPaid, 10) || 0;
    if (amount <= 0) {
      setNotice({ tone: "warn", text: "Enter the amount actually received, in Naira, above zero. Nothing was filed." });
      return;
    }

    if (!reference.trim()) {
      setNotice({ tone: "warn", text: "Enter a valid bank transaction reference or teller ID." });
      return;
    }

    if (!payeeName.trim()) {
      setNotice({ tone: "warn", text: "Enter the full name of the parent/guardian who made the payment." });
      return;
    }

    setBusy(true);

    // 1. Call verified payment records API with idempotency and duplicate checking
    try {
      const recordRes = await fetch("/api/payments/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedInvoice.admissionNo,
          studentName: selectedInvoice.studentName,
          admissionNo: selectedInvoice.admissionNo,
          className: selectedInvoice.className,
          session: selectedInvoice.session || scope.session,
          term: selectedInvoice.term || scope.term,
          transactionId: reference.trim(),
          amountPaid: amount,
          totalFeeExpected: selectedInvoice.amountBilled,
          previouslyPaid: selectedInvoice.amountPaid,
          payeeName: payeeName.trim(),
          narration: narration.trim(),
          paymentMethod: paymentMethod,
        }),
      });

      const recordJson = await recordRes.json();
      if (!recordJson.success) {
        setBusy(false);
        setNotice({
          tone: "warn",
          text: recordJson.error || "Payment recording failed. Please check transaction ID.",
        });
        return;
      }

      // 2. Sync to local invoice store for immediate UI update
      const outcome = await recordPayment(selectedInvoice.id, amount, {
        paymentChannel: paymentMethod,
        bankReference: reference.trim(),
      });
      setBusy(false);

      const receiptRef = recordJson.receipt?.ref || outcome.receipt?.ref || "REC-OFFICIAL";
      const updatedInvoice: InvoiceRecord = outcome.invoice ?? {
        ...selectedInvoice,
        amountPaid: selectedInvoice.amountPaid + amount,
        paymentStatus: selectedInvoice.amountPaid + amount >= selectedInvoice.amountBilled ? "Paid" : "Partial",
      };

      const receiptDetails: ReceiptDetails = {
        ref: receiptRef,
        amount,
        channel: paymentMethod,
        bankReference: reference.trim(),
        receivedBy: "Bursary Officer",
        issuedAt: new Date().toISOString(),
      };

      setSlip({ invoice: updatedInvoice, receipt: receiptDetails });
      setNotice({
        tone: "ok",
        text: `₦${amount.toLocaleString()} filed against ${selectedInvoice.invoiceNo} (${selectedInvoice.studentName}) — Receipt ${receiptRef} issued. Type: ${calculated.paymentType}. Balance remaining: ₦${calculated.balanceRemaining.toLocaleString()}.`,
      });

      setAmountPaid("");
      setReference("");
      setPayeeName("");
      setNarration("");
    } catch {
      setBusy(false);
      setNotice({
        tone: "warn",
        text: "Network error occurred while filing payment. Nothing was charged.",
      });
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="flex min-h-6 items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Accounts</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Record Payment</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Bursary Fee Collection &amp; Receipts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              File verified payments with real-time duplicate transaction detection and automated balance computation for {schoolName}.
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

        {/* Real-Time Transaction ID Verification Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <SearchCode className="w-4 h-4 text-blue-600" />
              <span>Verify Transaction ID &amp; Cross-Check</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Type or paste a bank teller, mobile transfer ID, or POS reference to check for duplicate claims.
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Paste Transaction Reference (e.g. GTB/TRF/2026/09124, POS-9982, ZENITH-REF-102)..."
              value={verifyQuery}
              onChange={(e) => setVerifyQuery(e.target.value)}
              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-24 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            {verifyStatus.loading && (
              <span className="absolute right-3 top-2.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Verifying...
              </span>
            )}
          </div>

          {verifyStatus.checked && (
            <div className="animate-in fade-in">
              {verifyStatus.exists && verifyStatus.match ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2 text-rose-950">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>DUPLICATE TRANSACTION DETECTED — Already Claimed &amp; Logged!</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/70 p-3 rounded-lg border border-rose-100 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Student</span>
                      <strong className="text-slate-800">{verifyStatus.match.studentName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Class</span>
                      <strong className="text-slate-800">{verifyStatus.match.className}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Amount Paid</span>
                      <strong className="text-rose-700">₦{verifyStatus.match.amountPaid.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Payee / Payer</span>
                      <strong className="text-slate-800">{verifyStatus.match.payeeName}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px]">Narration</span>
                      <span className="text-slate-700">{verifyStatus.match.narration || "No narration text"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Date Recorded</span>
                      <span className="text-slate-700">{verifyStatus.match.paymentDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Logged By</span>
                      <span className="text-slate-700">{verifyStatus.match.recordedBy}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs flex items-center gap-2 text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    <strong>Transaction ID Unclaimed &amp; Valid:</strong> No previous payment record matches{" "}
                    <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-800">
                      {verifyStatus.normalized}
                    </code>
                    . Safe to record as a new payment.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action notice */}
        {notice && (
          <div
            className={`${
              notice.tone === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-300 text-amber-950"
            } rounded-xl p-4 text-xs font-semibold flex items-start gap-2`}
            role="status"
          >
            {notice.tone === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            )}
            <p className="whitespace-pre-line">{notice.text}</p>
          </div>
        )}

        {owing.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-800">
              {invoices.length === 0
                ? "No invoice is filed on the school's records"
                : `All ${invoices.length} filed invoices are fully cleared`}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {invoices.length === 0
                ? `Raise the bills for ${scope.session}, ${scope.term} in Accounts → Invoicing & Billing before taking money.`
                : "All current invoices are cleared. Reprint receipts from the invoice registry if needed."}
            </p>
            <Link
              href="/accounts/invoicing"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Go to Invoicing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
            {/* Payment Form */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Record Verified Payment
              </h3>

              <form onSubmit={handlePay} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Search Student or Invoice</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Name, admission number or invoice number"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Invoice Still Owed Money ({searchable.length} of {owing.length} shown)
                  </label>
                  <select
                    value={selectedInvoice?.id ?? ""}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  >
                    {searchable.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.studentName} ({inv.invoiceNo}) — Due: ₦
                        {(inv.amountBilled - inv.amountPaid).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Amount Received (₦)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={balance || undefined}
                      step={1}
                      placeholder={balance ? balance.toLocaleString() : "0"}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 font-mono"
                    />
                    {enteredAmount > 0 && (
                      <div className="flex items-center justify-between text-[11px] mt-1 font-mono">
                        <span className="text-slate-500">Remaining Balance:</span>
                        <strong className="text-red-700">₦{calculated.balanceRemaining.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                    >
                      {PAYMENT_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                    {enteredAmount > 0 && (
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="text-slate-500">Classification:</span>
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            calculated.paymentType === "FULL"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {calculated.paymentType} PAYMENT
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Bank Reference / Transaction ID</label>
                    {isCheckingInline ? (
                      <span className="text-[10px] text-blue-600 font-bold">Checking uniqueness...</span>
                    ) : inlineDuplicate ? (
                      <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Duplicate Detected!
                      </span>
                    ) : reference.trim().length >= 3 ? (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Unique
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g. GTB/TRF/998231405 or ZENITH-REF-001"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className={`w-full p-2.5 bg-slate-50 border rounded-lg font-mono text-slate-800 ${
                      inlineDuplicate ? "border-rose-400 bg-rose-50/50" : "border-slate-200"
                    }`}
                  />
                  {inlineDuplicate && (
                    <p className="text-[10px] text-rose-700 font-semibold mt-1">
                      ⚠️ Reference already used for {inlineDuplicate.studentName} ({inlineDuplicate.className}) on{" "}
                      {inlineDuplicate.paymentDate}. You cannot log this reference again.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Payee / Depositor Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Full name on bank receipt / parent name"
                      value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Narration / Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. 1st term tuition deposit via mobile app"
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || searchable.length === 0 || !!inlineDuplicate}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {busy ? "Filing On School Records..." : "File Verified Payment & Issue Receipt"}
                </button>
              </form>
            </div>

            {/* The slip itself */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-3 text-center">
                <h4 className="font-extrabold text-sm text-slate-900">{schoolName}</h4>
                <p className="text-[10px] text-slate-500">
                  {slip ? "Issued bursary receipt" : "Standing of the selected invoice"}
                </p>
              </div>

              {slip ? (
                <>
                  <PaymentReceipt schoolName={schoolName} invoice={slip.invoice} receipt={slip.receipt} />
                  <button
                    onClick={() => window.print()}
                    className="w-full py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Official Receipt
                  </button>
                </>
              ) : selectedInvoice ? (
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student:</span>
                    <span className="font-bold text-slate-900">{selectedInvoice.studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Admission No:</span>
                    <span className="font-bold text-slate-900">{selectedInvoice.admissionNo}</span>
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
                  <p className="text-[10px] text-slate-500 pt-1">
                    Select an invoice and submit the form to generate the official payment slip.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">Select an invoice to see what it owes.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
