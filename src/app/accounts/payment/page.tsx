"use client";

import React, { useState } from "react";
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
} from "lucide-react";

/**
 * The bursary's payment desk.
 *
 * This screen used to hold an invented ₦50,000 in the amount box, offer payment
 * methods the school's records do not recognise, announce that the balance was
 * "updated live" whatever the server answered, and print nothing behind an
 * "Printing official payment receipt..." popup. Everything below waits for the
 * school's answer: the money moves on its records, the receipt number is the one
 * it issued, and the slip out of the printer carries both.
 */
export default function RecordPaymentPage() {
  const { invoices, recordPayment } = useRealtimeInvoices();
  const { config: school } = useSchoolConfig();
  const scope = effectiveScope(school, { session: SCHOOL_INFO.currentSession, term: SCHOOL_INFO.currentTerm });

  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_CHANNELS[0]);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [slip, setSlip] = useState<{ invoice: InvoiceRecord; receipt: ReceiptDetails } | null>(null);

  const schoolName = school?.school_name?.trim() || SCHOOL_INFO.name;

  // Only an invoice with something still owed belongs on a payment desk; the
  // server refuses a payment against a cleared bill.
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

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amount = parseInt(amountPaid, 10) || 0;
    if (amount <= 0) {
      setNotice({ tone: "warn", text: "Enter the amount actually received, in Naira, above zero. Nothing was filed." });
      return;
    }

    setBusy(true);
    const outcome = await recordPayment(selectedInvoice.id, amount, {
      paymentChannel: paymentMethod,
      bankReference: reference.trim(),
    });
    setBusy(false);

    if (!outcome.ok || !outcome.invoice || !outcome.receipt) {
      setNotice({
        tone: "warn",
        text: `The payment of ₦${amount.toLocaleString()} was NOT filed on ${selectedInvoice.studentName}'s invoice: ${outcome.reason}. Nothing has changed on the school's records, so there is no receipt to print.`,
      });
      return;
    }

    const stillOwed = Math.max(0, outcome.invoice.amountBilled - outcome.invoice.amountPaid);
    setSlip({ invoice: outcome.invoice, receipt: outcome.receipt });
    setNotice({
      tone: "ok",
      text:
        `₦${amount.toLocaleString()} filed against ${outcome.invoice.invoiceNo} (${outcome.invoice.studentName}) — ` +
        `receipt ${outcome.receipt.ref} issued by the school's records for ${paymentMethod}` +
        `${reference.trim() ? `, reference ${reference.trim()}` : ""}. Balance still owed: ₦${stillOwed.toLocaleString()}.`,
    });
    setAmountPaid("");
    setReference("");
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
              File money the school has actually received and print the receipt it issues, for {schoolName}. Bills
              themselves are raised in Accounts → Invoicing &amp; Billing.
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

        {/* What the last filing actually did */}
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
                ? `Raise the bills for ${scope.session}, ${scope.term} in Accounts → Invoicing & Billing before taking money. A payment with no invoice behind it has nowhere to be credited.`
                : "Nothing is left to receive. A family that needs its slip again can have it reprinted from the invoice list."}
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
                Direct Payment Entry
              </h3>

              <form onSubmit={handlePay} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Search the family or invoice</label>
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
                  {searchable.length === 0 && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      No invoice matches “{search}”. Clear the search to pick a family.
                    </p>
                  )}
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
                    <p className="text-[10px] text-slate-500 mt-1">
                      The school&apos;s own balance on this invoice is ₦{balance.toLocaleString()}; more than that is
                      refused.
                    </p>
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
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Reference / Teller No</label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="e.g. GTB/TRF/998231405"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Printed on the receipt and filed with your login as the one who received it, so the money can be
                    matched to a teller slip later.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={busy || searchable.length === 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {busy ? "Filing On The School's Records…" : "File Payment & Issue Receipt"}
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
                    Print This Receipt
                  </button>
                </>
              ) : selectedInvoice ? (
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
                  <p className="text-[10px] text-slate-500 pt-1">
                    This is the invoice as the school holds it — not a receipt. A slip appears here only once a payment
                    is filed and the records give it a receipt number.
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
