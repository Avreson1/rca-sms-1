"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeClasses,
  useRealtimeStudents,
} from "@/lib/realtime-store";
import {
  FileCheck,
  ArrowLeft,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Printer,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export default function PublishResultsPage() {
  const { classes } = useRealtimeClasses();
  const { students } = useRealtimeStudents();
  
  const [publishedMap, setPublishedMap] = useState<Record<string, { isPublished: boolean; date?: string }>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rca_published_classes_v6");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return {};
  });

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const savePublishedState = (updated: Record<string, { isPublished: boolean; date?: string }>) => {
    setPublishedMap(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("rca_published_classes_v6", JSON.stringify(updated));
    }
  };

  const togglePublish = (className: string) => {
    const current = publishedMap[className]?.isPublished;
    const updated = {
      ...publishedMap,
      [className]: {
        isPublished: !current,
        date: !current ? new Date().toLocaleDateString() : undefined,
      },
    };
    savePublishedState(updated);
    setNotificationMsg(
      !current ? `Published and authorized results for ${className}!` : `Revoked result access for ${className}.`
    );
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handlePublishAll = () => {
    const today = new Date().toLocaleDateString();
    const updated: Record<string, { isPublished: boolean; date?: string }> = {};
    classes.forEach((c) => {
      updated[c.name] = { isPublished: true, date: today };
    });
    savePublishedState(updated);
    setNotificationMsg(`Universal Release: Published all ${classes.length} class results across the academy!`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleUnpublishAll = () => {
    if (confirm("Are you sure you want to lock and unpublish all class results?")) {
      const updated: Record<string, { isPublished: boolean; date?: string }> = {};
      classes.forEach((c) => {
        updated[c.name] = { isPublished: false };
      });
      savePublishedState(updated);
      setNotificationMsg("Locked and revoked public release for all classes.");
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const publishedCount = classes.filter((c) => publishedMap[c.name]?.isPublished).length;

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
              <span className="text-slate-800 font-semibold">Publish Results</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Terminal Result Publishing &amp; Approval
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review, approve, and authorize terminal score cards for student access and parent notification.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePublishAll}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publish All Class Results
            </button>
            <button
              onClick={handleUnpublishAll}
              className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Lock className="w-4 h-4 text-slate-500" />
              Lock / Unpublish All
            </button>
            <Link
              href="/operations/score-card"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Inspect Score Cards
            </Link>
          </div>
        </div>

        {/* Notification Toast */}
        {notificationMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            {notificationMsg}
          </div>
        )}

        {/* Status Metrics Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
              Terminal Release Status
            </span>
            <h2 className="text-2xl font-black text-white mt-1">
              {publishedCount} of {classes.length} Classes Authorized
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Academic Session: <strong className="text-white">{SCHOOL_INFO.currentSession}</strong> • Term:{" "}
              <strong className="text-blue-400">{SCHOOL_INFO.currentTerm}</strong> • Total Enrolled Pupils:{" "}
              <strong className="text-emerald-400">{students.length}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePublishAll}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              Authorize All Tiers Now
            </button>
          </div>
        </div>

        {/* Classes Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Class Publication Authorization Matrix</h3>
            <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
              {publishedCount}/{classes.length} Published
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Class Arm</th>
                  <th className="py-3 px-3">Section Tier</th>
                  <th className="py-3 px-3">Enrolled Count</th>
                  <th className="py-3 px-4">Continuous Assessment Status</th>
                  <th className="py-3 px-4">Publication State</th>
                  <th className="py-3 px-4 text-right">Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((c) => {
                  const studentCount = students.filter((s) => s.className === c.name).length;
                  const pubInfo = publishedMap[c.name] || { isPublished: false };
                  const isPublished = pubInfo.isPublished;

                  return (
                    <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-3 text-slate-600">{c.section}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{studentCount} Students</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Complete &amp; Synced
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Published ({pubInfo.date || "Approved"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <Lock className="w-3.5 h-3.5" />
                            Locked / Unreleased
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => togglePublish(c.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                            isPublished
                              ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          {isPublished ? "Revoke / Unpublish" : "Authorize & Publish"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
