"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeInmail,
  useRealtimeAuth,
  useRealtimeStaff,
  type InmailMessage,
} from "@/lib/realtime-store";
import { useSchoolConfig } from "@/lib/school-config";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import { Mail, ArrowLeft, Search, Plus, Trash2, Copy, TriangleAlert } from "lucide-react";

const ROLE_WORDS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrator",
  EXAM_OFFICER: "Exam Officer",
  TEACHER: "Teacher",
  ACCOUNTANT: "Accounts",
  STUDENT_PARENT: "Parent / Student",
  TESTERS: "Tester",
};

const OFFICES = [
  "All staff",
  "Office of the Principal",
  "Accounts & Bursary",
  "Exam Officer",
];

function savedWhen(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InmailPage() {
  const { messages, saveDraft, deleteDraft } = useRealtimeInmail();
  const { currentUser } = useRealtimeAuth();
  const { staff } = useRealtimeStaff();
  const { config: school } = useSchoolConfig();
  const schoolName = school?.school_name?.trim() || SCHOOL_INFO.name;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState(OFFICES[0]);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const authorName = currentUser?.fullName?.trim() ?? "";
  const authorRole = currentUser ? ROLE_WORDS[currentUser.role] ?? currentUser.role : "";
  const selected = messages.find((msg) => msg.id === selectedId) ?? null;

  const namedStaff = staff.filter((member) => member.fullName?.trim());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setRefusal(null);
    const outcome = saveDraft({
      recipient: composeTo,
      subject: composeSubject,
      body: composeBody,
      sender: authorName,
      senderRole: authorRole,
    });
    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the draft was not saved");
      return;
    }
    setIsComposing(false);
    setComposeSubject("");
    setComposeBody("");
    setNotice("Draft saved on this machine only. Nobody has received it and no other machine will see it.");
    setTimeout(() => setNotice(null), 6000);
  };

  const handleDelete = (draft: InmailMessage) => {
    if (
      !confirm(
        `Delete the draft "${draft.subject}" from this machine? It was never sent anywhere, and once deleted it cannot be brought back.`
      )
    ) {
      return;
    }
    deleteDraft(draft.id);
    if (selectedId === draft.id) setSelectedId(null);
    setNotice("Draft deleted from this machine.");
    setTimeout(() => setNotice(null), 4000);
  };

  const handleCopy = async (draft: InmailMessage) => {
    const text = `To: ${draft.recipient}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Memo copied to this machine's clipboard. Nothing was sent — paste it into the school's email or print it.");
    } catch {
      setRefusal("this browser would not let the memo be copied, so select the text and copy it by hand");
    }
    setTimeout(() => setNotice(null), 6000);
  };

  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? messages.filter(
        (msg) =>
          msg.sender.toLowerCase().includes(needle) ||
          msg.subject.toLowerCase().includes(needle) ||
          msg.recipient.toLowerCase().includes(needle)
      )
    : messages;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 flex-wrap">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Communication</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Memo drafts</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Inmail — memo drafts
              </h1>
              <span className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full">
                Not a mailbox
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              A writing pad for {schoolName} memos. There is no delivery here: what you save stays on this machine,
              nobody is notified, and the person named in &ldquo;Addressed to&rdquo; has not received anything. Copy the
              memo out and send it by the school&apos;s email, a letter or a phone call.
            </p>
          </div>

          <button
            onClick={() => {
              setRefusal(null);
              setIsComposing(true);
            }}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Write a memo
          </button>
        </div>

        <DeviceOnlyNotice what="This memo draft pad" />

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-snug">
          {authorName ? (
            <>
              Drafts are signed <strong className="text-slate-800">{authorName}</strong> ({authorRole}) — the login on
              this machine, not a name typed into the form.
            </>
          ) : (
            <>This browser has not read who is signed in, so a draft cannot be saved until it has.</>
          )}
        </div>

        {notice && (
          <div className="bg-slate-100 border border-slate-300 text-slate-800 rounded-xl p-3.5 text-xs font-semibold shadow-xs">
            {notice}
          </div>
        )}

        {refusal && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3.5 text-xs font-semibold flex items-start gap-2 shadow-xs">
            <TriangleAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>Nothing was saved: {refusal}.</span>
          </div>
        )}

        {isComposing && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  New memo draft
                </h3>
                <button
                  onClick={() => setIsComposing(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Addressed to (a note, not a delivery)</label>
                  <select
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    {OFFICES.map((office) => (
                      <option key={office} value={office}>
                        {office}
                      </option>
                    ))}
                    {namedStaff.map((member) => (
                      <option key={member.id} value={member.fullName}>
                        {member.fullName}
                        {member.designation?.trim()
                          ? ` — ${member.designation.trim()}`
                          : member.assignedClass?.trim()
                          ? ` — ${member.assignedClass.trim()}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {namedStaff.length > 0
                      ? `${namedStaff.length} member(s) of staff are on the list this screen can read. Naming one does not send them anything.`
                      : "Nobody is on the staff list this screen can read, so only the offices above can be named."}
                  </p>
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
                  <label className="block font-semibold text-slate-700 mb-1">Memo body</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Write the memo here..."
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 gap-3">
                  <span className="text-[11px] text-slate-500">Saved on this machine. Nothing is sent.</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsComposing(false)}
                      className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                    >
                      Save draft
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden min-h-[500px]">
          <div className="md:col-span-5 border-r border-slate-200 flex flex-col">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search drafts on this machine..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {messages.length} draft(s) on this machine
                {filtered.length !== messages.length ? `, ${filtered.length} matching` : ""}
              </p>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <p className="p-4 text-xs text-slate-500 leading-snug">
                  {messages.length === 0
                    ? "No drafts on this machine. Nothing has ever been sent from this screen."
                    : "No draft on this machine matches that search."}
                </p>
              ) : (
                filtered.map((msg) => {
                  const isSelected = selected?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedId(msg.id)}
                      className={`w-full text-left p-4 transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected ? "bg-blue-50/60 border-l-4 border-l-blue-600" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`font-bold truncate ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                          {msg.sender || "No author recorded"}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">{savedWhen(msg.date)}</span>
                      </div>
                      <p className={`text-xs truncate ${isSelected ? "text-blue-800" : "text-slate-800"}`}>
                        {msg.subject}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">Addressed to {msg.recipient} — not delivered</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="md:col-span-7 p-6 flex flex-col justify-between">
            {selected ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-bold text-slate-900 break-words">{selected.subject}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="font-semibold text-slate-800">
                        {selected.sender || "No author recorded on this draft"}
                      </span>
                      {selected.senderRole && <span>({selected.senderRole})</span>}
                      <span>•</span>
                      <span>Saved {savedWhen(selected.date)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-900 font-semibold px-2 py-0.5 rounded shrink-0">
                    Draft, not sent
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Addressed to <strong className="text-slate-800">{selected.recipient}</strong>. That is a note about
                  who the memo is for; this screen has no way to reach them.
                </p>

                <div className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/40 p-5 rounded-xl border border-slate-100 break-words">
                  {selected.body}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleCopy(selected)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy memo text
                  </button>
                  <button
                    onClick={() => handleDelete(selected)}
                    className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete this draft
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
                <Mail className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs">Select a draft from the left to read it.</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>Memo drafts • this machine only • nothing delivered</span>
              <button
                onClick={() => {
                  setRefusal(null);
                  setIsComposing(true);
                }}
                className="font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Write another →
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}