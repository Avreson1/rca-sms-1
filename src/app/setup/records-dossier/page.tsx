"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useSchoolConfig, saveSchoolConfigToSupabase, SchoolConfigRow } from "@/lib/school-config";
import { useRealtimeAuth, useRealtimeStudents, useRealtimeStaff, useRealtimeClasses } from "@/lib/realtime-store";
import { SchoolLetterhead, SchoolBrandContext } from "@/components/ui/school-letterhead";
import {
  FileText,
  Printer,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  Briefcase,
  Sliders,
  Upload,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Search,
} from "lucide-react";

export default function RecordsDossierSetupPage() {
  const { config, loaded, reload } = useSchoolConfig();
  const { currentUser } = useRealtimeAuth();
  const { students } = useRealtimeStudents();
  const { staff } = useRealtimeStaff();
  const { classes } = useRealtimeClasses();

  // Tab State: "signatories" | "print-students" | "print-staff"
  const [activeTab, setActiveTab] = useState<"signatories" | "print-students" | "print-staff">("signatories");

  // Signatory & Authorization Form State
  const [formData, setFormData] = useState({
    primary_signatory_name: "",
    primary_signatory_title: "",
    primary_signature_url: "",
    secondary_signatory_name: "",
    secondary_signatory_title: "",
    secondary_signature_url: "",
    auth_footer_note: "",
  });

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ tone: "good" | "warn"; text: string } | null>(null);

  // Sync from loaded config
  useEffect(() => {
    if (config) {
      setFormData({
        primary_signatory_name: config.primary_signatory_name || "Head Teacher",
        primary_signatory_title: config.primary_signatory_title || "Head of Primary School",
        primary_signature_url: config.primary_signature_url || "",
        secondary_signatory_name: config.secondary_signatory_name || "Dr. Mrs. P. O. Awoniyi",
        secondary_signatory_title: config.secondary_signatory_title || "Principal / Head of School",
        secondary_signature_url: config.secondary_signature_url || "",
        auth_footer_note:
          config.auth_footer_note ||
          "This document is system-generated and valid only with the official school seal and authorized signature.",
      });
    }
  }, [config]);

  // Handle signature image upload via FileReader
  const handleSignatureUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "primary_signature_url" | "secondary_signature_url"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 150000) {
      setStatusMessage({
        tone: "warn",
        text: "Signature image is too large. Please use a file smaller than 150 KB.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData((prev) => ({ ...prev, [field]: result }));
      setStatusMessage({ tone: "good", text: "Signature stamp loaded. Click Save to persist." });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignatories = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setSaving(true);
    setStatusMessage(null);

    const updatedConfig: SchoolConfigRow = {
      ...config,
      primary_signatory_name: formData.primary_signatory_name.trim(),
      primary_signatory_title: formData.primary_signatory_title.trim(),
      primary_signature_url: formData.primary_signature_url.trim(),
      secondary_signatory_name: formData.secondary_signatory_name.trim(),
      secondary_signatory_title: formData.secondary_signatory_title.trim(),
      secondary_signature_url: formData.secondary_signature_url.trim(),
      auth_footer_note: formData.auth_footer_note.trim(),
    };

    const res = await saveSchoolConfigToSupabase(updatedConfig);
    setSaving(false);

    if (res.ok) {
      setStatusMessage({
        tone: "good",
        text: "Official school signatories and authorization footer updated successfully.",
      });
      reload();
    } else {
      setStatusMessage({
        tone: "warn",
        text: `Failed to save signatories: ${res.reason || "Database refused request"}`,
      });
    }
  };

  // Bulk Student Directory Filters
  const [studentSectionFilter, setStudentSectionFilter] = useState<"all" | "PRIMARY" | "SECONDARY">("all");
  const [studentClassFilter, setStudentClassFilter] = useState("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");

  const filteredStudents = students.filter((s) => {
    const isSec =
      s.className.toLowerCase().includes("jss") ||
      s.className.toLowerCase().includes("sss") ||
      s.className.toLowerCase().includes("secondary");
    const section = isSec ? "SECONDARY" : "PRIMARY";

    if (studentSectionFilter !== "all" && section !== studentSectionFilter) return false;
    if (studentClassFilter !== "all" && s.className !== studentClassFilter) return false;
    if (studentStatusFilter !== "all" && s.feeStatus !== studentStatusFilter) return false;

    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        (s.guardianName && s.guardianName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Bulk Staff Directory Filters
  const [staffSectionFilter, setStaffSectionFilter] = useState<"all" | "PRIMARY" | "SECONDARY">("all");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
  const [staffStatusFilter, setStaffStatusFilter] = useState("all");
  const [staffSearch, setStaffSearch] = useState("");

  const filteredStaff = staff.filter((st) => {
    const assignedLower = (st.assignedClass || "").toLowerCase();
    const isSec =
      assignedLower.includes("jss") ||
      assignedLower.includes("sss") ||
      assignedLower.includes("secondary");
    const isPri =
      assignedLower.includes("primary") ||
      assignedLower.includes("nursery") ||
      assignedLower.includes("creche") ||
      assignedLower.includes("play");
    const section = isSec && !isPri ? "SECONDARY" : isPri && !isSec ? "PRIMARY" : "all";

    if (staffSectionFilter !== "all" && section !== "all" && section !== staffSectionFilter) {
      return false;
    }
    if (staffRoleFilter !== "all" && st.role !== staffRoleFilter) return false;
    if (staffStatusFilter !== "all" && (st.status || "Active") !== staffStatusFilter) return false;

    if (staffSearch) {
      const q = staffSearch.toLowerCase();
      return (
        st.fullName.toLowerCase().includes(q) ||
        st.staffId.toLowerCase().includes(q) ||
        (st.designation && st.designation.toLowerCase().includes(q)) ||
        (st.assignedClass && st.assignedClass.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Determine Brand Context for Bulk Prints
  const studentPrintBrand: SchoolBrandContext =
    studentSectionFilter === "SECONDARY"
      ? "SECONDARY"
      : studentSectionFilter === "PRIMARY"
      ? "PRIMARY"
      : "GROUP";

  const staffPrintBrand: SchoolBrandContext =
    staffSectionFilter === "SECONDARY"
      ? "SECONDARY"
      : staffSectionFilter === "PRIMARY"
      ? "PRIMARY"
      : "GROUP";

  // RBAC Access Guard: Only SUPER_ADMIN allowed
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  if (!isSuperAdmin && currentUser) {
    return (
      <DashboardShell>
        <div className="max-w-2xl mx-auto py-12 px-4 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-6">
            Setup of official signatories, authorization rules, and institutional whole-school printing is restricted to <strong>SUPER_ADMIN</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Top Header & Breadcrumbs (Screen Only) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-1">
              <Link href="/setup/classes" className="hover:text-blue-600">Setup</Link>
              <span>/</span>
              <span className="text-slate-800">Records &amp; Dossier</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-600" />
              Records, Signatories &amp; Official Printouts
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Configure authorized signatories and print whole-school directories under the official school letterhead.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => reload()}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg shadow-2xs cursor-pointer"
              title="Refresh configuration from server"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold print:hidden ${
              statusMessage.tone === "good"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.tone === "good" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="font-bold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Selection Navigation (Screen Only) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("signatories")}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "signatories"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            Signatories &amp; Authorization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("print-students")}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "print-students"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Print Student Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("print-staff")}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "print-staff"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Print Staff Directory
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SIGNATORIES & AUTHORIZATION SETTINGS FORM */}
        {/* ========================================================================= */}
        {activeTab === "signatories" && (
          <div className="space-y-6">
            <form onSubmit={handleSaveSignatories} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Primary School Signatory */}
                <div className="bg-white rounded-xl border border-blue-200 shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">
                        Early &amp; Basic Education
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900">
                        Primary School Signatory (Royal Crown Academy)
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      Primary
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Signatory Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.primary_signatory_name}
                        onChange={(e) =>
                          setFormData({ ...formData, primary_signatory_name: e.target.value })
                        }
                        placeholder="e.g. Mrs. Grace A. Oladipo"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Official Title / Role
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.primary_signatory_title}
                        onChange={(e) =>
                          setFormData({ ...formData, primary_signatory_title: e.target.value })
                        }
                        placeholder="e.g. Head Teacher / Head of Primary School"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Official Signature Stamp (PNG / JPEG)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5 shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Signature Image</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleSignatureUpload(e, "primary_signature_url")}
                            className="hidden"
                          />
                        </label>
                        {formData.primary_signature_url && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, primary_signature_url: "" })}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {formData.primary_signature_url && (
                        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                          <img
                            src={formData.primary_signature_url}
                            alt="Primary Signature Preview"
                            className="h-10 max-w-[140px] object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card 2: Secondary School Signatory */}
                <div className="bg-white rounded-xl border border-red-200 shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-red-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-red-600 tracking-wider block">
                        High School &amp; College
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900">
                        Secondary School Signatory (Royal Crown High School)
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                      Secondary
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Signatory Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.secondary_signatory_name}
                        onChange={(e) =>
                          setFormData({ ...formData, secondary_signatory_name: e.target.value })
                        }
                        placeholder="e.g. Dr. Mrs. P. O. Awoniyi"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Official Title / Role
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.secondary_signatory_title}
                        onChange={(e) =>
                          setFormData({ ...formData, secondary_signatory_title: e.target.value })
                        }
                        placeholder="e.g. Principal / Head of School"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Official Signature Stamp (PNG / JPEG)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5 shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Signature Image</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleSignatureUpload(e, "secondary_signature_url")}
                            className="hidden"
                          />
                        </label>
                        {formData.secondary_signature_url && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, secondary_signature_url: "" })}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {formData.secondary_signature_url && (
                        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                          <img
                            src={formData.secondary_signature_url}
                            alt="Secondary Signature Preview"
                            className="h-10 max-w-[140px] object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Institutional Authorization Footer Note */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Official Authorization Footer Note (Printed on Dossiers &amp; Transcripts)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  This legal notice is automatically printed at the base of every official report card, dossier, and directory register.
                </p>
                <textarea
                  rows={2}
                  value={formData.auth_footer_note}
                  onChange={(e) => setFormData({ ...formData, auth_footer_note: e.target.value })}
                  placeholder="e.g. This document is system-generated and valid only with the official school seal and authorized signature."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                />
              </div>

              {/* Submit Action Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving Changes…" : "Save Signatory Settings"}
                </button>
              </div>
            </form>

            {/* Live Interactive Letterhead Signature Preview */}
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Live Letterhead &amp; Authorization Footer Preview
              </h3>
              <p className="text-xs text-slate-500">
                Preview how the official footer renders across both school sections.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block mb-3">
                    Primary School Letterhead Footer
                  </span>
                  <SchoolLetterhead
                    brand="PRIMARY"
                    title="SAMPLE OFFICIAL DOCUMENT"
                    showSignatoryFooter={true}
                    signatoryName={formData.primary_signatory_name}
                    signatoryLabel={formData.primary_signatory_title}
                    signatureUrl={formData.primary_signature_url}
                    authFooterNote={formData.auth_footer_note}
                  >
                    <div className="py-4 text-center text-xs text-slate-400 italic">
                      [Document Body Content Appears Here]
                    </div>
                  </SchoolLetterhead>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                  <span className="text-[10px] font-bold text-red-700 uppercase block mb-3">
                    Secondary School Letterhead Footer
                  </span>
                  <SchoolLetterhead
                    brand="SECONDARY"
                    title="SAMPLE OFFICIAL DOCUMENT"
                    showSignatoryFooter={true}
                    signatoryName={formData.secondary_signatory_name}
                    signatoryLabel={formData.secondary_signatory_title}
                    signatureUrl={formData.secondary_signature_url}
                    authFooterNote={formData.auth_footer_note}
                  >
                    <div className="py-4 text-center text-xs text-slate-400 italic">
                      [Document Body Content Appears Here]
                    </div>
                  </SchoolLetterhead>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WHOLE-SCHOOL STUDENT DIRECTORY PRINTING */}
        {/* ========================================================================= */}
        {activeTab === "print-students" && (
          <div className="space-y-6">
            {/* Filter and Control Bar (Hidden on Print) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Student Register Print Controls
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filter by section or year group before printing official master records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-xs cursor-pointer self-start"
                >
                  <Printer className="w-4 h-4" />
                  Print Student Directory
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">School Section</label>
                  <select
                    value={studentSectionFilter}
                    onChange={(e) => setStudentSectionFilter(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="all">All Sections (Unified Group)</option>
                    <option value="PRIMARY">Royal Crown Academy (Primary)</option>
                    <option value="SECONDARY">Royal Crown High School (Secondary)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Class / Arm</label>
                  <select
                    value={studentClassFilter}
                    onChange={(e) => setStudentClassFilter(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fee Status</label>
                  <select
                    value={studentStatusFilter}
                    onChange={(e) => setStudentStatusFilter(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="all">All Fee Statuses</option>
                    <option value="Fully Cleared">Fully Cleared</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Outstanding">Outstanding</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Search Student / Guardian</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Name or admission no…"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Printable Student Directory Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none">
              <SchoolLetterhead
                brand={studentPrintBrand}
                title="OFFICIAL WHOLE-SCHOOL STUDENT ENROLLMENT REGISTER"
                subtitle={`Total Records: ${filteredStudents.length} Students • Filter: ${
                  studentSectionFilter === "all"
                    ? "Full School Registry"
                    : studentSectionFilter === "PRIMARY"
                    ? "Royal Crown Academy"
                    : "Royal Crown High School"
                } • Class: ${studentClassFilter === "all" ? "All Arms" : studentClassFilter}`}
                showSignatoryFooter={true}
              >
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-800 bg-slate-50 text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Admission No</th>
                        <th className="py-2.5 px-3">Full Name</th>
                        <th className="py-2.5 px-3">Class Arm</th>
                        <th className="py-2.5 px-3">Gender</th>
                        <th className="py-2.5 px-3">House</th>
                        <th className="py-2.5 px-3">Guardian Name</th>
                        <th className="py-2.5 px-3">Guardian Phone</th>
                        <th className="py-2.5 px-3 text-right">Fee Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                            No student records found matching the active filters.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-900">{s.admissionNo}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{s.fullName}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{s.className}</td>
                            <td className="py-2 px-3 text-slate-600">{s.gender}</td>
                            <td className="py-2 px-3 text-slate-600">{s.house}</td>
                            <td className="py-2 px-3 text-slate-700">{s.guardianName || "—"}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{s.guardianPhone || "—"}</td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  s.feeStatus === "Fully Cleared"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : s.feeStatus === "Partially Paid"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {s.feeStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SchoolLetterhead>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: WHOLE-SCHOOL STAFF DIRECTORY PRINTING */}
        {/* ========================================================================= */}
        {activeTab === "print-staff" && (
          <div className="space-y-6">
            {/* Filter and Control Bar (Hidden on Print) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Staff &amp; Faculty Register Print Controls
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filter staff by department, role, or section before generating print copies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-xs cursor-pointer self-start"
                >
                  <Printer className="w-4 h-4" />
                  Print Staff Directory
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">School Section</label>
                  <select
                    value={staffSectionFilter}
                    onChange={(e) => setStaffSectionFilter(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="all">All Faculty (Unified Group)</option>
                    <option value="PRIMARY">Royal Crown Academy (Primary)</option>
                    <option value="SECONDARY">Royal Crown High School (Secondary)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role Tier</label>
                  <select
                    value={staffRoleFilter}
                    onChange={(e) => setStaffRoleFilter(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="all">All Roles</option>
                    <option value="TEACHER">Teacher</option>
                    <option value="EXAM_OFFICER">Exam Officer</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={staffStatusFilter}
                    onChange={(e) => setStaffStatusFilter(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Search Faculty</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Name, ID or designation…"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Printable Staff Directory Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none">
              <SchoolLetterhead
                brand={staffPrintBrand}
                title="OFFICIAL WHOLE-SCHOOL FACULTY &amp; STAFF REGISTER"
                subtitle={`Total Records: ${filteredStaff.length} Faculty Members • Filter: ${
                  staffSectionFilter === "all"
                    ? "Full School Registry"
                    : staffSectionFilter === "PRIMARY"
                    ? "Royal Crown Academy"
                    : "Royal Crown High School"
                } • Role: ${staffRoleFilter === "all" ? "All Roles" : staffRoleFilter}`}
                showSignatoryFooter={true}
              >
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-800 bg-slate-50 text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Staff ID</th>
                        <th className="py-2.5 px-3">Full Name</th>
                        <th className="py-2.5 px-3">Designation</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Assigned Class</th>
                        <th className="py-2.5 px-3">Form Master</th>
                        <th className="py-2.5 px-3">Contact Phone</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                            No faculty records found matching the active filters.
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-900">{st.staffId}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{st.fullName}</td>
                            <td className="py-2 px-3 font-semibold text-slate-700">{st.designation || "Not Stated"}</td>
                            <td className="py-2 px-3 text-slate-600 font-medium">{st.role}</td>
                            <td className="py-2 px-3 text-slate-800">{st.assignedClass || "Cross-Department"}</td>
                            <td className="py-2 px-3">
                              {st.isFormMaster ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                  Form Master
                                </span>
                              ) : (
                                <span className="text-slate-400">No</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{st.phone || "—"}</td>
                            <td className="py-2 px-3 text-right">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  (st.status || "Active") === "Active"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : (st.status || "Active") === "On Leave"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {st.status || "Active"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SchoolLetterhead>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
