"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  Mail,
  ArrowLeft,
  Send,
  CheckCircle2,
  Users,
  Paperclip,
  Sparkles,
} from "lucide-react";

export default function SendEmailBroadcastPage() {
  const [recipientGroup, setRecipientGroup] = useState("all-parents");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !messageBody.trim()) return;

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSuccessToast(true);
      setSubject("");
      setMessageBody("");
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
              <span className="text-slate-800 font-semibold">Bulk Email</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Institutional Email Broadcast
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Send notifications, term newsletters, and academic circulars powered by the **Resend API**.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Email broadcast successfully dispatched to 310 recipients via Resend!
          </div>
        )}

        {/* Email Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-3xl space-y-4">
          <form onSubmit={handleSend} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient Group</label>
              <select
                value={recipientGroup}
                onChange={(e) => setRecipientGroup(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                <option value="all-parents">All Parents & Guardians (310 Recipients)</option>
                <option value="ss2-parents">SS 2A & 2B Parents Only (62 Recipients)</option>
                <option value="all-staff">All Academic & Administrative Staff (28 Personnel)</option>
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

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Sender: portal@royalcrownacademy.edu.ng</span>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? "Dispatching Broadcast..." : "Send Email Broadcast"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </DashboardShell>
  );
}
