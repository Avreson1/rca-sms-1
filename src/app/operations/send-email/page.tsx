"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  ArrowLeft,
  Send,
  Copy,
} from "lucide-react";

export default function SendEmailBroadcastPage() {
  const [recipientGroup, setRecipientGroup] = useState("all-parents");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [copied, setCopied] = useState(false);

  const composedMessage = subject.trim() ? `Subject: ${subject}\n\n${messageBody}` : messageBody;

  const handleCopy = async () => {
    if (!composedMessage.trim()) return;
    try {
      await navigator.clipboard.writeText(composedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard is unavailable without a secure context; the draft stays on screen
    }
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
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Bulk Email</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Institutional Email Broadcast
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft notifications, term newsletters, and academic circulars for parents and staff.
            </p>
          </div>
        </div>

        {/* No mail provider is wired up, so a dispatch would silently go nowhere. */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[11px] text-amber-900 max-w-3xl">
          No email provider is connected to this portal yet, so nothing can be sent from it. A message drafted here is
          not stored anywhere either; use <strong>Copy message</strong> and send it from the school&apos;s own mailbox.
        </div>

        {/* Email Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-3xl space-y-4">
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient Group</label>
              <select
                value={recipientGroup}
                onChange={(e) => setRecipientGroup(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="all-parents">All Parents &amp; Guardians</option>
                <option value="ss2-parents">SS 2A &amp; 2B Parents Only</option>
                <option value="all-staff">All Academic &amp; Administrative Staff</option>
                <option value="debtors">Parents with Outstanding Fee Invoices Only</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Subject Line</label>
              <input
                type="text"
                required
                placeholder="e.g. Royal Crown Academy: Notice of First Term CBT Examinations & Vacation"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Message Content (HTML Supported)</label>
              <textarea
                rows={7}
                required
                placeholder="Dear Parents and Guardians,&#10;&#10;We write to inform you that First Term Computer-Based Examinations will commence on Monday..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-sans"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-all text-[11px] text-slate-400">
                Sender: portal@royalcrownacademy.edu.ng (no sending account is configured)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!composedMessage.trim()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Copied to clipboard" : "Copy message"}
                </button>
                <button
                  type="button"
                  disabled
                  title="No email provider is connected to this portal"
                  className="px-5 py-2.5 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Email Broadcast
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
