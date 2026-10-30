"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TesterAccess } from "@/components/settings/tester-access";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  purgeAllDemoData,
  restoreDefaultSeedData,
  useRealtimeNewsletter,
  useRealtimeAuth,
  useRealtimeCBTConfig,
} from "@/lib/realtime-store";
import {
  Settings,
  ArrowLeft,
  Save,
  CheckCircle2,
  Lock,
  Unlock,
  Key,
  Mail,
  Phone,
  Shield,
  Building,
  Bell,
  Trash2,
  RotateCcw,
  Database,
  AlertTriangle,
  Sliders,
  FileText,
  Sparkles,
  Award,
  LogOut,
  RefreshCw,
  UserCheck,
  Laptop,
  Power,
  Radio,
  Clock,
  Eye,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, purgeAllSessions } = useRealtimeAuth();
  const { newsletter, updateNewsletter } = useRealtimeNewsletter();
  const { cbtConfig, updateCBTConfig, toggleCBTAccess } = useRealtimeCBTConfig();

  const [schoolName, setSchoolName] = useState<string>(SCHOOL_INFO.name);
  const [schoolAddress, setSchoolAddress] = useState<string>(SCHOOL_INFO.address);
  const [currentSession, setCurrentSession] = useState<string>(SCHOOL_INFO.currentSession);
  const [currentTerm, setCurrentTerm] = useState<string>(SCHOOL_INFO.currentTerm);
  const [isSaved, setIsSaved] = useState(false);
  const [isCBTSaved, setIsCBTSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Newsletter settings local state
  const [newsletterTitle, setNewsletterTitle] = useState(newsletter.title || "Royal Crown Academy End-of-Term Bulletin");
  const [resumptionDate, setResumptionDate] = useState(newsletter.nextTermResumption || newsletter.resumptionDate || "Monday, 12th January 2026");
  const [principalName, setPrincipalName] = useState(newsletter.principalName || "Dr. Dominic Mark (Principal / Director)");

  // CBT Configuration local state
  const [cbtExamMode, setCBTExamMode] = useState(cbtConfig.activeExamMode || "Terminal Examination");
  const [cbtWindow, setCBTWindow] = useState(cbtConfig.scheduledWindow || "Monday - Friday (8:00 AM - 2:00 PM)");
  const [cbtMessage, setCBTMessage] = useState(cbtConfig.offlineMessage || "The Computer-Based Testing (CBT) portal is currently closed for the term. Please contact the Examination Office or Dean of Studies for the approved assessment schedule.");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateNewsletter({
      title: newsletterTitle,
      resumptionDate: resumptionDate,
      nextTermResumption: resumptionDate,
      principalName: principalName,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSaveCBTSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateCBTConfig({
      activeExamMode: cbtExamMode,
      scheduledWindow: cbtWindow,
      offlineMessage: cbtMessage,
    });
    setIsCBTSaved(true);
    setToastMessage("CBT Engine configuration updated and broadcast live!");
    setTimeout(() => {
      setIsCBTSaved(false);
      setToastMessage(null);
    }, 4000);
  };

  const handleToggleCBTEngine = (nextState?: boolean) => {
    const updatedState = typeof nextState === "boolean" ? nextState : !cbtConfig.isOpen;
    toggleCBTAccess(updatedState);
    const statusText = updatedState ? "OPENED for student assessments" : "LOCKED DOWN / CLOSED to candidates";
    setToastMessage(`CBT Examination Engine is now ${statusText}.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handlePurge = () => {
    if (confirm("Are you sure you want to PURGE ALL sample demo data? This will clear all mock students, staff, and scores to zero state so you can start 100% fresh with genuine school records.")) {
      purgeAllDemoData();
      setToastMessage("All demo records purged! Database is now empty and ready for authentic school enrollment.");
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleRestore = () => {
    if (confirm("Restore standard curriculum defaults?")) {
      restoreDefaultSeedData();
      setToastMessage("Standard curriculum and baseline configurations restored.");
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handlePurgeSessions = () => {
    if (confirm("Purge all active sessions and log out?")) {
      purgeAllSessions();
      router.push("/login");
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-[#0000FF] flex items-center gap-1 font-semibold">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-900 font-extrabold">System Settings</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Institutional &amp; Portal Preferences</span>
              <span className="text-xs bg-blue-100 text-[#0000FF] font-black px-2.5 py-0.5 rounded-full border border-blue-300 uppercase">
                Scheme 1
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure system parameters, CBT assessment windows, Universal Nigerian standard grading compliance, and database controls for {SCHOOL_INFO.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePurgeSessions}
              className="px-4 py-2 text-xs font-bold bg-rose-50 hover:bg-[#FF0000] text-rose-700 hover:text-white border border-rose-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Purge Active Sessions</span>
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-[#0a1128] text-white border border-cyan-400 px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 z-50 animate-in fade-in shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            {toastMessage}
          </div>
        )}

        {isSaved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Portal settings saved and synchronized across all active modules!
          </div>
        )}

        {isCBTSaved && (
          <div className="bg-cyan-50 border border-cyan-300 text-cyan-950 rounded-2xl p-4 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-600 flex-shrink-0" />
            CBT Engine parameters saved and broadcast to all candidate portals!
          </div>
        )}

        <TesterAccess />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
          
          {/* Main Settings Form */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. CBT Examination Engine Governance & Lockdown Card */}
            <div className={`bg-white border-2 rounded-3xl p-6 shadow-md transition-all space-y-5 ${
              cbtConfig.isOpen ? "border-blue-300 ring-2 ring-blue-500/10" : "border-amber-300 ring-2 ring-amber-500/10"
            }`}>
              {/* Card Header with Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
                    cbtConfig.isOpen ? "bg-[#0000FF] ring-2 ring-cyan-400/40" : "bg-[#FF0000] ring-2 ring-rose-300"
                  }`}>
                    <Laptop className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span>CBT Examination Engine Governance</span>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        Admin Lockdown
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Manage candidate testing access windows, offline lockdown state, and candidate announcements.
                    </p>
                  </div>
                </div>

                {/* Live Indicator Pill */}
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
                    cbtConfig.isOpen
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-red-100 text-red-900 border-red-300"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      cbtConfig.isOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    }`} />
                    {cbtConfig.isOpen ? "CBT Portal: Open" : "CBT Portal: Closed"}
                  </span>
                </div>
              </div>

              {/* Master Open / Close Switch Banner */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                cbtConfig.isOpen
                  ? "bg-gradient-to-r from-blue-50/90 via-cyan-50/50 to-slate-50 border-blue-200"
                  : "bg-gradient-to-r from-rose-50/90 via-amber-50/50 to-slate-50 border-rose-200"
              }`}>
                <div className="space-y-1 max-w-md text-xs">
                  <p className="font-black text-slate-900 flex items-center gap-1.5">
                    {cbtConfig.isOpen ? (
                      <>
                        <Radio className="w-4 h-4 text-[#0000FF]" />
                        Assessment Engine is Live &amp; Accessible to Candidates
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-[#FF0000]" />
                        Assessment Engine is Closed &amp; Locked Down
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {cbtConfig.isOpen
                      ? "Enrolled students can log in, launch timed tests, and submit answers to the Continuous Assessment gradebook."
                      : "Students visiting the CBT module will see the official institutional closure notice. Admins can still preview tests."}
                  </p>
                </div>

                {/* Primary Action Button */}
                <div className="flex-shrink-0 w-full sm:w-auto">
                  {cbtConfig.isOpen ? (
                    <button
                      type="button"
                      onClick={() => handleToggleCBTEngine(false)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-[#FF0000] hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Lockdown / Close CBT Portal</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleCBTEngine(true)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-[#0000FF] hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Unlock className="w-4 h-4 text-cyan-300" />
                      <span>Open CBT Portal for Candidates</span>
                    </button>
                  )}
                </div>
              </div>

              {/* CBT Configuration Form */}
              <form onSubmit={handleSaveCBTSettings} className="space-y-4 text-xs pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Active Assessment Examination Mode
                    </label>
                    <select
                      value={cbtExamMode}
                      onChange={(e) => setCBTExamMode(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none focus:border-[#0000FF] cursor-pointer"
                    >
                      <option value="Terminal Examination">Terminal Examination (Final Exams)</option>
                      <option value="Continuous Assessment Test (CAT)">Continuous Assessment Test (CAT 1 &amp; 2)</option>
                      <option value="Mid-Term Examination">Mid-Term Assessment Window</option>
                      <option value="Mock & Revision Practice">Mock &amp; Revision Practice Mode</option>
                      <option value="Closed / Maintenance Mode">Closed / Off-Season Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Scheduled Testing Window
                    </label>
                    <input
                      type="text"
                      value={cbtWindow}
                      onChange={(e) => setCBTWindow(e.target.value)}
                      placeholder="e.g. Monday - Friday (8:00 AM - 2:00 PM)"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold outline-none focus:border-[#0000FF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Candidate Offline Lockdown Notice (Displayed when Closed)
                  </label>
                  <textarea
                    rows={3}
                    value={cbtMessage}
                    onChange={(e) => setCBTMessage(e.target.value)}
                    placeholder="Notice displayed to candidates when the CBT portal is closed..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs outline-none focus:border-[#0000FF] leading-relaxed resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This message will be rendered on the dedicated candidate closed screen when students attempt to access the CBT module during off-hours or outside exam windows.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-cyan-400" />
                    <span>Save CBT Governance Parameters</span>
                  </button>

                  <Link
                    href="/cbt"
                    className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview CBT Portal Screen →</span>
                  </Link>
                </div>
              </form>
            </div>

            {/* 2. School Identity & Newsletter Form */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
              <form onSubmit={handleSave} className="space-y-5 text-xs">
                
                {/* School Identity */}
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Building className="w-4 h-4 text-[#0000FF]" />
                    School Institutional Identity
                  </h3>

                  <div className="space-y-3 pt-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">School Name</label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none focus:border-[#0000FF]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Campus Location / Address</label>
                      <input
                        type="text"
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-[#0000FF]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Current Academic Session</label>
                        <input
                          type="text"
                          value={currentSession}
                          onChange={(e) => setCurrentSession(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono outline-none focus:border-[#0000FF]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Active Academic Term</label>
                        <select
                          value={currentTerm}
                          onChange={(e) => setCurrentTerm(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold outline-none focus:border-[#0000FF]"
                        >
                          <option value="First Term">First Term</option>
                          <option value="Second Term">Second Term</option>
                          <option value="Third Term">Third Term</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scorecard Newsletter Defaults */}
                <div className="pt-2">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <FileText className="w-4 h-4 text-cyan-600" />
                    Scorecard End-of-Term Address &amp; Signatory
                  </h3>

                  <div className="space-y-3 pt-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Terminal Bulletin Title</label>
                      <input
                        type="text"
                        value={newsletterTitle}
                        onChange={(e) => setNewsletterTitle(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-[#0000FF]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Next Term Resumption Date</label>
                        <input
                          type="text"
                          value={resumptionDate}
                          onChange={(e) => setResumptionDate(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold outline-none focus:border-[#0000FF]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Principal / Signatory Full Title</label>
                        <input
                          type="text"
                          value={principalName}
                          onChange={(e) => setPrincipalName(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold outline-none focus:border-[#0000FF]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#0000FF] hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-cyan-300" />
                    <span>Save Portal Preferences</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Universal Educational Grading Compliance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#0000FF]" />
                  Approved Universal Grading System (A – F Scale)
                </h3>
                <Link
                  href="/setup/grading"
                  className="text-xs font-black text-[#0000FF] hover:text-blue-800 flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  View Scale Details →
                </Link>
              </div>

              <div className="grid grid-cols-5 gap-2 text-xs text-center">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                  <strong className="text-base font-black text-[#0000FF] block">A</strong>
                  <span className="text-[11px] font-bold text-slate-700 block">70 – 100%</span>
                  <span className="text-[10px] text-slate-500">Distinction (4.0)</span>
                </div>
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-2xl">
                  <strong className="text-base font-black text-cyan-800 block">B</strong>
                  <span className="text-[11px] font-bold text-slate-700 block">60 – 69%</span>
                  <span className="text-[10px] text-slate-500">Very Good (3.0)</span>
                </div>
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl">
                  <strong className="text-base font-black text-sky-800 block">C</strong>
                  <span className="text-[11px] font-bold text-slate-700 block">50 – 59%</span>
                  <span className="text-[10px] text-slate-500">Credit (2.0)</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl ring-2 ring-amber-400/30">
                  <strong className="text-base font-black text-amber-800 block">D</strong>
                  <span className="text-[11px] font-bold text-amber-900 block">45 – 49%</span>
                  <span className="text-[10px] text-amber-700 font-bold">Pass Mark (1.0)</span>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl">
                  <strong className="text-base font-black text-red-700 block">F</strong>
                  <span className="text-[11px] font-bold text-slate-700 block">0 – 44%</span>
                  <span className="text-[10px] text-red-600 font-bold">Fail (0.0)</span>
                </div>
              </div>
            </div>

            {/* Database & Data Persistence Management */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Database className="w-4 h-4 text-emerald-600" />
                Live Data Store &amp; Zero-Start Baseline Controls
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The RCA SMS uses real-time persistent data stores. To deploy for genuine institutional use and start 100% clean with zero mock students and zero non-admin staff, use the controls below:
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePurge}
                  className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-[#FF0000] text-[#FF0000] hover:text-white border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Purge All Demo Data (Start 100% Clean)
                </button>

                <button
                  type="button"
                  onClick={handleRestore}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore Standard Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Admin Profile Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0a1128] border border-blue-950 rounded-3xl p-5 text-white shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0000FF] text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-700/40 ring-1 ring-cyan-400/50">
                  {currentUser?.fullName ? currentUser.fullName.slice(0, 2).toUpperCase() : "DM"}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">{currentUser?.fullName || "Dr. Dominic Mark"}</h4>
                  <p className="text-xs text-cyan-400 font-mono">@{currentUser?.username || "dominic370"}</p>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-blue-900/60 font-mono">
                <p>Staff ID: <strong className="text-white">{currentUser?.staffId || "RCA/PERS/025"}</strong></p>
                <p>Role: <strong className="text-cyan-300">{currentUser?.role || "SUPER_ADMIN"}</strong></p>
                <p>Subject: <strong className="text-white">{currentUser?.assignedSubject || "ICT"}</strong></p>
              </div>

              <div className="p-3 bg-[#060b19]/80 rounded-2xl border border-cyan-500/20 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Shield className="w-3.5 h-3.5" />
                  Active Session Authorized
                </div>
                <p>Tiered draft logins and universal role permissions are enabled across all 5 user tiers.</p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3 text-xs">
              <h4 className="font-black text-slate-900">Quick Configuration Shortcuts</h4>
              <div className="space-y-2 font-semibold text-slate-700">
                <Link
                  href="/login"
                  className="block p-2 rounded-xl hover:bg-blue-50 transition-colors text-[#0000FF] flex items-center justify-between"
                >
                  <span>🔐 Open Portal Sign-In / Draft Logins</span>
                  <span>→</span>
                </Link>
                <Link
                  href="/setup/ca-structure"
                  className="block p-2 rounded-xl hover:bg-blue-50 transition-colors text-[#0000FF] flex items-center justify-between"
                >
                  <span>📊 Tier CA Structure Assignment</span>
                  <span>→</span>
                </Link>
                <Link
                  href="/setup/calendar"
                  className="block p-2 rounded-xl hover:bg-blue-50 transition-colors text-[#0000FF] flex items-center justify-between"
                >
                  <span>📅 Activity Input Templates</span>
                  <span>→</span>
                </Link>
                <Link
                  href="/operations/score-card"
                  className="block p-2 rounded-xl hover:bg-blue-50 transition-colors text-[#0000FF] flex items-center justify-between"
                >
                  <span>🎓 Terminal Scorecards &amp; Newsletter</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>

        </div>

      </div>
    </DashboardShell>
  );
}
