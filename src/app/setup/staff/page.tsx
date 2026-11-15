"use client";

import React, { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useSchoolConfig } from "@/lib/school-config";
import { useRealtimeAuth, useRealtimeStaff, useRealtimeClasses, StaffRecord } from "@/lib/realtime-store";
import { SchoolLetterhead } from "@/components/ui/school-letterhead";
import {
  Printer,
  Users,
  Search,
  Filter,
  Briefcase,
  GraduationCap,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

export default function SetupStaffPage() {
  const { currentUser } = useRealtimeAuth();
  const { staff } = useRealtimeStaff();
  const { classes } = useRealtimeClasses();
  const { config } = useSchoolConfig();

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staff.filter((s: StaffRecord) => {
      // Category filter (Teaching vs Non-Teaching)
      if (categoryFilter === "teaching" && s.staffType === "Non-Teaching") return false;
      if (categoryFilter === "non-teaching" && s.staffType !== "Non-Teaching") return false;

      // Role filter
      if (roleFilter !== "all" && s.role !== roleFilter) return false;

      // Status filter
      if (statusFilter !== "all" && (s.status || "Active").toLowerCase() !== statusFilter.toLowerCase()) return false;

      // Search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(query);
        const matchId = s.staffId.toLowerCase().includes(query);
        const matchEmail = s.email?.toLowerCase().includes(query) ?? false;
        const matchPhone = s.phone?.toLowerCase().includes(query) ?? false;
        const matchDesig = s.designation?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchId && !matchEmail && !matchPhone && !matchDesig) return false;
      }

      return true;
    });
  }, [staff, categoryFilter, roleFilter, statusFilter, search]);

  const teachingCount = staff.filter((s) => s.staffType !== "Non-Teaching").length;
  const nonTeachingCount = staff.filter((s) => s.staffType === "Non-Teaching").length;
  const formMastersCount = staff.filter((s) => s.isFormMaster).length;
  const activeCount = staff.filter((s) => (s.status || "Active") === "Active").length;

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
            The Master Faculty Directory and Comprehensive Print View under Setup is restricted exclusively to
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
                <Users className="w-5 h-5 text-blue-600" />
                Comprehensive Faculty & Staff Register
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official institution-wide faculty register with full employment attributes and dynamic signatories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Comprehensive Staff List</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Matching</span>
              <span className="text-lg font-extrabold text-slate-900">{filteredStaff.length}</span>
              <span className="text-[10px] text-slate-400 block">of {staff.length} in institution</span>
            </div>
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Academic Faculty</span>
              <span className="text-lg font-extrabold text-blue-900">{teachingCount}</span>
              <span className="text-[10px] text-blue-600/80 block">Teaching personnel</span>
            </div>
            <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-purple-700 uppercase block">Non-Teaching</span>
              <span className="text-lg font-extrabold text-purple-900">{nonTeachingCount}</span>
              <span className="text-[10px] text-purple-600/80 block">Support staff</span>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Active Status</span>
              <span className="text-lg font-extrabold text-emerald-900">{activeCount}</span>
              <span className="text-[10px] text-emerald-600/80 block">{formMastersCount} Form Masters</span>
            </div>
          </div>

          {/* Filter Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Staff Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Categories (Unified)</option>
                <option value="teaching">Teaching Faculty Only</option>
                <option value="non-teaching">Non-Teaching / Support Staff</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Portal Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Roles</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Executive)</option>
                <option value="EXAM_OFFICER">EXAM_OFFICER</option>
                <option value="TEACHER">TEACHER</option>
                <option value="ACCOUNTANT">ACCOUNTANT / BURSAR</option>
                <option value="TESTERS">TESTERS</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                Active Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-blue-600 focus:bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="on leave">On Leave</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                Search Directory
              </label>
              <input
                type="text"
                placeholder="Name, staff ID, phone, email..."
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
            brand="GROUP"
            title="COMPREHENSIVE STAFF DIRECTORY &amp; FACULTY REGISTER"
            subtitle={`Total Registered: ${filteredStaff.length} Faculty & Staff Members • Category: ${
              categoryFilter === "teaching" ? "Teaching Faculty" : categoryFilter === "non-teaching" ? "Non-Teaching Personnel" : "Institutional Master Roster"
            } • Session: ${config?.current_session || "Current Academic Session"} • Printed: ${currentDate}`}
            showSignatoryFooter={true}
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-800 bg-slate-50 text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                    <th className="py-2.5 px-2 text-center w-8">#</th>
                    <th className="py-2.5 px-3">Staff ID</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-2">Gender</th>
                    <th className="py-2.5 px-3">Phone / Email</th>
                    <th className="py-2.5 px-2">Category</th>
                    <th className="py-2.5 px-3">Designation / Role</th>
                    <th className="py-2.5 px-3">Assigned Class</th>
                    <th className="py-2.5 px-3">Qualifications</th>
                    <th className="py-2.5 px-2">Employed</th>
                    <th className="py-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 font-medium">
                        No faculty records found matching the active filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((s, idx) => {
                      const formClass = classes.find(
                        (c) => (s.staffId && c.formTeacherId === s.staffId) || (c.formTeacher && c.formTeacher === s.fullName)
                      );
                      const displayClass = s.assignedClass || formClass?.name || "—";
                      const isFormTeacher = Boolean(s.isFormMaster || formClass);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                          <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">{s.staffId}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {s.fullName}
                            {isFormTeacher && (
                              <span className="ml-1.5 inline-block text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                Form Master
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{s.gender || "—"}</td>
                          <td className="py-2 px-3 text-slate-700">
                            <div className="font-mono text-[11px]">{s.phone || "—"}</div>
                            {s.email && <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{s.email}</div>}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                s.staffType === "Non-Teaching"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {s.staffType || "Teaching"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-800">
                            <div className="font-semibold">{s.designation || "Faculty Member"}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{s.role}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-800 whitespace-nowrap">
                            {displayClass}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">
                            {s.qualifications || "B.Ed / B.Sc"}
                          </td>
                          <td className="py-2 px-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {s.employmentDate || "—"}
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                (s.status || "Active").toLowerCase() === "active"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : (s.status || "Active").toLowerCase() === "on leave"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {s.status || "Active"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
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
