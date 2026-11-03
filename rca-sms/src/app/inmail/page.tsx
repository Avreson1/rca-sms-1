"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeInmail, InmailMessage } from "@/lib/realtime-store";
import {
  Mail,
  Send,
  Inbox,
  Star,
  Trash2,
  ArrowLeft,
  Search,
  CheckCircle2,
  Plus,
  Paperclip,
} from "lucide-react";

export default function InmailPage() {
  const { messages, sendMessage } = useRealtimeInmail();
  const [selectedMessage, setSelectedMessage] = useState<InmailMessage | null>(messages[0] || null);
  const [search, setSearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("all-staff");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sentToast, setSentToast] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeSubject.trim() || !composeBody.trim()) return;

    sendMessage({
      recipient: composeTo,
      subject: composeSubject,
      body: composeBody,
    });

    setSentToast(true);
    setIsComposing(false);
    setComposeSubject("");
    setComposeBody("");
    setTimeout(() => setSentToast(false), 4000);
  };

  const filtered = messages.filter(
    (m) =>
      m.sender.toLowerCase().includes(search.toLowerCase()) ||
      m.subject.toLowerCase().includes(search.toLowerCase())
  );

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
              <span>Communication</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Inmail Messages</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Inmail Internal Messaging
              </h1>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                Encrypted Realtime Feed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure messaging network for Royal Crown Academy teachers, management, and departments.
            </p>
          </div>

          <button
            onClick={() => setIsComposing(true)}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Compose Inmail
          </button>
        </div>

        {/* Sent Confirmation Toast */}
        {sentToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Message broadcasted successfully in real-time across institutional portal nodes.
          </div>
        )}

        {/* Compose Modal */}
        {isComposing && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  New Internal Message
                </h3>
                <button
                  onClick={() => setIsComposing(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSend} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient</label>
                  <select
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    <option value="all-staff">All Staff Members (Royal Crown Academy)</option>
                    <option value="principal">Office of the Principal</option>
                    <option value="bursar">Accounts & Bursary Department</option>
                    <option value="exam-officer">Exam Officer (Emmanuel Pam)</option>
                    <option value="sarah-k">Sarah K. Danjuma (JSS 1 Maths)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter subject header..."
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Write your memo or message here..."
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    Encrypted internal transmission
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsComposing(false)}
                      className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Inmail
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Messaging Layout (Split View) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden min-h-[500px]">
          
          {/* Left Column: Inbox List (5 cols) */}
          <div className="md:col-span-5 border-r border-slate-200 flex flex-col">
            {/* Search Box */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Message List */}
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filtered.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left p-4 transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? "bg-blue-50/60 border-l-4 border-l-blue-600"
                        : msg.unread
                        ? "bg-white font-semibold"
                        : "bg-slate-50/30 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                        {msg.sender}
                      </span>
                      <span className="text-[10px] text-slate-400">{msg.date}</span>
                    </div>

                    <p className={`text-xs truncate ${isSelected ? "text-blue-800" : "text-slate-800"}`}>
                      {msg.subject}
                    </p>

                    <p className="text-[11px] text-slate-400 truncate">{msg.snippet}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Message Reader (7 cols) */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between">
            {selectedMessage ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-900">
                      {selectedMessage.subject}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="font-semibold text-slate-800">{selectedMessage.sender}</span>
                      <span>({selectedMessage.senderRole})</span>
                      <span>•</span>
                      <span>{selectedMessage.date}</span>
                    </div>
                  </div>

                  <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
                    To: {selectedMessage.recipient}
                  </span>
                </div>

                <div className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/40 p-5 rounded-xl border border-slate-100">
                  {selectedMessage.body}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
                <Mail className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs">Select a message from the left to read.</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>{SCHOOL_INFO.name} VCS Internal Network</span>
              <button
                onClick={() => setIsComposing(true)}
                className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Quick Reply →
              </button>
            </div>
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}
