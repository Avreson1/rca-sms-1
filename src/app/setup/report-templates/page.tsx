"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeAuth,
  useRealtimeNewsletter,
  useRealtimeReportTheme,
  type NewsletterRecord,
  type ReportTheme,
} from "@/lib/realtime-store";
import {
  effectiveScope,
  REPORT_TERMS,
  sessionOptions,
  useSchoolConfig,
  type ReportTerm,
} from "@/lib/school-config";
import {
  ArrowLeft,
  CheckCircle2,
  Printer,
  Palette,
  Mail,
  CreditCard,
  Save,
  Info,
  TriangleAlert,
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

/** The ten boxes the circular is made of, as one editable draft. */
interface BulletinDraft {
  title: string;
  principalName: string;
  principalMessage: string;
  nextTermResumption: string;
  eventsText: string;
  feePolicy: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  customNotes: string;
}

function draftFrom(bulletin: NewsletterRecord | null): BulletinDraft {
  return {
    title: bulletin?.title ?? "",
    principalName: bulletin?.principalName ?? "",
    principalMessage: bulletin?.principalMessage ?? "",
    nextTermResumption: bulletin?.nextTermResumption ?? "",
    eventsText: (bulletin?.eventsAndHighlights ?? []).join("\n"),
    feePolicy: bulletin?.feePolicyAndDeadlines ?? "",
    bankName: bulletin?.bankAccountDetails.bankName ?? "",
    accountName: bulletin?.bankAccountDetails.accountName ?? "",
    accountNumber: bulletin?.bankAccountDetails.accountNumber ?? "",
    customNotes: bulletin?.customNotes ?? "",
  };
}

export default function SetupReportTemplatesPage() {
  const { bulletins, bulletinsSource, newsletterFor, saveBulletin, reloadBulletins } = useRealtimeNewsletter();
  const { theme, themeSource, themeUpdatedBy, themeUpdatedAt, fileTheme, reloadTheme } = useRealtimeReportTheme();
  const { currentUser } = useRealtimeAuth();

  const { config: school } = useSchoolConfig();
  const scope = effectiveScope(school, { session: SCHOOL_INFO.currentSession, term: "First Term" });
  const sessionList = sessionOptions(scope.session);
  const termInScope: ReportTerm = REPORT_TERMS.includes(scope.term as ReportTerm)
    ? (scope.term as ReportTerm)
    : "First Term";

  const [period, setPeriod] = useState<{ session: string; term: ReportTerm }>({
    session: scope.session,
    term: termInScope,
  });
  const [draft, setDraft] = useState<BulletinDraft | null>(null);
  const [themeDraft, setThemeDraft] = useState<ReportTheme | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFiling, setIsFiling] = useState(false);

  // A draft belongs to the term it was started under. Changing the term — or the
  // school's answer arriving a moment after the page — drops it, so words written
  // for First Term can never be filed onto Third Term by a stale form.
  const filedBulletin = newsletterFor(period.session, period.term);
  useEffect(() => {
    setDraft(null);
  }, [period.session, period.term, bulletinsSource, filedBulletin?.updatedAt]);

  const current = draft ?? draftFrom(filedBulletin);
  const isBulletinDraft = draft !== null;
  const shownTheme = themeDraft ?? theme;
  const isThemeDraft = themeDraft !== null && themeDraft !== theme;
  const canEdit = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "EXAM_OFFICER";

  const setField = (field: keyof BulletinDraft) => (value: string) =>
    setDraft({ ...current, [field]: value });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 6000);
  };

  const handleFileBulletin = async (event: React.FormEvent) => {
    event.preventDefault();
    setRefusal(null);
    setIsFiling(true);

    const outcome = await saveBulletin({
      session: period.session,
      term: period.term,
      title: current.title.trim(),
      principalName: current.principalName.trim(),
      principalMessage: current.principalMessage.trim(),
      nextTermResumption: current.nextTermResumption.trim(),
      eventsAndHighlights: current.eventsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      feePolicyAndDeadlines: current.feePolicy.trim(),
      bankAccountDetails: {
        bankName: current.bankName.trim(),
        accountName: current.accountName.trim(),
        accountNumber: current.accountNumber.trim(),
      },
      customNotes: current.customNotes.trim(),
    });
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the portal server refused the write");
      return;
    }

    setDraft(null);
    showToast(`The ${period.term} circular for ${period.session} is on the school's records.`);
  };

  const handleFileTheme = async () => {
    setRefusal(null);
    setIsFiling(true);
    const outcome = await fileTheme(shownTheme);
    setIsFiling(false);

    if (!outcome.ok) {
      setRefusal(outcome.reason ?? "the portal server refused the write");
      return;
    }

    setThemeDraft(null);
    showToast(`${COLOR_SCHEMES.find((scheme) => scheme.id === shownTheme)?.name ?? "The scheme"} is the school's card theme on the records.`);
  };

  const bulletinsFiledForOtherPeriods = bulletins.filter(
    (bulletin) => bulletin.session !== period.session || bulletin.term !== period.term
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        {toastMessage && (
          <div className="fixed top-20 right-6 bg-[#0a1128] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-in slide-in-from-top-3 border border-cyan-400">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

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
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Report Card Theme &amp; End-of-Term Newsletter
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              The colour scheme every card is printed in, and the circular that prints on the back of it, filed once on{" "}
              {SCHOOL_INFO.name}&apos;s records so all machines read the same pair.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                void reloadBulletins();
                void reloadTheme();
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Read the school&apos;s records again
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

        {(bulletinsSource !== "server" || themeSource !== "server") && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] leading-snug text-amber-950 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>
                {bulletinsSource !== "server" && themeSource !== "server"
                  ? "Neither the circulars nor the card theme have been read from the school's records,"
                  : bulletinsSource !== "server"
                    ? "The circulars have not been read from the school's records, so the bulletin below is this browser's own copy"
                    : "The card theme has not been read from the school's records, so the scheme selected below is this browser's own copy"}
              </strong>{" "}
              Another machine will not see what is typed here, and clearing this browser&apos;s data loses it.
            </p>
          </div>
        )}

        {refusal && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-[11px] leading-snug text-rose-950 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Nothing was filed on the school&apos;s records.</strong> {refusal}
            </p>
          </div>
        )}

        {/* Section 1: Color Scheme Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600" />
              Report Card Color Scheme
            </h3>
            <span className="text-xs text-slate-500">
              {themeSource !== "server"
                ? "Not read from the school's records."
                : `On the school's records${themeUpdatedAt ? ` since ${new Date(themeUpdatedAt).toLocaleDateString()}` : ""}${
                    themeUpdatedBy ? `, filed by ${themeUpdatedBy}` : ""
                  }.`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {COLOR_SCHEMES.map((scheme) => (
              <div
                key={scheme.id}
                onClick={() => canEdit && setThemeDraft(scheme.id)}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between space-y-3 ${
                  canEdit ? "cursor-pointer" : "cursor-default"
                } ${
                  shownTheme === scheme.id
                    ? `${scheme.borderClass} ring-2 ring-blue-500/20 shadow-sm bg-slate-50/70`
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="space-y-2">
                  <div className={`h-8 rounded-lg bg-gradient-to-r ${scheme.previewBg} shadow-xs flex items-center justify-end px-2`}>
                    {shownTheme === scheme.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{scheme.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{scheme.desc}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded text-center block ${
                    shownTheme === scheme.id ? scheme.badgeClass : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {shownTheme === scheme.id ? (isThemeDraft ? "Chosen, not filed" : "The school's scheme") : "Select Scheme"}
                </span>
              </div>
            ))}
          </div>

          {canEdit ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <p className="text-[11px] text-slate-500 max-w-2xl">
                The scheme picked on the score-card screen only colours the sheets that run through that printer. This
                row is the school&apos;s standing choice, and filing it changes what every machine opens the card with.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {isThemeDraft && (
                  <button
                    onClick={() => setThemeDraft(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => void handleFileTheme()}
                  disabled={isFiling || !isThemeDraft}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isFiling && isThemeDraft ? "Filing…" : "File theme on the school's records"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              Only a Super Admin or the Exam Office files the card theme; this screen shows what the records hold.
            </p>
          )}
        </div>

        {/* Section 2: End-of-Term Newsletter Editor */}
        <form onSubmit={handleFileBulletin} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                End-of-Term Official Terminal Newsletter &amp; Notice
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                One circular per session and term. The score card prints the one labelled with the term it is being
                printed for — a term with no filed circular prints as having none rather than repeating another
                term&apos;s words.
              </p>
            </div>
            {canEdit && (
              <button
                type="submit"
                disabled={isFiling}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {isFiling ? "Filing on the school's records…" : "File on the school's records"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Session this circular is for</label>
              <select
                value={period.session}
                onChange={(e) => setPeriod((p) => ({ ...p, session: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                {sessionList.map((session) => (
                  <option key={session} value={session}>
                    {session} Session
                  </option>
                ))}
                {!sessionList.includes(period.session) && <option value={period.session}>{period.session}</option>}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Term this circular is for</label>
              <select
                value={period.term}
                onChange={(e) => setPeriod((p) => ({ ...p, term: e.target.value as ReportTerm }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                {REPORT_TERMS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[11px] leading-snug rounded-xl px-3 py-2 border bg-slate-50 text-slate-600 border-slate-200">
            {filedBulletin ? (
              <>
                <strong className="text-slate-800">
                  A circular is already filed for {period.term} of {period.session}.
                </strong>{" "}
                Filing again replaces it{filedBulletin.updatedBy ? `, last written by ${filedBulletin.updatedBy}` : ""}
                {filedBulletin.updatedAt ? ` on ${new Date(filedBulletin.updatedAt).toLocaleDateString()}` : ""}.
              </>
            ) : bulletinsSource === "server" ? (
              <>Nothing is filed for {period.term} of {period.session} yet — cards printed for that term currently say so.</>
            ) : (
              <>
                The school&apos;s records could not be read, so this screen cannot say whether {period.term} of{" "}
                {period.session} already has a circular.
              </>
            )}
            {bulletins.length > 0 && bulletinsFiledForOtherPeriods.length > 0 && (
              <span className="text-slate-500">
                {" "}
                Filed for other periods: {bulletinsFiledForOtherPeriods.map((b) => `${b.term} ${b.session}`).join(", ")}.
              </span>
            )}
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Bulletin Title</label>
            <input
              type="text"
              value={current.title}
              onChange={(e) => setField("title")(e.target.value)}
              placeholder="e.g. End of Term Newsletter & Parent Advisory"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Director / Principal Sign-off Name</label>
              <input
                type="text"
                value={current.principalName}
                onChange={(e) => setField("principalName")(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Next Term Resumption Date</label>
              <input
                type="text"
                placeholder="e.g. Monday, January 12, 2026"
                value={current.nextTermResumption}
                onChange={(e) => setField("nextTermResumption")(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Principal&apos;s End-of-Term Executive Address</label>
            <textarea
              rows={3}
              value={current.principalMessage}
              onChange={(e) => setField("principalMessage")(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-normal"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">
              Upcoming Term Key Events &amp; Milestones (One per line)
            </label>
            <textarea
              rows={4}
              value={current.eventsText}
              onChange={(e) => setField("eventsText")(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-mono"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Tuition Fee Policy &amp; Clearance Deadlines</label>
            <textarea
              rows={2}
              value={current.feePolicy}
              onChange={(e) => setField("feePolicy")(e.target.value)}
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
                  value={current.bankName}
                  onChange={(e) => setField("bankName")(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Account Name</label>
                <input
                  type="text"
                  value={current.accountName}
                  onChange={(e) => setField("accountName")(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={current.accountNumber}
                  onChange={(e) => setField("accountNumber")(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono font-bold tracking-wider"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Families pay what is printed here. Nothing is filled in for the school: an empty box prints as empty, and
              a filed account number replaces the previous one for every card printed after it.
            </p>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Special Advisories &amp; General Notes</label>
            <input
              type="text"
              placeholder="e.g. Please ensure students return with complete uniforms, textbooks, and sports wear."
              value={current.customNotes}
              onChange={(e) => setField("customNotes")(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-normal"
            />
          </div>

          {canEdit ? (
            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              <p className="text-[11px] text-slate-500 flex items-start gap-1.5 max-w-xl">
                <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                {bulletinsSource === "server"
                  ? "Filing writes this circular onto the school's records for the session and term chosen above, replacing whatever that term held."
                  : "The school's records could not be read, so filing will not reach them. This screen is working from this browser's copy."}
              </p>
              <div className="flex items-center gap-2">
                {isBulletinDraft && (
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Cancel Edits
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isFiling}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {isFiling ? "Filing on the school's records…" : "File this term's circular"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              This is what the school has filed. Only a Super Admin or the Exam Office writes a circular.
            </p>
          )}
        </form>
      </div>
    </DashboardShell>
  );
}
