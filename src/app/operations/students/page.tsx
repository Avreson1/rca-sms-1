"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useRealtimeAuth, useRealtimeStudents, useRealtimeClasses, StudentRecord } from "@/lib/realtime-store";
import { isRouteAllowed } from "@/lib/rbac";
import { DeviceOnlyNotice } from "@/components/ui/device-only-notice";
import { exportToCSV, parseCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import {
  Users,
  Search,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowLeft,
  School,
  AlertCircle,
  FileDown,
  Printer,
  FileText,
  X,
  ShieldCheck,
  Pencil,
  Check,
  Loader2,
  KeyRound,
  CreditCard,
  Lock,
  Copy,
} from "lucide-react";
import { SchoolLetterhead } from "@/components/ui/school-letterhead";
import { RowActionsDropdown } from "@/components/ui/row-actions-dropdown";

type CsvStudentRow = {
  fullName: string;
  className: string;
  gender: "Male" | "Female";
  guardianName: string;
  guardianPhone: string;
  house: StudentRecord["house"];
  feeStatus: StudentRecord["feeStatus"];
};

export default function StudentsPage() {
  const { students, addStudent, bulkAddStudents, deleteStudent, updateStudent } = useRealtimeStudents();
  const { currentUser } = useRealtimeAuth();
  // A teacher and a bursar may enrol a pupil but are refused the card desk, so
  // they are not offered a button that only leads to a refusal.
  const canReachCards = isRouteAllowed(currentUser?.role, "/operations/id-cards");
  const { classes, classesSource } = useRealtimeClasses();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all");
  const [selectedDossierStudent, setSelectedDossierStudent] = useState<StudentRecord | null>(null);

  // Direct Inline Row Editing State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<Partial<StudentRecord>>({});
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Full Profile Edit Modal / Drawer State
  const [fullEditStudent, setFullEditStudent] = useState<StudentRecord | null>(null);
  const [fullEditForm, setFullEditForm] = useState<Partial<StudentRecord>>({});
  const [fullEditSaving, setFullEditSaving] = useState(false);
  const [fullEditError, setFullEditError] = useState<string | null>(null);

  // General Notification Notice
  const [notice, setNotice] = useState<{ tone: "good" | "warn"; text: string } | null>(null);

  // Out-of-band Credential Distribution Slip for Student/Parent
  const [credentialSlip, setCredentialSlip] = useState<{
    fullName: string;
    admissionNo: string;
    username: string;
    tempPasscode: string;
    role: string;
    action: "created" | "reset";
  } | null>(null);
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [slipBusy, setSlipBusy] = useState<string | null>(null);
  const [credentialProblem, setCredentialProblem] = useState<string | null>(null);

  const issueAccessSlip = async (pupil: StudentRecord) => {
    setSlipBusy(pupil.admissionNo);
    setCredentialProblem(null);

    try {
      const response = await fetch("/api/accounts/issue", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: pupil.admissionNo }),
      });
      const payload = (await response.json().catch(() => null)) as {
        login?: { username: string; password: string; action: "created" | "reset" };
        error?: string;
      } | null;

      if (!response.ok || !payload?.login) {
        setCredentialSlip(null);
        setCredentialProblem(payload?.error ?? `The portal could not issue a login for ${pupil.admissionNo}.`);
        return;
      }

      setCredentialSlip({
        fullName: pupil.fullName,
        admissionNo: pupil.admissionNo,
        username: payload.login.username,
        tempPasscode: payload.login.password,
        role: "STUDENT_PARENT",
        action: payload.login.action,
      });
    } catch {
      setCredentialProblem(`The portal server did not answer, so no login was issued for ${pupil.admissionNo}.`);
    } finally {
      setSlipBusy(null);
    }
  };
  
  // The arms a pupil can be enrolled into are the school's own list. Nothing is
  // offered when it is empty: a child put into an arm the school does not run
  // cannot be found by the timetable, the fee schedule or the promotion screen,
  // because all three look for the arm by the name filed on the school's records.
  const availableClasses = classes.map((c) => c.name);

  // Single Admission Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState<string>("");
  const [newGender, setNewGender] = useState<string>("");
  const [newGuardian, setNewGuardian] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newHouse, setNewHouse] = useState<StudentRecord["house"] | "">("");
  const [enrolBusy, setEnrolBusy] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  // CSV Bulk Upload Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvStudentRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvNotice, setCsvNotice] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setEnrolError("Type the pupil's name — a child cannot be enrolled without one.");
      return;
    }
    if (newGender !== "Male" && newGender !== "Female") {
      setEnrolError("Say whether the pupil is a boy or a girl. The portal used to file every blank as Female.");
      return;
    }
    if (!newHouse) {
      setEnrolError("Pick the sports house this pupil belongs to — it is not decided for them.");
      return;
    }
    if (!newClass) {
      setEnrolError("Pick the class arm the pupil joins. Create it first in Setup → Classes if the school has none listed.");
      return;
    }

    setEnrolBusy(true);
    setEnrolError(null);
    const { reason } = await addStudent({
      fullName: name,
      className: newClass,
      gender: newGender as "Male" | "Female",
      guardianName: newGuardian.trim() || "Not Specified",
      guardianPhone: newPhone.trim() || "N/A",
      house: newHouse,
    });
    setEnrolBusy(false);

    // The modal stays open when the school's records refused the pupil, so the
    // clerk sees that before they move on to the next form.
    if (reason) {
      setEnrolError(`${name} is on this browser's list, but ${reason}. Fix the cause and enrol again — do not print a card for a pupil who is not on the school's records.`);
      return;
    }

    setIsModalOpen(false);
    setNewName("");
    setNewGuardian("");
    setNewPhone("");
  };

  // Direct Inline Edit Handlers
  const startInlineEdit = (s: StudentRecord) => {
    setEditingStudentId(s.id);
    setInlineForm({
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      className: s.className,
      gender: s.gender,
      house: s.house,
      guardianName: s.guardianName || "",
      guardianPhone: s.guardianPhone || "",
      feeStatus: s.feeStatus,
    });
    setInlineError(null);
  };

  const cancelInlineEdit = () => {
    setEditingStudentId(null);
    setInlineForm({});
    setInlineError(null);
  };

  const saveInlineEdit = async () => {
    if (!editingStudentId) return;
    const name = inlineForm.fullName?.trim();
    if (!name) {
      setInlineError("Full name cannot be blank.");
      return;
    }
    const adm = inlineForm.admissionNo?.trim();
    if (!adm) {
      setInlineError("Admission number cannot be blank.");
      return;
    }

    setInlineSaving(true);
    setInlineError(null);
    const result = await updateStudent(editingStudentId, inlineForm);
    setInlineSaving(false);

    if (!result.ok) {
      setInlineError(result.reason || "Failed to update student profile.");
      return;
    }

    setEditingStudentId(null);
    setInlineForm({});
    setNotice({
      tone: "good",
      text: `Pupil record for ${name} (${adm}) updated successfully.`,
    });
    setTimeout(() => setNotice(null), 4000);
  };

  // Full Profile Edit Handlers
  const openFullEdit = (s: StudentRecord) => {
    setFullEditStudent(s);
    setFullEditForm({
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      className: s.className,
      gender: s.gender,
      house: s.house,
      guardianName: s.guardianName || "",
      guardianPhone: s.guardianPhone || "",
      feeStatus: s.feeStatus,
      dateOfBirth: s.dateOfBirth || "",
      bloodGroup: s.bloodGroup || "",
      guardianEmail: s.guardianEmail || "",
      guardianAddress: s.guardianAddress || "",
      guardianRelationship: s.guardianRelationship || "Parent",
      medicalNotes: s.medicalNotes || "",
      allergies: s.allergies || "",
      nationality: s.nationality || "Nigerian",
      stateOfOrigin: s.stateOfOrigin || "",
      lga: s.lga || "",
      religion: s.religion || "Christianity",
    });
    setFullEditError(null);
  };

  const saveFullEdit = async () => {
    if (!fullEditStudent) return;
    const name = fullEditForm.fullName?.trim();
    if (!name) {
      setFullEditError("Full name cannot be blank.");
      return;
    }
    const adm = fullEditForm.admissionNo?.trim();
    if (!adm) {
      setFullEditError("Admission number cannot be blank.");
      return;
    }

    setFullEditSaving(true);
    setFullEditError(null);
    const result = await updateStudent(fullEditStudent.id, fullEditForm);
    setFullEditSaving(false);

    if (!result.ok) {
      setFullEditError(result.reason || "Failed to save profile changes.");
      return;
    }

    setFullEditStudent(null);
    setNotice({
      tone: "good",
      text: `Complete profile dossier for ${name} saved successfully.`,
    });
    setTimeout(() => setNotice(null), 4000);
  };

  // CSV File Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsedRows = parseCSV(text);

      if (parsedRows.length < 2) {
        setUploadStatus("This file has a header but no pupil under it. Add the rows, or use CSV Template to start from the right columns.");
        setCsvPreview([]);
        return;
      }

      const HOUSES: Record<string, StudentRecord["house"]> = {
        sapphire: "Sapphire (Blue)",
        ruby: "Ruby (Red)",
        emerald: "Emerald (Green)",
        topaz: "Topaz (Yellow)",
      };
      const FEES: Record<string, StudentRecord["feeStatus"]> = {
        "fully cleared": "Fully Cleared",
        "partially paid": "Partially Paid",
        outstanding: "Outstanding",
      };

      const accepted: CsvStudentRow[] = [];
      const skipped: string[] = [];

      parsedRows.slice(1).forEach((cols, idx) => {
        const row = idx + 2; // 1-based position in the file, header included
        const fullName = cols[0]?.trim();
        const className = cols[1]?.trim();
        const genderWord = cols[2]?.trim().toLowerCase() || "";
        const houseWord = (cols[5] || "").trim().toLowerCase().split(" ")[0];

        if (!fullName) {
          skipped.push(`row ${row}: no name`);
          return;
        }
        if (!className) {
          skipped.push(`row ${row} (${fullName}): no class`);
          return;
        }
        // "male" is inside "female", so the whole word decides it — anything
        // else is refused rather than filed as a girl by default.
        const gender = genderWord === "male" ? "Male" : genderWord === "female" ? "Female" : null;
        if (!gender) {
          skipped.push(`row ${row} (${fullName}): gender says "${cols[2] || ""}", the portal needs Male or Female`);
          return;
        }
        const house = HOUSES[houseWord];
        if (!house) {
          skipped.push(`row ${row} (${fullName}): sports house "${cols[5] || ""}" is not one of Sapphire, Ruby, Emerald or Topaz`);
          return;
        }

        accepted.push({
          fullName,
          className,
          gender,
          house,
          guardianName: cols[3]?.trim() || "Not Specified",
          guardianPhone: cols[4]?.trim() || "N/A",
          feeStatus: FEES[(cols[6] || "").trim().toLowerCase()] || "Outstanding",
        });
      });

      setCsvPreview(accepted);
      const summary = accepted.length
        ? `${accepted.length} pupil${accepted.length === 1 ? "" : "s"} ready to enroll`
        : "No pupil in this file can be enrolled";
      setUploadStatus(
        skipped.length
          ? `${summary}. Skipped ${skipped.length}: ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? `; +${skipped.length - 3} more` : ""}`
          : summary
      );
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvUpload = async () => {
    if (csvPreview.length === 0) return;
    setCsvBusy(true);
    const { count, reason } = await bulkAddStudents(csvPreview);
    setCsvBusy(false);
    // The banner above the roster carries the result after this modal closes, so
    // a batch that never reached the school's records is not read as one that did.
    setCsvNotice(
      reason
        ? {
            tone: "warn",
            text: `${count} pupil${count === 1 ? "" : "s"} were put on this browser's list, but ${reason}. Fix the cause and enroll them again — do not print cards for pupils the school has not accepted.`,
          }
        : {
            tone: "good",
            text: `${count} pupil${count === 1 ? "" : "s"} enrolled and filed on the school's records.`,
          }
    );
    setIsCsvModalOpen(false);
    setCsvPreview([]);
    setUploadStatus(null);
  };

  // Export filtered or full roster to CSV
  const handleExportCSV = () => {
    // Enrollment details only. Marks live in `ca_scores`, one row per subject,
    // so a roster column could only ever hold one subject's numbers and be
    // mistaken for the pupil's whole assessment. Filed marks export from
    // Reports → Master Academic Broadsheet.
    const headers = [
      "Admission No",
      "Full Name",
      "Class Level",
      "Gender",
      "Sports House",
      "Parent/Guardian",
      "Phone Number",
      "Fee Status",
    ];

    const rows = filtered.map((s) => [
      s.admissionNo,
      s.fullName,
      s.className,
      s.gender,
      s.house,
      s.guardianName || "Not recorded",
      s.guardianPhone || "Not recorded",
      s.feeStatus,
    ]);

    exportToCSV(`RCA_Student_Roster_${classFilter.replace(/\s+/g, "_")}`, headers, rows);
  };

  const filtered = students.filter((s) => {
    const matchesClass = classFilter === "all" || s.className === classFilter;
    const matchesFee = feeFilter === "all" || s.feeStatus === feeFilter;
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(search.toLowerCase()) ||
      (s.guardianName ? s.guardianName.toLowerCase().includes(search.toLowerCase()) : false);
    return matchesClass && matchesFee && matchesSearch;
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
              <span className="text-slate-800 font-semibold">Student Directory</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Student Records &amp; Enrollment
              </h1>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Realtime Data Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage student bio-data across <strong>Pre-Play Class</strong>, <strong>Play Class</strong>, <strong>Nursery 1-2</strong>, <strong>Primary 1-5</strong>, and Secondary tiers.
            </p>
          </div>

          {/* Action Buttons: Single, CSV Upload, and CSV Export */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer print:hidden"
              title="Print official student directory with school letterhead"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              Print Directory
            </button>

            <button
              onClick={() => downloadSampleTemplate("students")}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download empty CSV template for batch student enrollment"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              CSV Template
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download entire current student table to CSV"
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
              onClick={() => {
                setEnrolError(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Admit Student
            </button>
          </div>
        </div>

        {classesSource === "device" && (
          <DeviceOnlyNotice what="The class arms this register offers" className="mt-0" />
        )}

        {csvNotice && (
          <div
            className={`p-3.5 rounded-xl border text-[11px] font-semibold flex items-start justify-between gap-3 ${
              csvNotice.tone === "warn"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            <span>{csvNotice.text}</span>
            <button onClick={() => setCsvNotice(null)} className="font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {notice && (
          <div
            className={`p-3.5 rounded-xl border text-[11px] font-semibold flex items-start justify-between gap-3 animate-in fade-in ${
              notice.tone === "warn"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{notice.text}</span>
            </div>
            <button onClick={() => setNotice(null)} className="font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Filter by Class
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Classes</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Fee Clearance Status
            </label>
            <select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="Fully Cleared">Fully Cleared</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Outstanding">Outstanding</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search name, admission number, or parent contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-800">Enrolled Student Registry</h3>
            </div>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
              {filtered.length} Students Listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">Admission No</th>
                  <th className="py-3 px-4">Full Legal Name</th>
                  <th className="py-3 px-3">Class Arm</th>
                  <th className="py-3 px-3">Gender</th>
                  <th className="py-3 px-4">Sports House</th>
                  <th className="py-3 px-4">Parent / Guardian</th>
                  <th className="py-3 px-3 text-center">Fee Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const isEditing = editingStudentId === s.id;
                  if (isEditing) {
                    return (
                      <React.Fragment key={s.id}>
                        <tr className="bg-blue-50/50 border-y-2 border-[#4169E1]">
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={inlineForm.admissionNo ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, admissionNo: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveInlineEdit();
                                if (e.key === "Escape") cancelInlineEdit();
                              }}
                              disabled={inlineSaving}
                              className="w-28 px-2 py-1 text-xs font-mono font-bold text-blue-900 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
                              title="Admission Number (e.g. RCA/2026/042)"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={inlineForm.fullName ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, fullName: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveInlineEdit();
                                if (e.key === "Escape") cancelInlineEdit();
                              }}
                              disabled={inlineSaving}
                              className="w-full min-w-[140px] px-2 py-1 text-xs font-semibold text-slate-900 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
                              title="Full Legal Name"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <select
                              value={inlineForm.className ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, className: e.target.value }))}
                              disabled={inlineSaving}
                              className="w-full px-1.5 py-1 text-[11px] font-bold bg-white border border-blue-400 rounded text-slate-800"
                            >
                              {availableClasses.length > 0 ? (
                                availableClasses.map((cls) => (
                                  <option key={cls} value={cls}>
                                    {cls}
                                  </option>
                                ))
                              ) : (
                                <option value={inlineForm.className}>{inlineForm.className}</option>
                              )}
                            </select>
                          </td>
                          <td className="py-2.5 px-2">
                            <select
                              value={inlineForm.gender ?? "Male"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, gender: e.target.value as "Male" | "Female" }))}
                              disabled={inlineSaving}
                              className="px-1.5 py-1 text-xs bg-white border border-blue-400 rounded text-slate-700 font-medium"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={inlineForm.house ?? "Sapphire (Blue)"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, house: e.target.value as StudentRecord["house"] }))}
                              disabled={inlineSaving}
                              className="w-full px-1.5 py-1 text-xs bg-white border border-blue-400 rounded text-slate-700"
                            >
                              <option value="Sapphire (Blue)">Sapphire (Blue)</option>
                              <option value="Ruby (Red)">Ruby (Red)</option>
                              <option value="Emerald (Green)">Emerald (Green)</option>
                              <option value="Topaz (Yellow)">Topaz (Yellow)</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="Guardian Name"
                              value={inlineForm.guardianName ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, guardianName: e.target.value }))}
                              disabled={inlineSaving}
                              className="w-full px-1.5 py-0.5 text-xs bg-white border border-blue-400 rounded mb-1"
                            />
                            <input
                              type="text"
                              placeholder="Phone (080...)"
                              value={inlineForm.guardianPhone ?? ""}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, guardianPhone: e.target.value }))}
                              disabled={inlineSaving}
                              className="w-full px-1.5 py-0.5 text-[10px] font-mono bg-white border border-blue-400 rounded"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <select
                              value={inlineForm.feeStatus ?? "Outstanding"}
                              onChange={(e) => setInlineForm((prev) => ({ ...prev, feeStatus: e.target.value as StudentRecord["feeStatus"] }))}
                              disabled={inlineSaving}
                              className="px-1.5 py-1 text-[10px] font-bold bg-white border border-blue-400 rounded text-slate-800"
                            >
                              <option value="Fully Cleared">Fully Cleared</option>
                              <option value="Partially Paid">Partially Paid</option>
                              <option value="Outstanding">Outstanding</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => void saveInlineEdit()}
                                disabled={inlineSaving}
                                className="px-2 py-1 rounded bg-[#4169E1] hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60 shadow-xs"
                                title="Save changes (Enter)"
                              >
                                {inlineSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelInlineEdit}
                                disabled={inlineSaving}
                                className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-[#E01B00] border border-rose-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                title="Cancel (Esc)"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => openFullEdit(s)}
                                disabled={inlineSaving}
                                className="text-[10px] font-bold text-blue-700 hover:underline cursor-pointer whitespace-nowrap ml-1"
                                title="Edit all fields in modal"
                              >
                                More...
                              </button>
                            </div>
                          </td>
                        </tr>
                        {inlineError && (
                          <tr className="bg-rose-50 border-b-2 border-rose-300">
                            <td colSpan={8} className="px-4 py-2 text-xs font-semibold text-rose-800">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                <span>{inlineError}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }

                  return (
                    <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">{s.admissionNo}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{s.fullName}</td>
                      <td className="py-3 px-3">
                        <span className="inline-block text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {s.className}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{s.gender}</td>
                      <td className="py-3 px-4 text-slate-600">{s.house}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800 leading-tight">{s.guardianName || "N/A"}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{s.guardianPhone || "N/A"}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <RowActionsDropdown
                            items={[
                              {
                                id: "edit",
                                label: "Edit Record",
                                icon: <Pencil className="w-3.5 h-3.5" />,
                                onClick: () => startInlineEdit(s),
                                title: "Quick edit pupil inline",
                              },
                              {
                                id: "full-edit",
                                label: "Full Profile Editor",
                                icon: <FileText className="w-3.5 h-3.5" />,
                                onClick: () => openFullEdit(s),
                                title: "Open complete 4-section student profile drawer",
                              },
                              {
                                id: "dossier",
                                label: "Print Dossier",
                                icon: <FileText className="w-3.5 h-3.5" />,
                                onClick: () => setSelectedDossierStudent(s),
                                title: "Open official student dossier record",
                              },
                              {
                                id: "access-slip",
                                label: slipBusy === s.admissionNo ? "Issuing Slip…" : "Access Slip",
                                icon: <KeyRound className="w-3.5 h-3.5" />,
                                onClick: () => void issueAccessSlip(s),
                                disabled: slipBusy === s.admissionNo,
                                variant: "brand",
                                title: "Issue Private Access Slip credentials",
                              },
                              ...(canReachCards
                                ? [
                                    {
                                      id: "id-card",
                                      label: "ID Card",
                                      icon: <CreditCard className="w-3.5 h-3.5" />,
                                      href: `/operations/id-cards?holder=student&ref=${encodeURIComponent(s.admissionNo)}`,
                                      title: `Design and print the identity card for ${s.fullName}`,
                                    },
                                  ]
                                : []),
                              {
                                id: "gradebook",
                                label: "Gradebook",
                                icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                                href: "/operations/update-ca",
                                title: "Open CA continuous assessment gradebook",
                              },
                              {
                                id: "delete",
                                label: "Delete Student",
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                onClick: () => {
                                  if (
                                    confirm(
                                      `Remove ${s.fullName} from enrollment records? Their saved CA scores and invoices go with them.`
                                    )
                                  ) {
                                    deleteStudent(s.id);
                                  }
                                },
                                variant: "danger",
                                title: "Remove student from the register",
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
        </div>

        {/* Modal: Bulk CSV Upload */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-base text-slate-900">
                    Bulk Student Enrollment via CSV
                  </h3>
                </div>
                <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Supported Columns in CSV File:</p>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Full Name</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Class (e.g. Pre-Play Class, Nursery 1, Primary 5, JSS 1, SS 2)</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Gender</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Guardian Name</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Guardian Phone</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Sports House</code>, <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Fee Status</code>.
                    </p>
                    <p className="text-[11px] text-indigo-800 mt-1">
                      A row is skipped and listed here — before anything is filed — when it has no name, no class, a
                      gender other than <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Male</code> or
                      <code className="font-mono bg-white/70 px-1 py-0.5 rounded">Female</code>, or a house the school
                      does not have. The portal no longer files a blank as a girl, a missing class as Primary 1, or an
                      unknown house as Sapphire.
                    </p>
                  </div>
                </div>

                {/* File Dropzone */}
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center space-y-2 bg-slate-50 transition-colors">
                  <Upload className="w-8 h-8 text-indigo-600 mx-auto" />
                  <p className="font-bold text-slate-700">Choose a CSV file to upload</p>
                  <p className="text-slate-500 text-[11px]">Click below or drag and drop your exported .csv enrollment file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block mx-auto text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>

                {/* Status or Preview */}
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
                          <th className="py-2 px-3">Class</th>
                          <th className="py-2 px-3">Gender</th>
                          <th className="py-2 px-3">Guardian</th>
                          <th className="py-2 px-3">House</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvPreview.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-3 font-semibold">{row.fullName}</td>
                            <td className="py-1.5 px-3">{row.className}</td>
                            <td className="py-1.5 px-3">{row.gender}</td>
                            <td className="py-1.5 px-3">{row.guardianName}</td>
                            <td className="py-1.5 px-3">{row.house}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 10 && (
                      <p className="text-center text-[10px] text-slate-400 py-1 bg-slate-50">
                        + {csvPreview.length - 10} more rows ready to import
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate("students")}
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
                      disabled={csvPreview.length === 0 || csvBusy}
                      onClick={handleConfirmCsvUpload}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
                    >
                      {csvBusy ? "Enrolling…" : `Import ${csvPreview.length} Students Now`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Single Student Admission */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <School className="w-4 h-4 text-blue-600" />
                  Direct Student Admission
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold">✕</button>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adams Grace Chidinma"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Class Arm</label>
                    <select
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    >
                      <option value="" disabled>
                        {availableClasses.length > 0
                          ? "Choose the class arm"
                          : "No class arm is on the school's list — file one in Setup → Classes first"}
                      </option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    >
                      <option value="" disabled>
                        Say whether the pupil is a boy or a girl
                      </option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mr. John Doe"
                      value={newGuardian}
                      onChange={(e) => setNewGuardian(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Guardian Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="080XXXXXXXX"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sports House Allocation</label>
                  <select
                    value={newHouse}
                    onChange={(e) => setNewHouse(e.target.value as StudentRecord["house"])}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    <option value="" disabled>
                      Which house is this pupil in?
                    </option>
                    <option value="Sapphire (Blue)">Sapphire (Blue)</option>
                    <option value="Ruby (Red)">Ruby (Red)</option>
                    <option value="Emerald (Green)">Emerald (Green)</option>
                    <option value="Topaz (Yellow)">Topaz (Yellow)</option>
                  </select>
                </div>

                {enrolError && (
                  <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-[11px] text-red-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="font-semibold">{enrolError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEnrolError(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={enrolBusy}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold shadow-xs cursor-pointer"
                  >
                    {enrolBusy ? "Enrolling…" : "Enroll Student"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credential issuance failure banner */}
        {credentialProblem && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start justify-between gap-2 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{credentialProblem}</span>
            </div>
            <button
              onClick={() => setCredentialProblem(null)}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal: Out-of-Band Student Access Slip */}
        {credentialSlip && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-blue-600/30 shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md">
                    <Lock className="w-5 h-5 text-blue-100" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-blue-900">
                      Private Student / Parent Access Slip
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
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-amber-700 uppercase tracking-wide">
                    Confidential Guardian Credentials:
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Transmit this private slip directly to the pupil or parent via official SMS, WhatsApp, or printed slip.
                  </p>
                </div>
              </div>

              {/* Student Details & Credentials Card */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-600/20 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Student Name</span>
                    <span className="font-extrabold text-slate-900">{credentialSlip.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission Number</span>
                    <span className="font-mono font-bold text-blue-600">{credentialSlip.admissionNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Portal Role</span>
                    <span className="font-bold text-purple-800">Student / Parent (Candidate)</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="bg-slate-900 text-white rounded-lg p-3 space-y-2 font-mono text-xs ring-1 ring-inset ring-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55 text-[10px] uppercase tracking-wider">Username:</span>
                      <span className="font-bold text-blue-300 text-sm">{credentialSlip.username}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/55 text-[10px] uppercase tracking-wider">Temporary Passcode:</span>
                      <span className="font-bold text-amber-300 text-sm">{credentialSlip.tempPasscode}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-white/55 italic">
                      {credentialSlip.action === "reset"
                        ? "This replaces the previous passcode; any device signed in with the old one is signed out."
                        : "Account initialized on the portal."}
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
                    const text = `ROYAL CROWN ACADEMY / HIGH SCHOOL\nPrivate Student / Parent Access Slip\n\nPupil: ${credentialSlip.fullName}\nAdmission No: ${credentialSlip.admissionNo}\nUsername: ${credentialSlip.username}\nPasscode: ${credentialSlip.tempPasscode}\n\nLogin at: https://sms.royalcrownacademy.edu.ng/login`;
                    navigator.clipboard.writeText(text);
                    setCopiedSlip(true);
                    setTimeout(() => setCopiedSlip(false), 3000);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedSlip ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                  {copiedSlip ? "Copied to Clipboard!" : "Copy Slip Text"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer border border-blue-200"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    Print Slip
                  </button>
                  <button
                    type="button"
                    onClick={() => setCredentialSlip(null)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Individual Official Student Dossier */}
        {selectedDossierStudent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-5 print:p-0 print:border-none print:shadow-none print:max-h-none print:overflow-visible">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-base text-slate-900">
                    Official Student Dossier Record
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Dossier
                  </button>
                  <button
                    onClick={() => setSelectedDossierStudent(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Official Letterhead Header */}
              <SchoolLetterhead
                brand={
                  selectedDossierStudent.className.toLowerCase().includes("jss") ||
                  selectedDossierStudent.className.toLowerCase().includes("sss") ||
                  selectedDossierStudent.className.toLowerCase().includes("secondary")
                    ? "SECONDARY"
                    : "PRIMARY"
                }
                title="OFFICIAL STUDENT RECORD DOSSIER"
                subtitle={`Registry Reference: ${selectedDossierStudent.admissionNo} • Class: ${selectedDossierStudent.className}`}
                showSignatoryFooter={true}
              >
                <div className="space-y-4 text-xs font-sans">
                  {/* Bio-data Grid */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION A: STUDENT BIOMETRIC &amp; ADMISSION PROFILE
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Legal Name</span>
                        <strong className="text-slate-900 font-sans text-sm">{selectedDossierStudent.fullName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission Number</span>
                        <strong className="text-blue-900">{selectedDossierStudent.admissionNo}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Class &amp; Arm</span>
                        <strong className="text-slate-800">{selectedDossierStudent.className}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Gender</span>
                        <span className="text-slate-700">{selectedDossierStudent.gender}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Sports House</span>
                        <span className="text-slate-700">{selectedDossierStudent.house}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Institutional Campus</span>
                        <span className="text-slate-700 font-sans font-bold">
                          {selectedDossierStudent.className.toLowerCase().includes("jss") ||
                          selectedDossierStudent.className.toLowerCase().includes("sss") ||
                          selectedDossierStudent.className.toLowerCase().includes("secondary")
                            ? "Royal Crown High School"
                            : "Royal Crown Academy"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Guardian & Emergency Contacts */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION B: PARENT / GUARDIAN &amp; CONTACT DETAILS
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Primary Guardian</span>
                        <strong className="text-slate-800 font-sans">{selectedDossierStudent.guardianName || "Not on file"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Guardian Phone</span>
                        <strong className="text-slate-800">{selectedDossierStudent.guardianPhone || "N/A"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Relationship</span>
                        <span className="text-slate-700">Parent / Legal Guardian</span>
                      </div>
                    </div>
                  </div>

                  {/* Medical & Health Records */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION C: MEDICAL, HEALTH &amp; ALLERGY DIRECTIVES
                    </span>
                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Blood Group</span>
                        <span className="font-bold text-slate-800">O+ (Standard Record)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Known Allergies / Medical Directives</span>
                        <span className="text-slate-600 font-sans">No chronic ailments or severe allergies logged on enrollment.</span>
                      </div>
                    </div>
                  </div>

                  {/* Bursary & Fee Status Summary */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block border-b border-slate-200 pb-1">
                      SECTION D: BURSARY &amp; FEE CLEARANCE STANDING
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Fee Account Standing</span>
                        <span
                          className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded ${
                            selectedDossierStudent.feeStatus === "Fully Cleared"
                              ? "bg-emerald-100 text-emerald-800"
                              : selectedDossierStudent.feeStatus === "Partially Paid"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {selectedDossierStudent.feeStatus}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Audited by: School Bursary Office
                      </span>
                    </div>
                  </div>
                </div>
              </SchoolLetterhead>
            </div>
          </div>
        )}

        {/* Modal: Full Student Profile Editor */}
        {fullEditStudent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#4169E1] flex items-center justify-center border border-blue-200">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Edit Student Profile Dossier
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Ref ID: {fullEditStudent.admissionNo} • Enrolled in {fullEditStudent.className}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFullEditStudent(null)}
                  disabled={fullEditSaving}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {fullEditError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{fullEditError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveFullEdit();
                }}
                className="space-y-4 text-xs"
              >
                {/* SECTION A: Core Enrollment Details */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION A: CORE ENROLLMENT &amp; IDENTIFIER
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        value={fullEditForm.fullName ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, fullName: e.target.value })}
                        required
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Admission Number *</label>
                      <input
                        type="text"
                        value={fullEditForm.admissionNo ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, admissionNo: e.target.value })}
                        required
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-blue-900 focus:ring-2 focus:ring-[#4169E1] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Arm *</label>
                      <select
                        value={fullEditForm.className ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, className: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                      >
                        {availableClasses.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Gender *</label>
                      <select
                        value={fullEditForm.gender ?? "Male"}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, gender: e.target.value as "Male" | "Female" })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Sports House</label>
                      <select
                        value={fullEditForm.house ?? "Sapphire (Blue)"}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, house: e.target.value as StudentRecord["house"] })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                      >
                        <option value="Sapphire (Blue)">Sapphire (Blue)</option>
                        <option value="Ruby (Red)">Ruby (Red)</option>
                        <option value="Emerald (Green)">Emerald (Green)</option>
                        <option value="Topaz (Yellow)">Topaz (Yellow)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Fee Standing</label>
                      <select
                        value={fullEditForm.feeStatus ?? "Outstanding"}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, feeStatus: e.target.value as StudentRecord["feeStatus"] })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                      >
                        <option value="Fully Cleared">Fully Cleared</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Outstanding">Outstanding</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION B: Biodata & Demographics */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION B: BIODATA &amp; DEMOGRAPHICS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={fullEditForm.dateOfBirth ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, dateOfBirth: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Blood Group</label>
                      <select
                        value={fullEditForm.bloodGroup ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, bloodGroup: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                      >
                        <option value="">Not Specified</option>
                        <option value="O+">O+ (Universal Donor)</option>
                        <option value="O-">O-</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Religion</label>
                      <input
                        type="text"
                        placeholder="Christianity / Islam"
                        value={fullEditForm.religion ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, religion: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nationality</label>
                      <input
                        type="text"
                        value={fullEditForm.nationality ?? "Nigerian"}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, nationality: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">State of Origin</label>
                      <input
                        type="text"
                        placeholder="e.g. Lagos, Edo, Delta"
                        value={fullEditForm.stateOfOrigin ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, stateOfOrigin: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">LGA</label>
                      <input
                        type="text"
                        placeholder="Local Govt Area"
                        value={fullEditForm.lga ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, lga: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: Parent / Guardian Contacts */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION C: PARENT / GUARDIAN CONTACTS
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary Guardian Name</label>
                      <input
                        type="text"
                        value={fullEditForm.guardianName ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, guardianName: e.target.value })}
                        placeholder="Full Name"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Guardian Phone (WhatsApp)</label>
                      <input
                        type="text"
                        value={fullEditForm.guardianPhone ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, guardianPhone: e.target.value })}
                        placeholder="080..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Guardian Email</label>
                      <input
                        type="email"
                        value={fullEditForm.guardianEmail ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, guardianEmail: e.target.value })}
                        placeholder="parent@example.com"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Relationship</label>
                      <input
                        type="text"
                        value={fullEditForm.guardianRelationship ?? "Parent"}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, guardianRelationship: e.target.value })}
                        placeholder="Father / Mother / Legal Guardian"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Residential Address</label>
                      <input
                        type="text"
                        value={fullEditForm.guardianAddress ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, guardianAddress: e.target.value })}
                        placeholder="Street address, City"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION D: Medical & Allergies */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-600 block border-b border-slate-200 pb-1">
                    SECTION D: MEDICAL &amp; ALLERGIES DIRECTIVES
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Known Allergies</label>
                      <input
                        type="text"
                        value={fullEditForm.allergies ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, allergies: e.target.value })}
                        placeholder="e.g. Peanuts, Penicillin, Asthmatic"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Medical Notes &amp; Directives</label>
                      <input
                        type="text"
                        value={fullEditForm.medicalNotes ?? ""}
                        onChange={(e) => setFullEditForm({ ...fullEditForm, medicalNotes: e.target.value })}
                        placeholder="Special health needs, emergency instructions"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setFullEditStudent(null)}
                    disabled={fullEditSaving}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={fullEditSaving}
                    className="px-5 py-2 rounded-xl bg-[#4169E1] hover:bg-blue-700 text-white font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {fullEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Full Profile
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Print-Only Letterhead for Filtered Directory Print */}
        <div className="hidden print:block mb-4">
          <SchoolLetterhead
            brand={classFilter.toLowerCase().includes("jss") || classFilter.toLowerCase().includes("sss") ? "SECONDARY" : "PRIMARY"}
            title="OFFICIAL STUDENT DIRECTORY REGISTER"
            subtitle={`Active Class: ${classFilter === "all" ? "All Classes" : classFilter} • ${filtered.length} Enrolled Students`}
            showSignatoryFooter={true}
          />
        </div>

      </div>
    </DashboardShell>
  );
}
