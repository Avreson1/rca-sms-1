"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import {
  useRealtimeStaff,
  StaffRecord,
  StaffPermissions,
  useRealtimeClasses,
} from "@/lib/realtime-store";
import { exportToCSV, parseCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import type { BulkStaffResult } from "@/lib/supabase/db";
import {
  Users,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Mail,
  ShieldCheck,
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  FileDown,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  Printer,
  Lock,
  CreditCard,
  FileText,
  X,
  Pencil,
  Loader2,
} from "lucide-react";
import { SchoolLetterhead } from "@/components/ui/school-letterhead";
import { RowActionsDropdown } from "@/components/ui/row-actions-dropdown";

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

/**
 * Comma-separated text into the duty names the register holds.
 *
 * Duplicate spellings are collapsed and blanks dropped, so "Gate Duty, gate duty,"
 * cannot become two standing duties on one person — the roster offers these as
 * suggestions, and a list of near-duplicates is how two gates get manned.
 */
function splitDutyList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().slice(0, 120))
        .filter((item) => item.length > 1)
    )
  ).slice(0, 12);
}

export default function StaffManagementPage() {
  const { staff, addStaff, bulkAddStaff, deleteStaff, updateStaff } = useRealtimeStaff();
  const { classes, updateClass } = useRealtimeClasses();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedDossierStaff, setSelectedDossierStaff] = useState<StaffRecord | null>(null);

  // Direct Inline Row Editing State
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [inlineStaffForm, setInlineStaffForm] = useState<Partial<StaffRecord>>({});
  const [inlineStaffSaving, setInlineStaffSaving] = useState(false);
  const [inlineStaffError, setInlineStaffError] = useState<string | null>(null);

  // Full Profile Edit Modal State
  const [fullEditStaff, setFullEditStaff] = useState<StaffRecord | null>(null);
  const [fullEditStaffForm, setFullEditStaffForm] = useState<Partial<StaffRecord>>({});
  const [fullEditStaffSaving, setFullEditStaffSaving] = useState(false);
  const [fullEditStaffError, setFullEditStaffError] = useState<string | null>(null);

  // Single Staff Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRecord["role"]>("TEACHER");
  const [assignedSubject, setAssignedSubject] = useState("General Mathematics");
  const [assignedClass, setAssignedClass] = useState("Primary 1");
  const [isFormMaster, setIsFormMaster] = useState(false);
  const [designation, setDesignation] = useState("");
  const [standingDuties, setStandingDuties] = useState("");
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Granular Permissions State
  const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_TEACHER_PERMISSIONS);

  // Permissions Edit Modal
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);

  // CSV Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  // Kept on screen until the office closes it: the passwords in it are the only
  // copy that will ever exist, so a result that faded away would leave a
  // whole staff room with no way to sign in.
  const [bulkResult, setBulkResult] = useState<BulkStaffResult | null>(null);
  const [bulkCopied, setBulkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Out-of-band Credential Distribution Slip
  const [credentialSlip, setCredentialSlip] = useState<{
    fullName: string;
    staffId: string;
    username: string;
    tempPasscode: string;
    role: string;
    email: string;
    action: "created" | "reset";
  } | null>(null);
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [slipBusy, setSlipBusy] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Shown when the staff record saved but the login did not, which is a job the
  // office has to finish; it stays on screen until dismissed, because a toast
  // that fades in four seconds would be forgotten before anyone acted on it.
  const [credentialProblem, setCredentialProblem] = useState<string | null>(null);

  /**
   * Ask the server for a credential that actually signs this person in. The
   * slip used to be filled by a passcode invented here with Math.random(),
   * which was stored nowhere — and for an existing member it printed a second
   * password while their real one still worked.
   */
  const issueAccessSlip = async (member: StaffRecord) => {
    setSlipBusy(member.staffId);
    setCredentialProblem(null);

    try {
      const response = await fetch("/api/accounts/issue", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: member.username }),
      });
      const payload = (await response.json().catch(() => null)) as {
        login?: { username: string; password: string; action: "created" | "reset" };
        error?: string;
      } | null;

      if (!response.ok || !payload?.login) {
        setCredentialSlip(null);
        setCredentialProblem(payload?.error ?? `The portal could not issue a login for ${member.username}.`);
        return;
      }

      setCredentialSlip({
        fullName: member.fullName,
        staffId: member.staffId,
        username: payload.login.username,
        tempPasscode: payload.login.password,
        role: member.role,
        email: member.email,
        action: payload.login.action,
      });
    } catch {
      setCredentialProblem(`The portal server did not answer, so no login was issued for ${member.username}.`);
    } finally {
      setSlipBusy(null);
    }
  };

  /**
   * Takes a member off the school's register. Removal is confirmed by the
   * server, and the login that came with the record is suspended with it — if
   * it could not be, the notice stays on screen until it is dismissed, because
   * an active credential for someone who has left is exactly the thing an
   * office must not lose track of.
   */
  const removeStaff = async (member: StaffRecord) => {
    if (!confirm(`Remove ${member.fullName} (${member.staffId}) from the school's register? Their portal login will be suspended.`)) {
      return;
    }

    setRemovingId(member.staffId);
    setCredentialProblem(null);
    try {
      const outcome = await deleteStaff(member.staffId);
      if (!outcome.ok && outcome.reason) {
        setCredentialProblem(`${member.fullName} is still on the school's register: ${outcome.reason}.`);
      }
      if (outcome.warning) setCredentialProblem(outcome.warning);
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = (newRole: StaffRecord["role"]) => {
    setRole(newRole);
    if (newRole === "SUPER_ADMIN") setPermissions(DEFAULT_SUPER_ADMIN_PERMISSIONS);
    else if (newRole === "EXAM_OFFICER") setPermissions(DEFAULT_EXAM_OFFICER_PERMISSIONS);
    else if (newRole === "ACCOUNTANT") setPermissions(DEFAULT_ACCOUNTANT_PERMISSIONS);
    else setPermissions(DEFAULT_TEACHER_PERMISSIONS);
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const names = fullName.trim().toLowerCase().split(" ");
    const username = names.length > 1 ? `${names[0]}_${names[1]}` : names[0];
    const email = `${username}@royalcrownacademy.edu.ng`;
    const nextSeq = (staff.length + 1).toString().padStart(3, "0");
    const staffId = `RCA/PERS/${nextSeq}`;

    const { login, loginError } = await addStaff({
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
      designation: designation.trim(),
      standingDuties: splitDutyList(standingDuties),
      permissions,
    });

    // The passcode used to be invented here with Math.random(), printed on the
    // memo and handed out — but it was never sent anywhere, so nobody could
    // sign in with it. The slip now opens only on a password the server made.
    if (login) {
      setCredentialSlip({
        fullName: fullName.trim(),
        staffId,
        username: login.username,
        tempPasscode: login.password,
        role,
        email,
        action: "created",
      });
      setNotificationMsg(`Staff ${fullName} registered with ID: ${staffId}`);
      setTimeout(() => setNotificationMsg(null), 4000);
    } else {
      setCredentialProblem(
        `${fullName.trim()} is on the staff register, but no login was created: ${
          loginError ?? "the portal did not say why"
        }`
      );
    }

    setIsModalOpen(false);
    setFullName("");
    setPhone("");
    setIsFormMaster(false);
    setDesignation("");
    setStandingDuties("");
    setPermissions(DEFAULT_TEACHER_PERMISSIONS);
  };

  // Direct Inline Edit Handlers
  const startInlineStaffEdit = (s: StaffRecord) => {
    setEditingStaffId(s.id);
    setInlineStaffForm({
      staffId: s.staffId,
      fullName: s.fullName,
      role: s.role,
      assignedSubjects: s.assignedSubjects || [],
      assignedClass: s.assignedClass || "Primary 1",
      phone: s.phone || "",
      designation: s.designation || "",
      status: s.status || "Active",
    });
    setInlineStaffError(null);
  };

  const cancelInlineStaffEdit = () => {
    setEditingStaffId(null);
    setInlineStaffForm({});
    setInlineStaffError(null);
  };

  const saveInlineStaffEdit = async () => {
    if (!editingStaffId) return;
    const name = inlineStaffForm.fullName?.trim();
    if (!name) {
      setInlineStaffError("Full name cannot be blank.");
      return;
    }
    const staffId = inlineStaffForm.staffId?.trim();
    if (!staffId) {
      setInlineStaffError("Staff ID cannot be blank.");
      return;
    }

    setInlineStaffSaving(true);
    setInlineStaffError(null);
    const result = await updateStaff(editingStaffId, inlineStaffForm);
    setInlineStaffSaving(false);

    if (!result.ok) {
      setInlineStaffError(result.reason || "Failed to update staff record.");
      return;
    }

    // Immediately sync Form Teacher assignment to class setup store
    if (inlineStaffForm.isFormMaster && inlineStaffForm.assignedClass) {
      const targetClass = classes.find((c) => c.name === inlineStaffForm.assignedClass);
      if (targetClass) {
        updateClass(targetClass.id, {
          formTeacher: inlineStaffForm.fullName || name,
          formTeacherId: inlineStaffForm.staffId || staffId,
        });
      }
    } else if (inlineStaffForm.isFormMaster === false) {
      const prevClass = classes.find((c) => c.formTeacherId === (inlineStaffForm.staffId || staffId));
      if (prevClass) {
        updateClass(prevClass.id, { formTeacher: "Unassigned", formTeacherId: "" });
      }
    }

    setEditingStaffId(null);
    setInlineStaffForm({});
    setNotificationMsg(`Staff record for ${name} (${staffId}) updated successfully.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Full Profile Edit Handlers
  const openFullEditStaff = (s: StaffRecord) => {
    setFullEditStaff(s);
    setFullEditStaffForm({
      staffId: s.staffId,
      fullName: s.fullName,
      username: s.username,
      email: s.email,
      phone: s.phone || "",
      role: s.role,
      assignedSubjects: s.assignedSubjects || [],
      assignedClass: s.assignedClass || "Primary 1",
      isFormMaster: Boolean(s.isFormMaster),
      designation: s.designation || "",
      status: s.status || "Active",
      standingDuties: s.standingDuties || [],
      staffType: s.staffType || "Teaching",
      qualifications: s.qualifications || "B.Ed / B.Sc",
      bankName: s.bankName || "",
      accountNumber: s.accountNumber || "",
      accountName: s.accountName || "",
      salaryGrade: s.salaryGrade || "Level 1",
      address: s.address || "",
      emergencyContactName: s.emergencyContactName || "",
      emergencyContactPhone: s.emergencyContactPhone || "",
      dateOfBirth: s.dateOfBirth || "",
      employmentDate: s.employmentDate || "",
    });
    setFullEditStaffError(null);
  };

  const saveFullEditStaff = async () => {
    if (!fullEditStaff) return;
    const name = fullEditStaffForm.fullName?.trim();
    if (!name) {
      setFullEditStaffError("Full name cannot be blank.");
      return;
    }
    const staffId = fullEditStaffForm.staffId?.trim();
    if (!staffId) {
      setFullEditStaffError("Staff ID cannot be blank.");
      return;
    }

    setFullEditStaffSaving(true);
    setFullEditStaffError(null);
    const result = await updateStaff(fullEditStaff.id, fullEditStaffForm);
    setFullEditStaffSaving(false);

    if (!result.ok) {
      setFullEditStaffError(result.reason || "Failed to save profile changes.");
      return;
    }

    // Immediately sync Form Teacher assignment to class setup store
    if (fullEditStaffForm.isFormMaster && fullEditStaffForm.assignedClass) {
      const targetClass = classes.find((c) => c.name === fullEditStaffForm.assignedClass);
      if (targetClass) {
        updateClass(targetClass.id, {
          formTeacher: fullEditStaffForm.fullName || name,
          formTeacherId: fullEditStaffForm.staffId || staffId,
        });
      }
    } else if (fullEditStaffForm.isFormMaster === false) {
      const prevClass = classes.find((c) => c.formTeacherId === (fullEditStaffForm.staffId || staffId));
      if (prevClass) {
        updateClass(prevClass.id, { formTeacher: "Unassigned", formTeacherId: "" });
      }
    }

    setFullEditStaff(null);
    setNotificationMsg(`Full faculty record for ${name} saved successfully.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Handle CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const closeCsvModal = () => {
    setIsCsvModalOpen(false);
    setBulkResult(null);
    setBulkCopied(false);
  };

  const handleConfirmCsvUpload = async () => {
    if (csvPreview.length === 0 || importing) return;
    setImporting(true);
    setUploadStatus(`Filing ${csvPreview.length} staff records on the school's database…`);
    try {
      const result = await bulkAddStaff(csvPreview);
      setBulkResult(result);
      setCsvPreview([]);
      setUploadStatus(null);
      if (result.saved > 0) {
        setNotificationMsg(`${result.saved} staff ${result.saved === 1 ? "record is" : "records are"} on the school's register`);
        setTimeout(() => setNotificationMsg(null), 5000);
      }
    } finally {
      setImporting(false);
    }
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
      "Designation",
      "Standing Duties",
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
      s.designation?.trim() || "not stated",
      (s.standingDuties ?? []).join("; "),
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
              <Link href="/" className="flex min-h-6 items-center gap-1 hover:text-blue-600">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Staff Management</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
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
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer print:hidden"
              title="Print official staff directory with school letterhead"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              Print Directory
            </button>

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
              onClick={() => {
                setBulkResult(null);
                setBulkCopied(false);
                setIsCsvModalOpen(true);
              }}
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

        {credentialProblem && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-4 text-xs font-semibold flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{credentialProblem}</span>
            <button
              onClick={() => setCredentialProblem(null)}
              className="text-amber-800 hover:text-amber-950 font-bold underline underline-offset-2 flex-shrink-0"
            >
              Dismiss
            </button>
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
                    const isEditing = editingStaffId === s.id;
                    const perms = s.permissions || DEFAULT_TEACHER_PERMISSIONS;

                    if (isEditing) {
                      return (
                        <React.Fragment key={s.id}>
                          <tr className="bg-blue-50/50 border-y-2 border-[#4169E1]">
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={inlineStaffForm.staffId ?? ""}
                                onChange={(e) => setInlineStaffForm((prev) => ({ ...prev, staffId: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveInlineStaffEdit();
                                  if (e.key === "Escape") cancelInlineStaffEdit();
                                }}
                                disabled={inlineStaffSaving}
                                className="w-28 px-2 py-1 text-xs font-mono font-bold text-blue-900 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
                                title="Staff ID (e.g. RCA/PERS/001)"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                placeholder="Full Name"
                                value={inlineStaffForm.fullName ?? ""}
                                onChange={(e) => setInlineStaffForm((prev) => ({ ...prev, fullName: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveInlineStaffEdit();
                                  if (e.key === "Escape") cancelInlineStaffEdit();
                                }}
                                disabled={inlineStaffSaving}
                                className="w-full min-w-[140px] px-2 py-0.5 text-xs font-bold text-slate-900 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden mb-1"
                              />
                              <input
                                type="text"
                                placeholder="Designation (e.g. Bursar)"
                                value={inlineStaffForm.designation ?? ""}
                                onChange={(e) => setInlineStaffForm((prev) => ({ ...prev, designation: e.target.value }))}
                                disabled={inlineStaffSaving}
                                className="w-full px-2 py-0.5 text-[11px] text-slate-700 bg-white border border-blue-400 rounded"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <select
                                value={inlineStaffForm.role ?? "TEACHER"}
                                onChange={(e) => setInlineStaffForm((prev) => ({ ...prev, role: e.target.value as StaffRecord["role"] }))}
                                disabled={inlineStaffSaving}
                                className="px-2 py-1 text-[11px] font-bold bg-white border border-blue-400 rounded text-slate-800"
                              >
                                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                <option value="EXAM_OFFICER">EXAM_OFFICER</option>
                                <option value="TEACHER">TEACHER</option>
                                <option value="ACCOUNTANT">ACCOUNTANT</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                placeholder="Subjects (comma-separated)"
                                value={Array.isArray(inlineStaffForm.assignedSubjects) ? inlineStaffForm.assignedSubjects.join(", ") : ""}
                                onChange={(e) =>
                                  setInlineStaffForm((prev) => ({
                                    ...prev,
                                    assignedSubjects: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                                  }))
                                }
                                disabled={inlineStaffSaving}
                                className="w-full min-w-[120px] px-2 py-1 text-[11px] bg-white border border-blue-400 rounded"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <select
                                value={inlineStaffForm.assignedClass ?? "Primary 1"}
                                onChange={(e) => setInlineStaffForm((prev) => ({ ...prev, assignedClass: e.target.value }))}
                                disabled={inlineStaffSaving}
                                className="w-full px-1.5 py-1 text-[11px] font-bold bg-white border border-blue-400 rounded text-slate-800"
                              >
                                {classes.map((cls) => (
                                  <option key={cls.id} value={cls.name}>
                                    {cls.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-2">
                              <select
                                value={inlineStaffForm.status ?? "Active"}
                                onChange={(e) => setInlineStaffForm((prev) => ({ ...prev, status: e.target.value as StaffRecord["status"] }))}
                                disabled={inlineStaffSaving}
                                className="px-1.5 py-1 text-[10px] font-bold bg-white border border-blue-400 rounded text-slate-800"
                              >
                                <option value="Active">Active</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Suspended">Suspended</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void saveInlineStaffEdit()}
                                  disabled={inlineStaffSaving}
                                  className="px-2 py-1 rounded bg-[#4169E1] hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer disabled:opacity-60 shadow-xs"
                                  title="Save changes (Enter)"
                                >
                                  {inlineStaffSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelInlineStaffEdit}
                                  disabled={inlineStaffSaving}
                                  className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-[#E01B00] border border-rose-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                  title="Cancel (Esc)"
                                >
                                  <X className="w-3 h-3" />
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openFullEditStaff(s)}
                                  disabled={inlineStaffSaving}
                                  className="text-[10px] font-bold text-blue-700 hover:underline cursor-pointer whitespace-nowrap ml-1"
                                  title="Edit full profile"
                                >
                                  More...
                                </button>
                              </div>
                            </td>
                          </tr>
                          {inlineStaffError && (
                            <tr className="bg-rose-50 border-b-2 border-rose-300">
                              <td colSpan={7} className="px-4 py-2 text-xs font-semibold text-rose-800">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                  <span>{inlineStaffError}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    }

                    return (
                      <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-900">{s.staffId}</td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 leading-tight">{s.fullName}</p>
                          {s.designation?.trim() ? (
                            <p className="text-[11px] font-semibold text-slate-700 leading-tight">{s.designation}</p>
                          ) : (
                            <p className="text-[11px] italic text-slate-400 leading-tight">Designation not stated</p>
                          )}
                          {s.standingDuties && s.standingDuties.length > 0 && (
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Standing: {s.standingDuties.join(", ")}
                            </p>
                          )}
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
                          <div className="flex items-center justify-end">
                            <RowActionsDropdown
                              items={[
                                {
                                  id: "edit",
                                  label: "Edit Record",
                                  icon: <Pencil className="w-3.5 h-3.5" />,
                                  onClick: () => startInlineStaffEdit(s),
                                  title: "Quick edit staff record inline",
                                },
                                {
                                  id: "full-edit",
                                  label: "Full Profile Editor",
                                  icon: <FileText className="w-3.5 h-3.5" />,
                                  onClick: () => openFullEditStaff(s),
                                  title: "Open complete 5-section staff profile drawer",
                                },
                                {
                                  id: "dossier",
                                  label: "Print Dossier",
                                  icon: <FileText className="w-3.5 h-3.5" />,
                                  onClick: () => setSelectedDossierStaff(s),
                                  title: "View official staff dossier record",
                                },
                                {
                                  id: "slip",
                                  label: slipBusy === s.staffId ? "Issuing Slip…" : "Access Slip",
                                  icon: <KeyRound className="w-3.5 h-3.5" />,
                                  onClick: () => void issueAccessSlip(s),
                                  disabled: slipBusy === s.staffId,
                                  variant: "brand",
                                  title: "Issue Private Access Slip credentials",
                                },
                                {
                                  id: "id-card",
                                  label: "ID Card",
                                  icon: <CreditCard className="w-3.5 h-3.5" />,
                                  href: `/operations/id-cards?holder=staff&ref=${encodeURIComponent(s.staffId)}`,
                                  title: `Design and print the identity card for ${s.fullName}`,
                                },
                                {
                                  id: "permissions",
                                  label: "Permissions",
                                  icon: <Lock className="w-3.5 h-3.5" />,
                                  onClick: () => setEditingStaff(s),
                                  title: "Edit Granular CRUD & Portal Permissions",
                                },
                                {
                                  id: "delete",
                                  label: "Remove Staff",
                                  icon: <Trash2 className="w-3.5 h-3.5" />,
                                  onClick: () => void removeStaff(s),
                                  disabled: removingId === s.staffId,
                                  variant: "danger",
                                  title: "Remove from the school's register",
                                },
                              ]}
                            />
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
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
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

                <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-snug">
                  These ticks are the office&apos;s own notes and are kept on this device. They do not open or close any
                  door: each request is checked against the member&apos;s role, so a tick here cannot let a teacher
                  publish results and a blank box cannot stop an exam officer. Change what someone can do by changing
                  their role in Settings → User Access.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
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
                      setNotificationMsg(`Notes kept on this device for ${editingStaff.fullName}`);
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
            <div className="bg-white rounded-2xl max-w-xl w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          {c.name} — {c.section}{c.formTeacher && c.formTeacher !== "Unassigned" ? ` (Current Form Master: ${c.formTeacher})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Designation (job title)</label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="e.g. Bursar, Dean of Studies, Coordinator"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standing duties, comma-separated</label>
                    <input
                      type="text"
                      placeholder="e.g. Gate Duty, Morning Assembly"
                      value={standingDuties}
                      onChange={(e) => setStandingDuties(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 leading-snug -mt-1">
                  The designation is what the school employs this person as; the role above is what the portal lets them
                  do. They are recorded apart on purpose — a title has never granted access here, and leaving the
                  designation blank prints as “not stated”, never as a guess taken from the role. Standing duties are
                  what the duty roster offers for a named date; nothing is filed on anyone&apos;s behalf by being listed
                  here.
                </p>

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
                  <p className="text-[10px] text-slate-600 leading-snug">
                    These notes are kept on this device, alongside the register. What a member can actually do is set
                    by their role — the portal refuses a request their role does not cover, whatever is ticked here. To
                    give someone more, change their role in Settings → User Access.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
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
            <div className="bg-white rounded-2xl max-w-2xl w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">Bulk Staff Onboarding via CSV</h3>
                </div>
                <button onClick={closeCsvModal} className="text-slate-400 font-bold cursor-pointer">
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
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
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

                {bulkResult && (
                  <div className="space-y-2">
                    <div
                      className={`p-3 rounded-xl border text-[11px] font-medium ${
                        bulkResult.saved === 0
                          ? "bg-red-50 border-red-200 text-red-900"
                          : bulkResult.failures.length > 0
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-emerald-50 border-emerald-200 text-emerald-900"
                      }`}
                    >
                      {bulkResult.saved > 0
                        ? `${bulkResult.saved} of the ${bulkResult.saved + bulkResult.failures.length} rows are on the school's register.`
                        : "None of these rows reached the school's register."}
                      {bulkResult.failures.length > 0 && (
                        <> {bulkResult.failures.length} row(s) were refused — fix the file and run them again.</>
                      )}
                    </div>

                    {bulkResult.logins.length > 0 && (
                      <div className="border border-blue-200 rounded-xl overflow-x-auto max-h-52 overflow-y-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-blue-50 text-blue-900 font-bold sticky top-0">
                            <tr>
                              <th className="py-2 px-3">Staff member</th>
                              <th className="py-2 px-3">Login</th>
                              <th className="py-2 px-3">Password (shown once)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bulkResult.logins.map((login) => (
                              <tr key={login.username}>
                                <td className="py-1.5 px-3 font-semibold">{login.fullName}</td>
                                <td className="py-1.5 px-3 font-mono">{login.username}</td>
                                <td className="py-1.5 px-3 font-mono">{login.password}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {bulkResult.logins.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(
                              bulkResult.logins
                                .map((login) => `${login.fullName}\t${login.username}\t${login.password}`)
                                .join("\n")
                            )
                            .then(() => setBulkCopied(true))
                            .catch(() => setBulkCopied(false));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {bulkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {bulkCopied ? "Copied — hand these out and this list is gone" : "Copy every login and password"}
                      </button>
                    )}

                    {bulkResult.failures.length > 0 && (
                      <ul className="space-y-1 text-[11px] text-slate-700 list-disc pl-5">
                        {bulkResult.failures.map((failure) => (
                          <li key={failure}>{failure}</li>
                        ))}
                      </ul>
                    )}
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
                      onClick={closeCsvModal}
                      className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                    >
                      {bulkResult ? "Close" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      disabled={csvPreview.length === 0 || importing}
                      onClick={() => void handleConfirmCsvUpload()}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
                    >
                      {importing ? "Filing on the database…" : `Onboard ${csvPreview.length} Staff Now`}
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
            <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-brand-600/30 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black shadow-md">
                    <Lock className="w-5 h-5 text-azure-400" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-brand-600">
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
                <AlertCircle className="w-4 h-4 text-accent-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-accent-600 uppercase tracking-wide">
                    Confidential &amp; Secure Isolation:
                  </span>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    These initial credentials are <strong>never</strong> displayed on the public login page. Transmit this private slip directly to the staff member via official SMS, WhatsApp, or printed memo.
                  </p>
                </div>
              </div>

              {/* Staff Details & Credentials Card */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-brand-600/20 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Staff Member</span>
                    <span className="font-extrabold text-slate-900">{credentialSlip.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Staff ID</span>
                    <span className="font-mono font-bold text-brand-600">{credentialSlip.staffId}</span>
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
                  <div className="bg-night-900 text-white rounded-lg p-3 space-y-2 font-mono text-xs ring-1 ring-inset ring-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55 text-[10px] uppercase tracking-wider">Username:</span>
                      <span className="font-bold text-azure-300 text-sm">{credentialSlip.username}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55 text-[10px] uppercase tracking-wider">Temporary Passcode:</span>
                      <span className="font-bold text-amber-300 text-sm">{credentialSlip.tempPasscode}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-white/55 italic">
                      {credentialSlip.action === "reset"
                        ? "This replaces the passcode they were using — every device signed in with the old one is now signed out."
                        : "This login did not exist until now; it was created and hashed on the server."}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-white/55 pt-2 border-t border-white/10">
                      <span>Portal URL:</span>
                      <span className="text-white/85 underline">https://sms.royalcrownacademy.edu.ng/login</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Copy Slip, Print, Dismiss */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const slipText = `*ROYAL CROWN ACADEMY - STAFF ACCESS MEMO*\n\nDear ${credentialSlip.fullName},\n${credentialSlip.action === "reset"
                      ? "Your portal passcode has been replaced by the school office. The one you used before no longer works."
                      : "Your staff account has been provisioned."}\n\n*Staff ID:* ${credentialSlip.staffId}\n*Role:* ${credentialSlip.role}\n*Portal URL:* https://sms.royalcrownacademy.edu.ng/login\n*Username:* ${credentialSlip.username}\n*Temporary Passcode:* ${credentialSlip.tempPasscode}\n\n_Please log in and update your passcode immediately. Do not share these credentials._`;
                    navigator.clipboard.writeText(slipText);
                    setCopiedSlip(true);
                    setTimeout(() => setCopiedSlip(false), 3000);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  {copiedSlip ? (
                    <>
                      <Check className="w-4 h-4 text-azure-400" />
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
        {/* Modal: Individual Official Staff Dossier */}
        {selectedDossierStaff && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-5 print:p-0 print:border-none print:shadow-none print:max-h-none print:overflow-visible">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-base text-slate-900">
                    Official Staff Dossier Record
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Dossier
                  </button>
                  <button
                    onClick={() => setSelectedDossierStaff(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Official Letterhead Header */}
              <SchoolLetterhead
                brand={
                  selectedDossierStaff.assignedClass?.toLowerCase().includes("jss") ||
                  selectedDossierStaff.assignedClass?.toLowerCase().includes("sss")
                    ? "SECONDARY"
                    : "PRIMARY"
                }
                title="OFFICIAL STAFF RECORD DOSSIER"
                subtitle={`Employee Reference ID: ${selectedDossierStaff.staffId} • Status: Active Faculty`}
                showSignatoryFooter={true}
              >
                <div className="space-y-4 text-xs mt-2">
                  {/* Bio & Position Summary */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION A: EMPLOYMENT &amp; BIODATA DETAILS
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Legal Name</span>
                        <strong className="text-slate-900 font-sans text-sm">{selectedDossierStaff.fullName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Staff ID Ref</span>
                        <strong className="text-slate-800">{selectedDossierStaff.staffId}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Designation</span>
                        <span className="text-slate-700 font-sans font-bold">{selectedDossierStaff.designation || selectedDossierStaff.role}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Staff Classification</span>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                          {selectedDossierStaff.role === "ACCOUNTANT" ? "NON_TEACHING" : "TEACHING"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Primary Contact</span>
                        <span className="text-slate-700">{selectedDossierStaff.phone || "Not recorded"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Employment Status</span>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Active &amp; Confirmed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Academic & Teaching Responsibilities */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION B: ACADEMIC QUALIFICATIONS &amp; DUTY ROSTER
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Qualifications</span>
                        <strong className="text-slate-800 font-sans">B.Ed / B.Sc (Hons), TRCN Certified</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Subject(s)</span>
                        <span className="text-slate-800 font-sans">
                          {selectedDossierStaff.assignedSubjects && selectedDossierStaff.assignedSubjects.length > 0
                            ? selectedDossierStaff.assignedSubjects.join(", ")
                            : "General Curriculum"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Class / Arm</span>
                        <span className="text-slate-800 font-sans font-bold">{selectedDossierStaff.assignedClass || "Cross-Department"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Form Master Role</span>
                        <span className="text-slate-800">{selectedDossierStaff.isFormMaster ? "Yes (Designated Form Master)" : "No"}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Standing Administrative Duties</span>
                        <span className="text-slate-700 font-sans">
                          {selectedDossierStaff.standingDuties && selectedDossierStaff.standingDuties.length > 0
                            ? selectedDossierStaff.standingDuties.join(", ")
                            : "Standard Faculty & Examination Supervision Duties"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Security & Access Permissions */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION C: SECURITY &amp; PORTAL PERMISSION GRANTS
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedDossierStaff.permissions?.canEnterScores && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                          Can Enter Scores
                        </span>
                      )}
                      {selectedDossierStaff.permissions?.canEditScores && (
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                          Can Edit Scores
                        </span>
                      )}
                      {selectedDossierStaff.permissions?.canPublishResults && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                          Can Publish Results
                        </span>
                      )}
                      {selectedDossierStaff.permissions?.canEditFees && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Can Edit Bursary / Fees
                        </span>
                      )}
                      {selectedDossierStaff.permissions?.canEditStudents && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Can Edit Student Records
                        </span>
                      )}
                      {selectedDossierStaff.permissions?.canApprovePromotions && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                          Can Approve Promotions
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payroll & Banking Information */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION D: PAYROLL &amp; REMUNERATION ACCOUNT
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Name</span>
                        <strong className="text-slate-800">First Bank of Nigeria</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                        <span className="text-slate-800 font-bold">308942****</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Payee</span>
                        <span className="text-slate-700 font-sans">{selectedDossierStaff.fullName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Disbursement</span>
                        <span className="text-slate-700">Monthly Remuneration</span>
                      </div>
                    </div>
                  </div>
                </div>
              </SchoolLetterhead>
            </div>
          </div>
        )}

        {/* Modal: Full Staff Profile Editor */}
        {fullEditStaff && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Edit Staff Profile Dossier
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Ref ID: {fullEditStaff.staffId} • {fullEditStaff.fullName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFullEditStaff(null)}
                  disabled={fullEditStaffSaving}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {fullEditStaffError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{fullEditStaffError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveFullEditStaff();
                }}
                className="space-y-4 text-xs"
              >
                {/* SECTION A: Core Employment & Identity */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION A: EMPLOYMENT &amp; IDENTITY DETAILS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.fullName ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, fullName: e.target.value })}
                        required
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Staff ID Reference *</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.staffId ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, staffId: e.target.value })}
                        required
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Username (Portal Sign-in)</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.username ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, username: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Institutional Email</label>
                      <input
                        type="email"
                        value={fullEditStaffForm.email ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, email: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.phone ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, phone: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Portal Role Tier *</label>
                      <select
                        value={fullEditStaffForm.role ?? "TEACHER"}
                        onChange={(e) =>
                          setFullEditStaffForm({
                            ...fullEditStaffForm,
                            role: e.target.value as StaffRecord["role"],
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                      >
                        <option value="TEACHER">Tier 3: Teacher</option>
                        <option value="EXAM_OFFICER">Tier 2: Exam Officer</option>
                        <option value="SUPER_ADMIN">Tier 1: Super Admin</option>
                        <option value="ACCOUNTANT">Bursary Accountant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Designation (Job Title)</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.designation ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, designation: e.target.value })}
                        placeholder="e.g. Dean of Science, Vice Principal"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Employment Status</label>
                      <select
                        value={fullEditStaffForm.status ?? "Active"}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, status: e.target.value as StaffRecord["status"] })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                      >
                        <option value="Active">Active &amp; Confirmed</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION B: Academic & Form Duties */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION B: ACADEMIC &amp; FORM DUTIES
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Assigned Subject(s) (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(fullEditStaffForm.assignedSubjects || []).join(", ")}
                        onChange={(e) =>
                          setFullEditStaffForm({
                            ...fullEditStaffForm,
                            assignedSubjects: e.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="e.g. General Mathematics, Further Mathematics"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Form Class</label>
                      <select
                        value={fullEditStaffForm.assignedClass ?? "Primary 1"}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, assignedClass: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} — {c.section}{c.formTeacher && c.formTeacher !== "Unassigned" ? ` (Current Form Master: ${c.formTeacher})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="fullEditFormMaster"
                        checked={Boolean(fullEditStaffForm.isFormMaster)}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, isFormMaster: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <label htmlFor="fullEditFormMaster" className="font-semibold text-slate-700 text-xs cursor-pointer">
                        Appoint as Designated Form Master
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Standing Administrative Duties (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(fullEditStaffForm.standingDuties || []).join(", ")}
                        onChange={(e) =>
                          setFullEditStaffForm({
                            ...fullEditStaffForm,
                            standingDuties: splitDutyList(e.target.value),
                          })
                        }
                        placeholder="e.g. Morning Assembly, Examination Officer, Gate Duty"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: Qualifications & Demographics */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION C: QUALIFICATIONS &amp; DEMOGRAPHICS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={fullEditStaffForm.dateOfBirth ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, dateOfBirth: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Employment Date</label>
                      <input
                        type="date"
                        value={fullEditStaffForm.employmentDate ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, employmentDate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Academic Qualifications</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.qualifications ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, qualifications: e.target.value })}
                        placeholder="e.g. B.Ed, B.Sc (Hons), TRCN"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION D: Remuneration & Banking */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION D: REMUNERATION &amp; PAYROLL ACCOUNT
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.bankName ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, bankName: e.target.value })}
                        placeholder="e.g. First Bank, GTBank, Zenith Bank"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.accountNumber ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, accountNumber: e.target.value })}
                        placeholder="10-digit NUBAN"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Beneficiary Name</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.accountName ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, accountName: e.target.value })}
                        placeholder="Account holder name"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Salary Grade / Level</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.salaryGrade ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, salaryGrade: e.target.value })}
                        placeholder="e.g. Level 8 / Step 2"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION E: Emergency Contacts & Address */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION E: EMERGENCY CONTACTS &amp; RESIDENTIAL ADDRESS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.emergencyContactName ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, emergencyContactName: e.target.value })}
                        placeholder="Next of Kin / Contact Name"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Emergency Contact Phone</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.emergencyContactPhone ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, emergencyContactPhone: e.target.value })}
                        placeholder="080..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Residential Address</label>
                      <input
                        type="text"
                        value={fullEditStaffForm.address ?? ""}
                        onChange={(e) => setFullEditStaffForm({ ...fullEditStaffForm, address: e.target.value })}
                        placeholder="Street address, City, State"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setFullEditStaff(null)}
                    disabled={fullEditStaffSaving}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={fullEditStaffSaving}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {fullEditStaffSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Full Staff Profile
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Print-Only Letterhead for Filtered Staff Directory Print */}
        <div className="hidden print:block mb-4">
          <SchoolLetterhead
            brand="GROUP"
            title="OFFICIAL STAFF DIRECTORY REGISTER"
            subtitle={`Department / Role Filter: ${roleFilter === "all" ? "All Faculty & Administrative Staff" : roleFilter} • ${filtered.length} Active Records`}
            showSignatoryFooter={true}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

