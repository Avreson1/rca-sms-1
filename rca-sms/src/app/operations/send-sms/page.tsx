"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  CheckCircle2,
  Phone,
  Sparkles,
} from "lucide-react";

export default function SendSMSBroadcastPage() {
  const [recipientGroup, setRecipientGroup] = useState("all-parents");
  const [smsText, setSmsText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const charCount = smsText.length;
  const pageCount = Math.ceil(charCount / 160) || 1;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSuccessToast(true);
      setSmsText("");
      setTimeout(() => setSuccessToast(false), 4000);
    }, 1500);
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
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Parent & Staff SMS Gateway
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Send emergency alerts, fee reminders, and attendance notifications powered by **Twilio**.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            SMS batch delivered to 310 phone numbers!
          </div>
        )}

        {/* SMS Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-2xl space-y-4">
          <form onSubmit={handleSend} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Phone Audience</label>
              <select
                value={recipientGroup}
                onChange={(e) => setRecipientGroup(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="all-parents">All Registered Parent Phone Numbers (310 Contacts)</option>
                <option value="ss2-parents">SS 2A & 2B Parents Only (62 Contacts)</option>
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

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Sender ID: ROYACROWN</span>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? "Dispatching SMS..." : "Broadcast SMS"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </DashboardShell>
  );
}
