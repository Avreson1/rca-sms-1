"use client";

import type { InvoiceRecord } from "@/lib/realtime-store";
import type { ReceiptDetails } from "@/lib/supabase/db";

export type { ReceiptDetails };

/**
 * The bursary receipt a family is given.
 *
 * Both payment screens used to print nothing: one alerted "Printing official
 * payment receipt...", the other alerted "Receipt printed for …". The numbers
 * below are the ones the school's records hold after the payment was filed, and
 * the receipt number is the one issued by the server — what comes out of the
 * printer is therefore the same figure the ledger shows.
 */
export function PaymentReceipt({
  schoolName,
  invoice,
  receipt,
}: {
  schoolName: string;
  invoice: InvoiceRecord;
  receipt: ReceiptDetails;
}) {
  const balance = Math.max(0, invoice.amountBilled - invoice.amountPaid);
  const issuedOn = new Date(receipt.issuedAt);
  const issuedLabel = Number.isNaN(issuedOn.getTime()) ? receipt.issuedAt : issuedOn.toLocaleString();

  return (
    <div className="printable-region bg-white border border-slate-300 rounded-2xl p-6 text-xs space-y-3">
      <div className="border-b-2 border-slate-800 pb-3 text-center">
        <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">{schoolName}</h4>
        <p className="text-[10px] font-bold text-slate-600">Official Bursary Receipt — School Fees</p>
      </div>

      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-bold">Receipt No</p>
          <p className="font-mono font-black text-slate-900">{receipt.ref || "No receipt number issued"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Received</p>
          <p className="font-semibold text-slate-900">{issuedLabel}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono">
        <dt className="text-slate-500">Pupil</dt>
        <dd className="text-right font-bold text-slate-900">{invoice.studentName}</dd>

        <dt className="text-slate-500">Admission No</dt>
        <dd className="text-right font-bold text-slate-900">{invoice.admissionNo}</dd>

        <dt className="text-slate-500">Class</dt>
        <dd className="text-right font-bold text-slate-900">{invoice.className}</dd>

        <dt className="text-slate-500">Invoice</dt>
        <dd className="text-right font-bold text-slate-900">{invoice.invoiceNo}</dd>

        <dt className="text-slate-500">Billed for</dt>
        <dd className="text-right font-bold text-slate-900">
          {invoice.session || ""} {invoice.term || ""}
        </dd>

        <dt className="text-slate-500">Method</dt>
        <dd className="text-right font-bold text-slate-900">{receipt.channel}</dd>

        <dt className="text-slate-500">Bank ref / teller</dt>
        <dd className="text-right font-bold text-slate-900">{receipt.bankReference || "Not noted"}</dd>

        <dt className="text-slate-500">Received by</dt>
        <dd className="text-right font-bold text-slate-900">{receipt.receivedBy || "Not recorded"}</dd>
      </dl>

      <div className="border-t border-slate-200 pt-2 space-y-1 font-mono">
        <div className="flex justify-between">
          <span className="text-slate-500">Total billed</span>
          <span className="font-bold text-slate-900">₦{invoice.amountBilled.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-700 font-bold">This payment</span>
          <span className="font-extrabold text-emerald-700">₦{receipt.amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Paid to date</span>
          <span className="font-bold text-emerald-700">₦{invoice.amountPaid.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-200 pt-1">
          <span className="font-bold text-slate-900">Balance outstanding</span>
          <span className="font-extrabold text-red-600">₦{balance.toLocaleString()}</span>
        </div>
      </div>

      <p className="text-[9px] text-slate-500 border-t border-slate-200 pt-2">
        Retain this receipt. It records a payment filed on the school&apos;s own fee ledger, not a promise to pay, and
        the balance above is the amount still expected before the end of {invoice.term || "the term"}.
      </p>
    </div>
  );
}
