"use client";

import React, { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useSchoolConfig } from "@/lib/school-config";
import { useRealtimeAuth, useRealtimeStudents, useRealtimeClasses, StudentRecord } from "@/lib/realtime-store";
import { SchoolLetterhead, SchoolBrandContext } from "@/components/ui/school-letterhead";
import {
  Printer,
  GraduationCap,
  Search,
  Filter,
  ShieldAlert,
  Building2,
  Users,
} from "lucide-react";

export default function SetupStudentsPage() {
  const { currentUser } = useRealtimeAuth();
  const { students } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const { config } = useSchoolConfig();

  // Filters
  const [sectionFilter, setSectionFilter] = useState<"all" | "PRIMARY" | "SECONDARY">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  // Dynamic Letterhead Brand Context based on section filter
  const resolvedBrand: SchoolBrandContext = useMemo(() => {
    if (sectionFilter === "PRIMARY") return "PRIMARY";
    if (sectionFilter === "SECONDARY") return "SECONDARY";
    return "GROUP";
  }, [sectionFilter]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s: StudentRecord) => {
      // Determine if student belongs to Primary or Secondary
      const isSec =
        s.section === "SECONDARY" ||
        /^(JSS|SSS|High School|Grade [7-9]|Grade 1[0-2])/i.test(s.className || "");

      // Section filter
      if (sectionFilter === "PRIMARY" && isSec) return false;
      if (sectionFilter === "SECONDARY" && !isSec) return false;

      // Class / Arm filter
      if (classFilter !== "all" && s.className !== classFilter) return false;

      // Gender filter
      if (genderFilter !== "all" && s.gender?.toLowerCase() !== genderFilter.toLowerCase()) return false;

      // Status filter
      const studentStatus = s.status || "Active";
      if (statusFilter !== "all" && studentStatus.toLowerCase() !== statusFilter.toLowerCase()) return false;

      // Search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(query);
        const matchAdm = s.admissionNo.toLowerCase().includes(query);
        const matchGuardian = s.guardianName?.toLowerCase().includes(query) ?? false;
        const matchPhone = s.guardianPhone?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchAdm && !matchGuardian && !matchPhone) return false;
      }

      return true;
    });
  }, [students, sectionFilter, classFilter, genderFilter, statusFilter, search]);

  const primaryCount = students.filter(
    (s) => !s.section?.includes("SEC") && !/^(JSS|SSS)/i.test(s.className || "")
  ).length;
  const secondaryCount = students.filter(
    (s) => s.section === "SECONDARY" || /^(JSS|SSS)/i.test(s.className || "")
  ).length;
  const activeCount = students.filter((s) => (s.status || "Active") === "Active").length;

  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (!isSuperAdmin) {
    return (
      <DashboardShell>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-12">
          <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Administrator Access Restricted</h2>
          <p className="text-xs text-slate-600 mt-2">
            The Master Student Register and Comprehensive Print View under Setup is restricted exclusively to
            Authorized Super Administrators. Please contact the Head of School.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs print:hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                Comprehensive Student Register &amp; Enrolment Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official institution-wide student master records, parent emergency contacts, and dynamic school letterhead export.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Comprehensive Student List</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Matching</span>
              <span className="text-lg font-extrabold text-slate-900">{filteredStudents.length}</span>
              <span className="text-[10px] text-slate-400 block">of {students.length} enrolled pupils</span>
            </div>
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Royal Crown Academy</span>
              <span className="text-lg font-extrabold text-blue-900">{primaryCount}</span>
              <span className="text-[10px] text-blue-600/80 block">Primary &amp; Nursery pupils</span>
            </div>
            <div className="bg-red-50/60 border border-red-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-red-700 uppercase block">Royal Crown High</span>
              <span className="text-lg font-extrabold text-red-900">{secondaryCount}</span>
              <span className="text-[10px] text-red-600/80 block">Secondary students</span>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Active Status</span>
              <span className="text-lg font-extrabold text-emerald-900">{activeCount}</span>
              <span className="text-[10px] text-emerald-600/80 block">Active enrolments</span>
            </div>
          </div>

          {/* Filter Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                School Section
              </label>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value as "all" | "PRIMARY" | "SECONDARY")}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Sections (Unified Group)</option>
                <option value="PRIMARY">Royal Crown Academy (Primary)</option>
                <option value="SECONDARY">Royal Crown High School (Secondary)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Class / Arm
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Classes &amp; Arms</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} — {c.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Gender
              </label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive</option>
                <option value="transferred">Transferred</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                Search Pupils
              </label>
              <input
                type="text"
                placeholder="Pupil name, admission no, guardian..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-blue-600 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Print Stylesheet Hook */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body {
                background: white !important;
                color: black !important;
                font-size: 10pt;
              }
              @page {
                size: A4 landscape;
                margin: 10mm 8mm;
              }
              .print\\:hidden {
                display: none !important;
              }
              .print-container {
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              thead {
                display: table-header-group !important;
              }
              tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `
        }} />

        {/* Printable Official Document Container */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs print:p-0 print:border-none print:shadow-none print-container">
          <SchoolLetterhead
            brand={resolvedBrand}
            title={
              sectionFilter === "PRIMARY"
                ? "ROYAL CROWN ACADEMY • COMPREHENSIVE PUPIL REGISTER"
                : sectionFilter === "SECONDARY"
                ? "ROYAL CROWN HIGH SCHOOL • COMPREHENSIVE STUDENT REGISTER"
                : "COMPREHENSIVE STUDENT REGISTER &amp; ENROLMENT DIRECTORY"
            }
            subtitle={`Total Enrolled: ${filteredStudents.length} Students • Scope: ${
              sectionFilter === "PRIMARY"
                ? "Royal Crown Academy (Primary & Nursery)"
                : sectionFilter === "SECONDARY"
                ? "Royal Crown High School (Junior & Senior Secondary)"
                : "Institutional Unified Register"
            } • Class Filter: ${classFilter === "all" ? "All Classes & Arms" : classFilter} • Session: ${
              config?.current_session || "Current Academic Session"
            } • Printed: ${currentDate}`}
            showSignatoryFooter={true}
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-800 bg-slate-50 text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                    <th className="py-2.5 px-2 text-center w-8">#</th>
                    <th className="py-2.5 px-3">Admission No</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-2">Gender</th>
                    <th className="py-2.5 px-3">Date of Birth</th>
                    <th className="py-2.5 px-3">Class / Arm</th>
                    <th className="py-2.5 px-3">Guardian Details</th>
                    <th className="py-2.5 px-2 text-center">Blood</th>
                    <th className="py-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                        No student enrolment records found matching the active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                        <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">{s.admissionNo}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {s.fullName}
                        </td>
                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{s.gender || "—"}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {s.dateOfBirth || "—"}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {s.className || "Unassigned"}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          <div className="font-semibold text-slate-900">{s.guardianName || "Not Recorded"}</div>
                          {s.guardianPhone && (
                            <div className="text-[11px] font-mono text-slate-500">{s.guardianPhone}</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-slate-700">
                          {s.bloodGroup || "—"}
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              ((s.status || "Active") as string).toLowerCase() === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : ((s.status || "Active") as string).toLowerCase() === "transferred"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {s.status || "Active"}
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
    </DashboardShell>
  );
}
