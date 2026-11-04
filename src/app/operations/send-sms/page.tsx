"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Copy,
  Phone,
  Sparkles,
} from "lucide-react";

export default function SendSMSBroadcastPage() {
  const [recipientGroup, setRecipientGroup] = useState("all-parents");
  const [smsText, setSmsText] = useState("");
  const [copied, setCopied] = useState(false);

  const charCount = smsText.length;
  const pageCount = Math.ceil(charCount / 160) || 1;

  const handleCopy = async () => {
    if (!smsText.trim()) return;
    try {
      await navigator.clipboard.writeText(smsText);
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
              <span className="text-slate-800 font-semibold">SMS Dispatch</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Parent & Staff SMS Gateway
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft emergency alerts, fee reminders, and attendance notifications for parents and staff.
            </p>
          </div>
        </div>

        {/* No SMS provider is wired up, so a dispatch would silently go nowhere. */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[11px] text-amber-900 max-w-2xl">
          No SMS provider is connected to this portal yet, so nothing can be sent from it. A message drafted here is
          not stored anywhere either; use <strong>Copy message</strong> and send it from the school&apos;s own SMS
          account.
        </div>

        {/* SMS Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-2xl space-y-4">
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Phone Audience</label>
              <select
                value={recipientGroup}
                onChange={(e) => setRecipientGroup(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="all-parents">All Registered Parent Phone Numbers</option>
                <option value="ss2-parents">SS 2A &amp; 2B Parents Only</option>
                <option value="debtors">Parents with Overdue Fee Balance Only</option>
                <option value="staff">Teaching Staff Direct Contacts</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">SMS Text Body</label>
                <span className="text-[11px] font-mono text-slate-500">
                  {charCount} chars • {pageCount} SMS Page(s)
                </span>
              </div>
              <textarea
                rows={5}
                required
                maxLength={480}
                placeholder="RCA ALERT: Dear Parent, please be reminded that 1st Term CBT Examinations start on Monday, 24th Nov. Ensure your ward's fees are cleared."
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-sans"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] text-slate-400">Sender ID: ROYACROWN (no SMS account is configured)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!smsText.trim()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Copied to clipboard" : "Copy message"}
                </button>
                <button
                  type="button"
                  disabled
                  title="No SMS provider is connected to this portal"
                  className="px-5 py-2.5 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  Broadcast SMS
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
