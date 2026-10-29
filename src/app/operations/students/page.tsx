"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeStudents, useRealtimeClasses, StudentRecord } from "@/lib/realtime-store";
import { ALL_CLASSES } from "@/lib/constants";
import { exportToCSV, parseCSV, downloadSampleTemplate } from "@/lib/csv-utils";
import {
  Users,
  Search,
  Filter,
  Plus,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowLeft,
  School,
  AlertCircle,
  FileDown,
} from "lucide-react";

export default function StudentsPage() {
  const { students, addStudent, bulkAddStudents, deleteStudent } = useRealtimeStudents();
  const { classes } = useRealtimeClasses();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all");
  
  // Available classes dynamically
  const availableClasses = classes.length > 0 ? classes.map((c) => c.name) : ALL_CLASSES;

  // Single Admission Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState(availableClasses[0] || "Primary 1");
  const [newGender, setNewGender] = useState<"Male" | "Female">("Female");
  const [newGuardian, setNewGuardian] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newHouse, setNewHouse] = useState<any>("Sapphire (Blue)");

  // CSV Bulk Upload Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addStudent({
      fullName: newName,
      className: newClass,
      gender: newGender,
      guardianName: newGuardian || "Not Specified",
      guardianPhone: newPhone || "N/A",
      house: newHouse,
    });

    setIsModalOpen(false);
    setNewName("");
    setNewGuardian("");
    setNewPhone("");
  };

  // CSV File Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsedRows = parseCSV(text);
      
      if (parsedRows.length < 2) {
        setUploadStatus("Error: CSV file must contain at least a header row and 1 data row.");
        return;
      }

      // Skip header row and extract preview
      const dataRows = parsedRows.slice(1);
      const studentObjects = dataRows.map((cols) => ({
        fullName: cols[0] || "Unnamed Pupil",
        className: cols[1] || "Primary 1",
        gender: (cols[2]?.toLowerCase().includes("male") && !cols[2]?.toLowerCase().includes("female") ? "Male" : "Female") as "Male" | "Female",
        guardianName: cols[3] || "Parent / Guardian",
        guardianPhone: cols[4] || "N/A",
        house: (cols[5] || "Sapphire (Blue)") as any,
        feeStatus: (cols[6] || "Outstanding") as any,
      }));

      setCsvPreview(studentObjects);
      setUploadStatus(`Parsed ${studentObjects.length} student records ready to ingest.`);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvUpload = () => {
    if (csvPreview.length === 0) return;
    const count = bulkAddStudents(csvPreview);
    setUploadStatus(`Successfully enrolled ${count} students in bulk!`);
    setTimeout(() => {
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      setUploadStatus(null);
    }, 1500);
  };

  // Export filtered or full roster to CSV
  const handleExportCSV = () => {
    const headers = [
      "Admission No",
      "Full Name",
      "Class Level",
      "Gender",
      "Sports House",
      "Parent/Guardian",
      "Phone Number",
      "Fee Status",
      "1st Test (10)",
      "2nd Test (10)",
      "Project (10)",
      "Mid-Term (10)",
      "Exam (60)",
      "Total CA Score (100)",
    ];

    const rows = filtered.map((s) => {
      const total = s.caScores.test1 + s.caScores.test2 + s.caScores.project + s.caScores.midTerm + s.caScores.exam;
      return [
        s.admissionNo,
        s.fullName,
        s.className,
        s.gender,
        s.house,
        s.guardianName || "N/A",
        s.guardianPhone || "N/A",
        s.feeStatus,
        s.caScores.test1,
        s.caScores.test2,
        s.caScores.project,
        s.caScores.midTerm,
        s.caScores.exam,
        total,
      ];
    });

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
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Operations</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Student Directory</span>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Student Records &amp; Enrollment
              </h1>
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Realtime Data Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage student bio-data across **Pre-Play Class**, **Play Class**, **Nursery 1-2**, **Primary 1-5**, and Secondary tiers.
            </p>
          </div>

          {/* Action Buttons: Single, CSV Upload, and CSV Export */}
          <div className="flex items-center gap-2 flex-wrap">
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
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Admit Student
            </button>
          </div>
        </div>

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
                {filtered.map((s) => (
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
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                        s.feeStatus === "Fully Cleared"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.feeStatus === "Partially Paid"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {s.feeStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href="/operations/update-ca"
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px]"
                        >
                          Gradebook
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${s.fullName} from enrollment records?`)) {
                              deleteStudent(s.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Bulk CSV Upload */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full border shadow-xl p-6 space-y-4">
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
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
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
                      disabled={csvPreview.length === 0}
                      onClick={handleConfirmCsvUpload}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
                    >
                      Import {csvPreview.length} Students Now
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
            <div className="bg-white rounded-2xl max-w-lg w-full border shadow-xl p-6 space-y-4">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Class Arm</label>
                    <select
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    >
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
                      onChange={(e) => setNewGender(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                    onChange={(e) => setNewHouse(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                  >
                    <option value="Sapphire (Blue)">Sapphire (Blue)</option>
                    <option value="Ruby (Red)">Ruby (Red)</option>
                    <option value="Emerald (Green)">Emerald (Green)</option>
                    <option value="Topaz (Yellow)">Topaz (Yellow)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                  >
                    Enroll Student
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
