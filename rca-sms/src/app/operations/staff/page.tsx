"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO, ROLES } from "@/lib/constants";
import {
  useRealtimeStaff,
  StaffRecord,
  StaffPermissions,
  useRealtimeClasses,
} from "@/lib/realtime-store";
import { exportToCSV, parseCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import {
  Users,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Mail,
  Phone,
  ShieldCheck,
  Send,
  ArrowLeft,
  Filter,
  Download,
  Upload,
  FileSpreadsheet,
  FileDown,
  AlertCircle,
  KeyRound,
  Sliders,
  Copy,
  Check,
  Printer,
  Lock,
} from "lucide-react";

const DEFAULT_TEACHER_PERMISSIONS: StaffPermissions = {
  canCreateStudents: false,
  canEditStudents: false,
  canDeleteStudents: false,
  canEnterScores: true,
  canEditScores: false,
  canPublishResults: false,
  canEditFees: false,
  canManageCurriculum: false,
  canEditAttendance: true,
  canApprovePromotions: false,
};

const DEFAULT_EXAM_OFFICER_PERMISSIONS: StaffPermissions = {
  canCreateStudents: true,
  canEditStudents: true,
  canDeleteStudents: false,
  canEnterScores: true,
  canEditScores: true,
  canPublishResults: true,
  canEditFees: false,
  canManageCurriculum: true,
  canEditAttendance: true,
  canApprovePromotions: true,
};

const DEFAULT_SUPER_ADMIN_PERMISSIONS: StaffPermissions = {
  canCreateStudents: true,
  canEditStudents: true,
  canDeleteStudents: true,
  canEnterScores: true,
  canEditScores: true,
  canPublishResults: true,
  canEditFees: true,
  canManageCurriculum: true,
  canEditAttendance: true,
  canApprovePromotions: true,
};

const DEFAULT_ACCOUNTANT_PERMISSIONS: StaffPermissions = {
  canCreateStudents: false,
  canEditStudents: false,
  canDeleteStudents: false,
  canEnterScores: false,
  canEditScores: false,
  canPublishResults: false,
  canEditFees: true,
  canManageCurriculum: false,
  canEditAttendance: false,
  canApprovePromotions: false,
};

export default function StaffManagementPage() {
  const { staff, addStaff, bulkAddStaff, deleteStaff, updateStaff } = useRealtimeStaff();
  const { classes } = useRealtimeClasses();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Single Staff Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRecord["role"]>("TEACHER");
  const [assignedSubject, setAssignedSubject] = useState("General Mathematics");
  const [assignedClass, setAssignedClass] = useState("Primary 1");
  const [isFormMaster, setIsFormMaster] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Granular Permissions State
  const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_TEACHER_PERMISSIONS);

  // Permissions Edit Modal
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);

  // CSV Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Out-of-band Credential Distribution Slip
  const [credentialSlip, setCredentialSlip] = useState<{
    fullName: string;
    staffId: string;
    username: string;
    tempPasscode: string;
    role: string;
    email: string;
  } | null>(null);
  const [copiedSlip, setCopiedSlip] = useState(false);

  const handleRoleChange = (newRole: StaffRecord["role"]) => {
    setRole(newRole);
    if (newRole === "SUPER_ADMIN") setPermissions(DEFAULT_SUPER_ADMIN_PERMISSIONS);
    else if (newRole === "EXAM_OFFICER") setPermissions(DEFAULT_EXAM_OFFICER_PERMISSIONS);
    else if (newRole === "ACCOUNTANT") setPermissions(DEFAULT_ACCOUNTANT_PERMISSIONS);
    else setPermissions(DEFAULT_TEACHER_PERMISSIONS);
  };

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const names = fullName.trim().toLowerCase().split(" ");
    const username = names.length > 1 ? `${names[0]}_${names[1]}` : names[0];
    const email = `${username}@royalcrownacademy.edu.ng`;
    const nextSeq = (staff.length + 1).toString().padStart(3, "0");
    const staffId = `RCA/PERS/${nextSeq}`;
    const tempPasscode = `Rca@${Math.floor(1000 + Math.random() * 9000)}`;

    addStaff({
      staffId,
      fullName: fullName.trim(),
      username,
      email,
      phone: phone || "08030000000",
      role,
      assignedSubjects: [assignedSubject],
      assignedClass: assignedClass || "Primary 1",
      isFormMaster,
      emailVerified: true,
      status: "Active",
      permissions,
    });

    setCredentialSlip({
      fullName: fullName.trim(),
      staffId,
      username,
      tempPasscode,
      role,
      email,
    });

    setNotificationMsg(`Staff ${fullName} registered with ID: ${staffId}`);
    setTimeout(() => setNotificationMsg(null), 4000);

    setIsModalOpen(false);
    setFullName("");
    setPhone("");
    setIsFormMaster(false);
    setPermissions(DEFAULT_TEACHER_PERMISSIONS);
  };

  // Handle CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsedRows = parseCSV(text);

      if (parsedRows.length < 2) {
        setUploadStatus("Error: CSV must contain at least a header row and 1 data row.");
        return;
      }

      const dataRows = parsedRows.slice(1);
      let currentSeq = staff.length;

      const staffObjects = dataRows.map((cols) => {
        currentSeq++;
        const name = cols[0] || "Staff Member";
        const cleanNames = name.trim().toLowerCase().split(" ");
        const username = cleanNames.length > 1 ? `${cleanNames[0]}_${cleanNames[1]}` : cleanNames[0];
        const email = cols[1] || `${username}@royalcrownacademy.edu.ng`;
        const phone = cols[2] || "08030000000";
        const role = (cols[3]?.toUpperCase().includes("EXAM")
          ? "EXAM_OFFICER"
          : cols[3]?.toUpperCase().includes("ADMIN")
          ? "SUPER_ADMIN"
          : cols[3]?.toUpperCase().includes("ACCOUNT")
          ? "ACCOUNTANT"
          : "TEACHER") as StaffRecord["role"];
        const assignedSubjects = cols[4] ? [cols[4]] : ["General Subjects"];
        const assignedClass = cols[5] || "Primary 1";
        const isFormMaster =
          cols[6]?.toLowerCase().includes("yes") || cols[6]?.toLowerCase().includes("true") || false;

        let staffPerms = DEFAULT_TEACHER_PERMISSIONS;
        if (role === "SUPER_ADMIN") staffPerms = DEFAULT_SUPER_ADMIN_PERMISSIONS;
        else if (role === "EXAM_OFFICER") staffPerms = DEFAULT_EXAM_OFFICER_PERMISSIONS;
        else if (role === "ACCOUNTANT") staffPerms = DEFAULT_ACCOUNTANT_PERMISSIONS;

        return {
          staffId: `RCA/PERS/${currentSeq.toString().padStart(3, "0")}`,
          fullName: name,
          username,
          email,
          phone,
          role,
          assignedSubjects,
          assignedClass,
          isFormMaster,
          emailVerified: true,
          status: "Active" as const,
          permissions: staffPerms,
        };
      });

      setCsvPreview(staffObjects);
      setUploadStatus(`Parsed ${staffObjects.length} staff records ready to onboard.`);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvUpload = () => {
    if (csvPreview.length === 0) return;
    const count = bulkAddStaff(csvPreview);
    setUploadStatus(`Successfully onboarded ${count} staff members in bulk!`);
    setTimeout(() => {
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      setUploadStatus(null);
    }, 1500);
  };

  // Export Staff Directory to CSV
  const handleExportCSV = () => {
    const headers = [
      "Staff ID",
      "Full Legal Name",
      "Username",
      "Institutional Email",
      "Phone Number",
      "Role Tier",
      "Assigned Subjects",
      "Form Class",
      "Form Master?",
      "Can Edit Scores",
      "Can Edit Fees",
      "Employment Status",
    ];

    const rows = filtered.map((s) => [
      s.staffId,
      s.fullName,
      s.username,
      s.email,
      s.phone,
      s.role,
      s.assignedSubjects.join("; "),
      s.assignedClass,
      s.isFormMaster ? "Yes" : "No",
      s.permissions?.canEditScores ? "Yes" : "No",
      s.permissions?.canEditFees ? "Yes" : "No",
      s.status,
    ]);

    exportToCSV("RCA_Staff_Directory", headers, rows);
  };

  const filtered = staff.filter((s) => {
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.staffId.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.assignedSubjects.some((sub) => sub.toLowerCase().includes(search.toLowerCase()));
    return matchesRole && matchesSearch;
  });

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
              <span className="text-slate-800 font-semibold">Staff Management</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Staff Directory &amp; Permissions
              </h1>
              <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                {staff.length} Active Staff
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage faculty, form masters, and granular CRUD &amp; edit permissions across all tiers for {SCHOOL_INFO.name}.
            </p>
          </div>

          {/* Action Buttons: Template, Export, CSV Upload, Register */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => downloadSampleTemplate("staff")}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download empty CSV template for staff onboarding"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              CSV Template
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download entire staff table to CSV"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Export CSV
            </button>

            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Bulk Upload CSV
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register Staff
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notificationMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            {notificationMsg}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Role Filter
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Roles</option>
              <option value="SUPER_ADMIN">Tier 1: Super Admin</option>
              <option value="EXAM_OFFICER">Tier 2: Exam Officer</option>
              <option value="TEACHER">Tier 3: Teacher</option>
              <option value="ACCOUNTANT">Bursary Accountant</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Search Staff Directory
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search staff name, Staff ID (RCA/PERS/XXX), or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-800">Faculty &amp; Administrative Roster</h3>
            </div>
            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">
              {filtered.length} Staff Listed
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Users className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <div className="text-sm font-semibold text-slate-600">No Staff Members Registered</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active staff accounts in directory. Click &apos;Register Staff&apos; or &apos;Bulk Upload CSV&apos; to onboard teachers and administrators.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4">Staff ID</th>
                    <th className="py-3 px-4">Staff Name &amp; Email</th>
                    <th className="py-3 px-3">Role Tier</th>
                    <th className="py-3 px-4">Assigned Subjects</th>
                    <th className="py-3 px-3">Form Class</th>
                    <th className="py-3 px-3">CRUD &amp; Edit Permissions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => {
                    const perms = s.permissions || DEFAULT_TEACHER_PERMISSIONS;
                    return (
                      <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-900">{s.staffId}</td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 leading-tight">{s.fullName}</p>
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {s.email}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                              s.role === "SUPER_ADMIN"
                                ? "bg-purple-100 text-purple-800 border-purple-300"
                                : s.role === "EXAM_OFFICER"
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : s.role === "ACCOUNTANT"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {s.assignedSubjects.map((sub, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">{s.assignedClass}</span>
                          {s.isFormMaster && (
                            <span className="block text-[9px] font-bold text-purple-700">Form Master</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {perms.canEditScores && (
                              <span className="text-[9px] bg-blue-50 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-100">
                                Edit Scores
                              </span>
                            )}
                            {perms.canPublishResults && (
                              <span className="text-[9px] bg-purple-50 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-100">
                                Publish
                              </span>
                            )}
                            {perms.canEditFees && (
                              <span className="text-[9px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-100">
                                Edit Fees
                              </span>
                            )}
                            {perms.canEditStudents && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-100">
                                Edit Students
                              </span>
                            )}
                            {!perms.canEditScores && !perms.canPublishResults && !perms.canEditFees && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded">
                                Standard Entry
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                const tempPasscode = `Rca@${Math.floor(1000 + Math.random() * 9000)}`;
                                setCredentialSlip({
                                  fullName: s.fullName,
                                  staffId: s.staffId,
                                  username: s.username,
                                  tempPasscode,
                                  role: s.role,
                                  email: s.email,
                                });
                              }}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#0000FF] text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer border border-blue-200 shadow-2xs"
                              title="Issue Private Access Slip"
                            >
                              <KeyRound className="w-3 h-3 text-[#0000FF]" />
                              Access Slip
                            </button>
                            <button
                              onClick={() => setEditingStaff(s)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                              title="Edit Granular Permissions"
                            >
                              <KeyRound className="w-3 h-3 text-slate-600" />
                              Permissions
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${s.fullName} from staff directory?`)) {
                                  deleteStaff(s.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete Staff"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Edit Existing Staff Permissions */}
        {editingStaff && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Granular Permissions: {editingStaff.fullName}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingStaff(null)}
                  className="text-slate-400 font-bold cursor-pointer hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-500">
                  Staff ID: <strong className="text-slate-800">{editingStaff.staffId}</strong> • Role:{" "}
                  <strong className="text-blue-700">{editingStaff.role}</strong>
                </p>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {[
                    { key: "canEnterScores", label: "Enter CA Scores" },
                    { key: "canEditScores", label: "Edit / Override Scores" },
                    { key: "canPublishResults", label: "Publish / Lock Results" },
                    { key: "canCreateStudents", label: "Create / Onboard Students" },
                    { key: "canEditStudents", label: "Edit Student Records" },
                    { key: "canDeleteStudents", label: "Delete Students" },
                    { key: "canEditFees", label: "Manage Fees & Invoices" },
                    { key: "canManageCurriculum", label: "Manage Curriculum" },
                    { key: "canEditAttendance", label: "Mark Attendance" },
                    { key: "canApprovePromotions", label: "Approve Promotions" },
                  ].map((item) => {
                    const staffPerms = editingStaff.permissions || DEFAULT_TEACHER_PERMISSIONS;
                    const isChecked = Boolean(staffPerms[item.key as keyof StaffPermissions]);
                    return (
                      <label key={item.key} className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updatedPerms = {
                              ...staffPerms,
                              [item.key]: e.target.checked,
                            };
                            updateStaff(editingStaff.id, { permissions: updatedPerms });
                            setEditingStaff({ ...editingStaff, permissions: updatedPerms });
                          }}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300"
                        />
                        <span className="font-semibold text-slate-700">{item.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setNotificationMsg(`Permissions updated for ${editingStaff.fullName}`);
                      setTimeout(() => setNotificationMsg(null), 3000);
                      setEditingStaff(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Single Staff Registration */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-xl w-full border shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Staff Registration &amp; Granular Permissions
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 font-bold cursor-pointer hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRegisterStaff} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mrs. Sarah K. Danjuma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Role Assignment</label>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      <option value="TEACHER">Tier 3: Teacher</option>
                      <option value="EXAM_OFFICER">Tier 2: Exam Officer</option>
                      <option value="SUPER_ADMIN">Tier 1: Super Admin</option>
                      <option value="ACCOUNTANT">Bursar / Accountant</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="080XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Primary Teaching Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mathematics, Early Phonics"
                      value={assignedSubject}
                      onChange={(e) => setAssignedSubject(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Form Class</label>
                    <select
                      value={assignedClass}
                      onChange={(e) => setAssignedClass(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.section})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="formMaster"
                    checked={isFormMaster}
                    onChange={(e) => setIsFormMaster(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="formMaster" className="font-semibold text-slate-700 cursor-pointer">
                    Appoint as Form Master for this class arm
                  </label>
                </div>

                {/* Granular CRUD & Edit Permissions */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      Granular CRUD &amp; Edit Permissions
                    </span>
                    <span className="text-[10px] text-blue-700 font-semibold">Configurable Toggles</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canEnterScores}
                        onChange={(e) => setPermissions({ ...permissions, canEnterScores: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Enter CA Scores</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canEditScores}
                        onChange={(e) => setPermissions({ ...permissions, canEditScores: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-blue-900">Edit / Override Scores</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canPublishResults}
                        onChange={(e) => setPermissions({ ...permissions, canPublishResults: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-purple-900">Publish All Results</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canEditStudents}
                        onChange={(e) => setPermissions({ ...permissions, canEditStudents: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-emerald-900">Edit Student Bio</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canCreateStudents}
                        onChange={(e) => setPermissions({ ...permissions, canCreateStudents: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Create Students</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canEditFees}
                        onChange={(e) => setPermissions({ ...permissions, canEditFees: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-amber-900">Edit / Collect Fees</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canEditAttendance}
                        onChange={(e) => setPermissions({ ...permissions, canEditAttendance: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Mark Attendance</span>
                    </label>

                    <label className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.canApprovePromotions}
                        onChange={(e) => setPermissions({ ...permissions, canApprovePromotions: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Approve Promotions</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Register &amp; Grant Permissions
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Bulk CSV Upload */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full border shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">Bulk Staff Onboarding via CSV</h3>
                </div>
                <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Supported Columns in Staff CSV:</p>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Full Legal Name</code>,{" "}
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Email Address</code>,{" "}
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Phone</code>,{" "}
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Role (TEACHER, EXAM_OFFICER, SUPER_ADMIN)</code>,{" "}
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Subject</code>,{" "}
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Form Class</code>,{" "}
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Is Form Master (Yes/No)</code>.
                    </p>
                  </div>
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center space-y-2 bg-slate-50 transition-colors">
                  <Upload className="w-8 h-8 text-indigo-600 mx-auto" />
                  <p className="font-bold text-slate-700">Choose a CSV file to upload</p>
                  <p className="text-slate-500 text-[11px]">Select your faculty roster .csv spreadsheet file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block mx-auto text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>

                {uploadStatus && (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-800">
                    {uploadStatus}
                  </div>
                )}

                {csvPreview.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3">Subject</th>
                          <th className="py-2 px-3">Class</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvPreview.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 font-semibold">{row.fullName}</td>
                            <td className="py-1.5 px-3">{row.role}</td>
                            <td className="py-1.5 px-3">{row.assignedSubjects.join(", ")}</td>
                            <td className="py-1.5 px-3">{row.assignedClass}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate("staff")}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Sample CSV Template
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCsvModalOpen(false)}
                      className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={csvPreview.length === 0}
                      onClick={handleConfirmCsvUpload}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
                    >
                      Onboard {csvPreview.length} Staff Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Out-of-Band Credential Distribution Slip */}
        {credentialSlip && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-[#0000FF]/30 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0000FF] flex items-center justify-center text-white font-black shadow-md">
                    <Lock className="w-5 h-5 text-[#00FFFF]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#0000FF]">
                      Private Access Slip
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Out-of-Band Credential Dispatch
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCredentialSlip(null)}
                  className="text-slate-400 font-bold cursor-pointer hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Security Warning Notice */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-[#FF0000] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-[#FF0000] uppercase tracking-wide">
                    Confidential &amp; Secure Isolation:
                  </span>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    These initial credentials are <strong>never</strong> displayed on the public login page. Transmit this private slip directly to the staff member via official SMS, WhatsApp, or printed memo.
                  </p>
                </div>
              </div>

              {/* Staff Details & Credentials Card */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-[#0000FF]/20 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Staff Member</span>
                    <span className="font-extrabold text-slate-900">{credentialSlip.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Staff ID</span>
                    <span className="font-mono font-bold text-[#0000FF]">{credentialSlip.staffId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Role</span>
                    <span className="font-bold text-purple-800">{credentialSlip.role}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Official Email</span>
                    <span className="font-mono text-slate-600 text-[11px] truncate block">{credentialSlip.email}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="bg-slate-900 text-white rounded-lg p-3 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wider">Username:</span>
                      <span className="font-bold text-[#00FFFF] text-sm">{credentialSlip.username}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase tracking-wider">Temporary Passcode:</span>
                      <span className="font-bold text-amber-300 text-sm">{credentialSlip.tempPasscode}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>Portal URL:</span>
                      <span className="text-slate-200 underline">https://sms.royalcrownacademy.edu.ng/login</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Copy Slip, Print, Dismiss */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const slipText = `*ROYAL CROWN ACADEMY - STAFF ACCESS MEMO*\n\nDear ${credentialSlip.fullName},\nYour staff account has been provisioned.\n\n*Staff ID:* ${credentialSlip.staffId}\n*Role:* ${credentialSlip.role}\n*Portal URL:* https://sms.royalcrownacademy.edu.ng/login\n*Username:* ${credentialSlip.username}\n*Temporary Passcode:* ${credentialSlip.tempPasscode}\n\n_Please log in and update your passcode immediately. Do not share these credentials._`;
                    navigator.clipboard.writeText(slipText);
                    setCopiedSlip(true);
                    setTimeout(() => setCopiedSlip(false), 3000);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#0000FF] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  {copiedSlip ? (
                    <>
                      <Check className="w-4 h-4 text-[#00FFFF]" />
                      Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy WhatsApp / SMS Text
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    Print Memo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCredentialSlip(null)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

