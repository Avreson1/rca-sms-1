"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeNewsletter, NewsletterRecord } from "@/lib/realtime-store";
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  Printer,
  Sparkles,
  Palette,
  Mail,
  Calendar,
  CreditCard,
  Save,
  RotateCcw,
} from "lucide-react";

export const COLOR_SCHEMES = [
  {
    id: "royal" as const,
    name: "Scheme 1: Vibrant Royal & Academic Contrast",
    badgeClass: "bg-[#0000FF] text-white border border-cyan-400/40",
    borderClass: "border-[#0000FF]",
    previewBg: "from-[#0000FF] via-blue-800 to-[#0a1128]",
    accent: "text-cyan-400",
    desc: "Primary flagship theme: Royal Blue (#0000FF 60%), Cyan (#00FFFF 25%), Vivid Red (#FF0000 10%), White (#FFFFFF 5%).",
  },
  {
    id: "scheme2" as const,
    name: "Scheme 2: Deep Navy & Bright Magenta",
    badgeClass: "bg-[#0B2F9E] text-white border border-pink-400/40",
    borderClass: "border-[#0B2F9E]",
    previewBg: "from-[#0B2F9E] via-purple-900 to-[#0d1838]",
    accent: "text-pink-400",
    desc: "Alternate academic contrast: Deep Navy (#0B2F9E), Bright Magenta (#FF00FF), Crimson Red (#D90429), Off-White (#F8F9FA).",
  },
  {
    id: "emerald" as const,
    name: "Emerald Green & Slate",
    badgeClass: "bg-emerald-800 text-white",
    borderClass: "border-emerald-800",
    previewBg: "from-emerald-800 to-teal-950",
    accent: "text-emerald-800",
    desc: "Academic distinction emerald with forest slate borders. Clean & prestigious.",
  },
  {
    id: "burgundy" as const,
    name: "Burgundy Wine & Gold",
    badgeClass: "bg-rose-950 text-white",
    borderClass: "border-rose-950",
    previewBg: "from-rose-950 to-pink-950",
    accent: "text-rose-950",
    desc: "Traditional collegiate burgundy wine. Elegant and formal executive tone.",
  },
  {
    id: "gold" as const,
    name: "Classic Gold & Royal Navy",
    badgeClass: "bg-amber-900 text-white",
    borderClass: "border-amber-900",
    previewBg: "from-amber-900 to-yellow-950",
    accent: "text-amber-800",
    desc: "Classic academic prestige gold with rich navy contrast.",
  },
  {
    id: "slate" as const,
    name: "Executive Slate & Charcoal",
    badgeClass: "bg-slate-900 text-white",
    borderClass: "border-slate-900",
    previewBg: "from-slate-900 to-gray-950",
    accent: "text-slate-900",
    desc: "Modern minimalist charcoal and titanium slate. Clean corporate clarity.",
  },
];

export default function SetupReportTemplatesPage() {
  const { newsletter, updateNewsletter, resetNewsletter } = useRealtimeNewsletter();

  const [themeColor, setThemeColor] = useState<NewsletterRecord["themeColor"]>(newsletter.themeColor || "royal");
  const [principalName, setPrincipalName] = useState(newsletter.principalName);
  const [principalMessage, setPrincipalMessage] = useState(newsletter.principalMessage);
  const [nextTermResumption, setNextTermResumption] = useState(newsletter.nextTermResumption);
  const [feePolicy, setFeePolicy] = useState(newsletter.feePolicyAndDeadlines);
  const [bankName, setBankName] = useState(newsletter.bankAccountDetails.bankName);
  const [accountName, setAccountName] = useState(newsletter.bankAccountDetails.accountName);
  const [accountNumber, setAccountNumber] = useState(newsletter.bankAccountDetails.accountNumber);
  const [eventsText, setEventsText] = useState(newsletter.eventsAndHighlights.join("\n"));
  const [customNotes, setCustomNotes] = useState(newsletter.customNotes || "");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedEvents = eventsText
      .split("\n")
      .map((e) => e.trim())
      .filter(Boolean);

    updateNewsletter({
      themeColor,
      principalName,
      principalMessage,
      nextTermResumption,
      feePolicyAndDeadlines: feePolicy,
      bankAccountDetails: {
        bankName,
        accountName,
        accountNumber,
      },
      eventsAndHighlights: parsedEvents,
      customNotes,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetToDefault = () => {
    if (confirm("Reset newsletter & report template settings to institutional default?")) {
      resetNewsletter();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
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
              <span>Setup</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Report &amp; Newsletter Templates</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Report Card Theme &amp; End-of-Term Newsletter
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Select standardized color schemes for report cards and configure the official printable terminal newsletter for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResetToDefault}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Default
            </button>
            <Link
              href="/operations/score-card"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto"
            >
              <Printer className="w-4 h-4" />
              Preview Scorecard &amp; Newsletter
            </Link>
          </div>
        </div>

        {/* Success Alert */}
        {isSaved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Report card color scheme and terminal newsletter template successfully saved and synchronized!
          </div>
        )}

        {/* Section 1: Color Scheme Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              Report Card Color Scheme Palette
            </h3>
            <span className="text-xs text-slate-500">Applies uniformly across all school tiers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {COLOR_SCHEMES.map((scheme) => (
              <div
                key={scheme.id}
                onClick={() => setThemeColor(scheme.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                  themeColor === scheme.id
                    ? `${scheme.borderClass} ring-2 ring-blue-500/20 shadow-sm bg-slate-50/70`
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="space-y-2">
                  <div className={`h-8 rounded-lg bg-gradient-to-r ${scheme.previewBg} shadow-xs flex items-center justify-end px-2`}>
                    {themeColor === scheme.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{scheme.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{scheme.desc}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded text-center block ${
                    themeColor === scheme.id ? scheme.badgeClass : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {themeColor === scheme.id ? "Active Scheme" : "Select Scheme"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: End-of-Term Newsletter Editor */}
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                End-of-Term Official Terminal Newsletter &amp; Notice
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This editable bulletin will automatically print on the reverse side or accompanying page of all student report cards.
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Newsletter
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Director / Principal Sign-off Name</label>
              <input
                type="text"
                required
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Next Term Resumption Date</label>
              <input
                type="text"
                required
                placeholder="e.g. Monday, January 12, 2026"
                value={nextTermResumption}
                onChange={(e) => setNextTermResumption(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Principal&apos;s End-of-Term Executive Address</label>
            <textarea
              rows={3}
              required
              value={principalMessage}
              onChange={(e) => setPrincipalMessage(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-normal"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">
              Upcoming Term Key Events &amp; Milestones (One per line)
            </label>
            <textarea
              rows={4}
              required
              value={eventsText}
              onChange={(e) => setEventsText(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-mono"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Tuition Fee Policy &amp; Clearance Deadlines</label>
            <textarea
              rows={2}
              required
              value={feePolicy}
              onChange={(e) => setFeePolicy(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed"
            />
          </div>

          {/* Bank Account Details */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              School Official Bank Payment Account (Displayed on Newsletter)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold tracking-wider"
                />
              </div>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Special Advisories &amp; General Notes</label>
            <input
              type="text"
              placeholder="e.g. Please ensure students return with complete uniforms, textbooks, and sports wear."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-normal"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save Report Theme &amp; Newsletter
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
