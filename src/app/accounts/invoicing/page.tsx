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
  useRealtimeAuth,
} from "@/lib/realtime-store";
import { billForClass, PAYMENT_CHANNELS } from "@/lib/fee-billing";
import { isActionAuthorized } from "@/lib/rbac";
import { fetchFiledReceipts, type FiledReceipt, type ReceiptDetails } from "@/lib/supabase/db";
import { PaymentReceipt } from "@/components/ui/payment-receipt";
import { effectiveScope, useSchoolConfig } from "@/lib/school-config";
import {
  Receipt,
  Search,
  ArrowLeft,
  CheckCircle2,
  TriangleAlert,
  CreditCard,
  Printer,
  Sparkles,
} from "lucide-react";

const TERM_CODES: Record<string, string> = {
  "First Term": "T1",
  "Second Term": "T2",
  "Third Term": "T3",
};

/** "2025/2026" → "2025", for the invoice number a family keeps for years. */
function sessionYear(session: string) {
  const year = session.match(/\d{4}/)?.[0];
  return year ?? (session.replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "CURRENT");
}

function noticeTone(tone: "ok" | "warn") {
  return tone === "ok"
    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : "bg-amber-50 border-amber-300 text-amber-950";
}

export default function InvoicingAccountsPage() {
  const { invoices, recordPayment, addInvoices } = useRealtimeInvoices();
  const { students } = useRealtimeStudents();
  const { fees, feesSource } = useRealtimeFees();
  const { config: school } = useSchoolConfig();
  const { currentUser } = useRealtimeAuth();
  const scope = effectiveScope(school, { session: SCHOOL_INFO.currentSession, term: SCHOOL_INFO.currentTerm });

  // A parent is allowed on this screen to read their own account, and the
  // bursary is the only one who can file a payment: /api/payments accepts POST
  // from SUPER_ADMIN and ACCOUNTANT alone. Offering the button anyway gave
  // families a form that could only ever be refused, and staff the impression
  // the money was recorded when it was not.
  const canBill = isActionAuthorized(currentUser?.role, "EDIT_FEES");

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentChannel, setPaymentChannel] = useState<string>(PAYMENT_CHANNELS[0]);
  const [bankReference, setBankReference] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The slip on screen is the one the server issued. `receiptsFor` is the pupil
  // whose filed receipts are being looked up, so an old payment can be reprinted
  // without the bursary remembering it from the session that took it.
  const [slip, setSlip] = useState<{ invoice: InvoiceRecord; receipt: ReceiptDetails } | null>(null);
  const [receiptsFor, setReceiptsFor] = useState<{ invoice: InvoiceRecord; receipts: FiledReceipt[]; reason: string | null } | null>(null);

  const scopeKey = (record: { admissionNo: string; session?: string; term?: string }) =>
    `${record.admissionNo.trim().toUpperCase()}|${record.session || scope.session}|${record.term || scope.term}`;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount) return;

    const added = parseInt(paymentAmount, 10) || 0;
    if (added <= 0) {
      setNotice({
        tone: "warn",
        text: "Enter the amount actually received, in Naira, above zero. Nothing was filed.",
      });
      return;
    }

    setBusy(true);
    const outcome = await recordPayment(selectedInvoice.id, added, {
      paymentChannel,
      bankReference: bankReference.trim(),
    });
    setBusy(false);

    if (!outcome.ok || !outcome.invoice) {
      setNotice({
        tone: "warn",
        text: `The payment of ₦${added.toLocaleString()} was NOT filed on ${selectedInvoice.studentName}'s invoice: ${outcome.reason}. Nothing has changed on the school's records.`,
      });
      return;
    }

    setSelectedInvoice(null);
    setPaymentAmount("");
    setBankReference("");

    if (outcome.receipt) {
      setSlip({ invoice: outcome.invoice, receipt: outcome.receipt });
      setNotice({
        tone: "ok",
        text:
          `₦${added.toLocaleString()} filed against ${outcome.invoice.invoiceNo} (${outcome.invoice.studentName}) ` +
          `and receipt ${outcome.receipt.ref} issued. The balance on the school's records is now ` +
          `₦${Math.max(0, outcome.invoice.amountBilled - outcome.invoice.amountPaid).toLocaleString()}.`,
      });
    } else {
      setNotice({
        tone: "ok",
        text:
          `₦${added.toLocaleString()} filed against ${outcome.invoice.invoiceNo}, but the server sent no receipt number back — ` +
          `give the family no slip until it is checked on the school's records.`,
      });
    }
  };

  /** Brings back what the school already issued for this pupil, newest first. */
  const handleShowReceipts = async (invoice: InvoiceRecord) => {
    setBusy(true);
    const lookup = await fetchFiledReceipts(invoice.admissionNo);
    setBusy(false);

    const onThisInvoice = lookup.receipts.filter((r) => r.invoiceNo.toUpperCase() === invoice.invoiceNo.toUpperCase());
    if (onThisInvoice.length > 0) {
      setReceiptsFor(null);
      setSlip({ invoice, receipt: onThisInvoice[0].receipt });
      return;
    }
    setReceiptsFor({ invoice, receipts: lookup.receipts, reason: lookup.reason });
  };

  /**
   * Raises one invoice per enrolled pupil for the session and term the school is
   * in, priced from the schedule filed on its records.
   *
   * Three things used to make this screen unsafe to click. The bill was the sum
   * of every fee item, so a Nursery child was charged the senior science lab
   * fee; with no schedule on the device it invented ₦145,000 and wrote it into a
   * real invoice; and a pupil already billed in a previous term was skipped for
   * ever, because "has an invoice" was not qualified by which term. A payment
   * was also stamped as cleared from the child's fee-status label, which put
   * money into the collected total nobody had received.
   */
  const handleSyncInvoicesFromStudents = async () => {
    setBusy(true);
    setNotice(null);

    if (students.length === 0) {
      setBusy(false);
      setNotice({
        tone: "warn",
        text: "No pupil is on the school's records, so there is nothing to bill. Enrol students first in Operations → Students.",
      });
      return;
    }

    if (feesSource !== "server") {
      setBusy(false);
      setNotice({
        tone: "warn",
        text:
          "The school's fee schedule could not be read, so this screen will not price a bill from whatever amounts this browser happens to remember. " +
          "Check the connection, then reload. Nothing was generated.",
      });
      return;
    }

    if (fees.length === 0) {
      setBusy(false);
      setNotice({
        tone: "warn",
        text: `Nothing is on the fee schedule for ${scope.session}, ${scope.term}. Set the amounts in Setup → Fee Structure first — this screen will not invent a price to send families.`,
      });
      return;
    }

    const alreadyBilled = new Set(invoices.map(scopeKey));
    const usedNumbers = new Set(invoices.map((inv) => inv.invoiceNo.trim().toUpperCase()));
    const year = sessionYear(scope.session);
    const termCode = TERM_CODES[scope.term] ?? scope.term.slice(0, 2).toUpperCase();
    const prefix = `RCA/INV/${year}/${termCode}/`;

    let sequence = invoices.filter(
      (inv) => (inv.session || scope.session) === scope.session && (inv.term || scope.term) === scope.term
    ).length;

    const newInvoices: InvoiceRecord[] = [];
    const unpriced: string[] = [];

    for (const student of students) {
      if (alreadyBilled.has(scopeKey(student))) continue;

      const { total } = billForClass(fees, student.className);
      if (total <= 0) {
        unpriced.push(`${student.fullName} (${student.className})`);
        continue;
      }

      let invoiceNo = `${prefix}${String(++sequence).padStart(4, "0")}`;
      // invoice_no is unique on the school's records, and a number already filed
      // for another family must never be reused for a second bill.
      while (usedNumbers.has(invoiceNo.toUpperCase())) {
        invoiceNo = `${prefix}${String(++sequence).padStart(4, "0")}`;
      }
      usedNumbers.add(invoiceNo.toUpperCase());

      newInvoices.push({
        id: `inv-${Date.now()}-${newInvoices.length}`,
        invoiceNo,
        admissionNo: student.admissionNo,
        studentName: student.fullName,
        className: student.className,
        amountBilled: total,
        // Always unpaid: a bill starts at zero received. What the family has
        // paid is entered as a payment against it, one at a time.
        amountPaid: 0,
        paymentStatus: "Unpaid",
        lastPaymentDate: "",
        session: scope.session,
        term: scope.term,
      });
      alreadyBilled.add(scopeKey({ ...student, session: scope.session, term: scope.term }));
    }

    if (newInvoices.length === 0) {
      setBusy(false);
      setNotice({
        tone: "warn",
        text:
          unpriced.length > 0
            ? `No invoice was raised. ${unpriced.length} pupil${unpriced.length === 1 ? "" : "s"} are in a class no fee item on the schedule applies to: ${unpriced
                .slice(0, 5)
                .join(", ")}${unpriced.length > 5 ? `, +${unpriced.length - 5} more` : ""}. Add an item for that class in Setup → Fee Structure.`
            : `Every enrolled pupil already has an invoice for ${scope.session}, ${scope.term}. Nothing was changed.`,
      });
      return;
    }

    const outcome = await addInvoices(newInvoices);
    setBusy(false);

    const pricedFor = `Priced from the school's schedule for ${scope.session}, ${scope.term}`;
    if (outcome.reason) {
      setNotice({
        tone: "warn",
        text: `${newInvoices.length} invoice${newInvoices.length === 1 ? " was" : "s were"} NOT filed on the school's records: ${outcome.reason}. ${pricedFor}.`,
      });
      return;
    }

    setNotice({
      tone: "ok",
      text:
        `${outcome.saved} invoice${outcome.saved === 1 ? "" : "s"} filed on the school's records for ${scope.session}, ${scope.term}. ` +
        `${pricedFor}; every one starts at ₦0 received. ${
          unpriced.length > 0
            ? `${unpriced.length} pupil${unpriced.length === 1 ? "" : "s"} in a class with no fee item were left out: ${unpriced.slice(0, 5).join(", ")}${unpriced.length > 5 ? `, +${unpriced.length - 5} more` : ""}.`
            : ""
        }`,
    });
  };

  // Totals are for the term the school is in. Adding every invoice ever raised
  // made the "this term" figures include last year's bills.
  const currentInvoices = invoices.filter(
    (inv) => (inv.session || scope.session) === scope.session && (inv.term || scope.term) === scope.term
  );

  const totalBilled = currentInvoices.reduce((s, i) => s + i.amountBilled, 0);
  const totalCollected = currentInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = totalBilled - totalCollected;
  const collectionRate = ((totalCollected / (totalBilled || 1)) * 100).toFixed(1);

  const listedInvoices = showAllTerms ? invoices : currentInvoices;

  const filtered = listedInvoices.filter((i) => {
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
              <Link href="/" className="flex min-h-6 items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Accounts</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Invoicing &amp; Billing</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                School Fees &amp; Billing Operations
              </h1>
              <span
                className={`border text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  feesSource === "server"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-300 text-amber-800"
                }`}
              >
                {feesSource === "server" ? "Filed Ledger" : "Schedule unread"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bills for {school?.school_name?.trim() || SCHOOL_INFO.name}, priced from the fee schedule on the
              school&apos;s records and reconciled payment by payment. Currently showing{" "}
              <strong className="text-slate-700">
                {scope.session}, {scope.term}
              </strong>
              .
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canBill && (
              <button
                onClick={() => void handleSyncInvoicesFromStudents()}
                disabled={busy}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {busy ? "Working…" : `Bill ${students.length} Enrolled Pupils (${scope.term})`}
              </button>
            )}
            {canBill ? (
              <Link
                href="/setup/fees"
                className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                Fee Structure
              </Link>
            ) : (
              <span className="px-3 py-2 text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-600 rounded-lg">
                Reading only. Take your payment evidence to the Bursary — a payment filed here is the only thing that
                clears a balance.
              </span>
            )}
          </div>
        </div>

        {/* What the last action actually did */}
        {notice && (
          <div
            className={`${noticeTone(notice.tone)} rounded-xl p-4 text-xs font-semibold flex items-start gap-2`}
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

        {/* Financial Metrics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-medium text-slate-500">Total Invoiced ({scope.term})</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">₦{totalBilled.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400">
              {currentInvoices.length} of {invoices.length} filed invoices are for {scope.session}, {scope.term}
            </span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <p className="text-xs font-medium text-slate-500">Total Fees Collected</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-1">₦{totalCollected.toLocaleString()}</p>
            <span className="text-[10px] text-emerald-600 font-medium">
              Only payments entered on this screen are counted
            </span>
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
              {currentInvoices.filter((i) => i.paymentStatus === "Paid").length} families fully cleared this term
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setShowAllTerms((current) => !current)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                showAllTerms
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
              title="By default this list and its totals cover the session and term the school is in"
            >
              {showAllTerms ? "Every session and term" : `Only ${scope.session} · ${scope.term}`}
            </button>
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
              <div className="text-sm font-semibold text-slate-600">Nothing on this list</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {invoices.length === 0
                  ? `No invoice has been filed for ${scope.session}, ${scope.term} yet. Set the fee schedule, then use “Bill ${students.length} Enrolled Pupils” above.`
                  : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} are filed, but none of them match this filter or ${
                      showAllTerms ? "the search" : `${scope.session}, ${scope.term}`
                    }. Use “${showAllTerms ? "Only" : "Every"} session and term” to widen the list.`}
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
                    <th className="py-3 px-3">Billed for</th>
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
                        <td className="py-3 px-3 text-[10px] text-slate-500">
                          {inv.session || scope.session}
                          <br />
                          {inv.term || scope.term}
                        </td>
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
                            {canBill && balance > 0 && (
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-xs cursor-pointer"
                              >
                                Record Payment
                              </button>
                            )}
                            {inv.amountPaid > 0 ? (
                              <button
                                onClick={() => void handleShowReceipts(inv)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                Receipts
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">No payment filed yet</span>
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
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
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
                    min="1"
                    max={selectedInvoice.amountBilled - selectedInvoice.amountPaid}
                    placeholder="Enter the amount actually handed over"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    The server checks this against the balance it holds and refuses more than is owed.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    {PAYMENT_CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Reference / Teller No</label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="e.g. GTB/TRF/98234710"
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Written on the receipt and on the school&apos;s records, so the money can be matched to a teller slip
                    later. Leave it empty for cash — the printed slip then says &quot;Not noted&quot;.
                  </p>
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
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {busy ? "Filing…" : "Confirm & File Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* The slip handed to the family — printed from the school's own receipt number */}
        {slip && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl p-5 space-y-4 my-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Receipt to give the family
                </h3>
                <button
                  onClick={() => setSlip(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <PaymentReceipt
                schoolName={school?.school_name?.trim() || SCHOOL_INFO.name}
                invoice={slip.invoice}
                receipt={slip.receipt}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSlip(null)}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer text-xs"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print This Receipt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Every receipt the school filed for this pupil, when this one has none */}
        {receiptsFor && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full border shadow-xl max-h-[90vh] overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">
                  Receipts filed for {receiptsFor.invoice.studentName}
                </h3>
                <button
                  onClick={() => setReceiptsFor(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {receiptsFor.reason ? (
                <p className="text-xs bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3">
                  The school&apos;s receipt file could not be read: {receiptsFor.reason}. Nothing is printed from a list
                  that could not be checked.
                </p>
              ) : receiptsFor.receipts.length === 0 ? (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  No payment has been filed for this pupil at all, so there is no receipt to reprint.
                </p>
              ) : (
                <ul className="text-xs space-y-2">
                  {receiptsFor.receipts.map((row) => {
                    // The slip prints the billed/paid figures of the invoice the
                    // receipt belongs to, not whichever row was clicked open.
                    const billed =
                      invoices.find((inv) => inv.invoiceNo.trim().toUpperCase() === row.invoiceNo.trim().toUpperCase()) ??
                      (row.invoiceNo.trim().toUpperCase() === receiptsFor.invoice.invoiceNo.trim().toUpperCase()
                        ? receiptsFor.invoice
                        : null);
                    return (
                      <li key={row.receipt.ref} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <p className="font-mono font-bold text-slate-900">{row.receipt.ref}</p>
                        <p className="text-slate-600">
                          ₦{row.receipt.amount.toLocaleString()} · {row.receipt.channel} · {row.invoiceNo || "no invoice number"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(row.receipt.issuedAt).toLocaleString()} · received by{" "}
                          {row.receipt.receivedBy || "not recorded"} · {row.feeType}
                        </p>
                        {billed ? (
                          <button
                            onClick={() => {
                              setReceiptsFor(null);
                              setSlip({ invoice: billed, receipt: row.receipt });
                            }}
                            className="mt-2 px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 font-semibold text-[11px] cursor-pointer hover:bg-slate-100"
                          >
                            Show / print
                          </button>
                        ) : (
                          <p className="mt-1 text-[10px] text-slate-500">
                            This receipt is against {row.invoiceNo}, which is not on the list above, so its balance
                            cannot be shown. Check it on the invoices file before reprinting.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="text-[10px] text-slate-500">
                {receiptsFor.invoice.invoiceNo} is billed at ₦
                {receiptsFor.invoice.amountBilled.toLocaleString()} with ₦
                {receiptsFor.invoice.amountPaid.toLocaleString()} received on the school&apos;s records. The receipt
                numbers above are the ones the bursary issued.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
