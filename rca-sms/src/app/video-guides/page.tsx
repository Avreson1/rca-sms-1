"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth } from "@/lib/realtime-store";
import {
  BookOpen,
  ArrowLeft,
  Printer,
  Search,
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  Users,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  School,
  Lock,
  Download,
  FileText,
  Sliders,
  Sparkles,
  ShieldAlert,
  UserCheck,
  Laptop,
} from "lucide-react";

export interface SOPItem {
  id: string;
  code: string;
  title: string;
  role: string;
  category: "Super Admin" | "Exam Officer" | "Faculty / Teacher" | "Accounts / Bursary" | "Administrative" | "Parent / Student";
  badgeColor: string;
  summary: string;
  prerequisites: string[];
  procedureSteps: string[];
  safetyRules: string[];
  expectedOutput: string;
  minRoleTier?: "SUPER_ADMIN" | "EXAM_OFFICER" | "TEACHER" | "ACCOUNTANT" | "STUDENT_PARENT";
}

const SOP_MANUAL_DATA: SOPItem[] = [
  // 1. Super Admin
  {
    id: "sop-1-1",
    code: "SOP-ADM-001",
    title: "Academic Session Initialization & Term Calendar Configuration",
    role: "Super Administrator / Principal",
    category: "Super Admin",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    minRoleTier: "SUPER_ADMIN",
    summary: "Standard protocol for setting up a new academic session, defining term duration dates, and initializing termly events on the dynamic calendar.",
    prerequisites: [
      "Super Admin login credentials (dominic370 / RCA/PERS/025)",
      "Approved academic year calendar from the Ministry of Education & Board of Governors",
    ],
    procedureSteps: [
      "Navigate to Setup → Calendar (/setup/calendar).",
      "Verify the current Academic Session (e.g., 2026/2027) and select the active term.",
      "Click 'Add Event' or 'Populate Standard 12-Week Term' to initialize key milestones (Resumption, Mid-Term Break, CA Testing Windows, Revision, Terminal Examinations, Vacation).",
      "Ensure all holiday and examination dates are published with appropriate event category badges.",
      "Verify that the calendar status badge reflects 'Realtime Data Sync Active'.",
    ],
    safetyRules: [
      "Never alter vacation or examination dates mid-term without written authorization from the Principal.",
      "Session changes affect active student billing schedules across all arms.",
    ],
    expectedOutput: "A fully populated, synchronized 12-week academic calendar visible across all faculty dashboards.",
  },
  {
    id: "sop-1-2",
    code: "SOP-ADM-002",
    title: "Staff Onboarding, Role Provisioning & Granular Permission Governance",
    role: "Super Administrator / Principal",
    category: "Super Admin",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    minRoleTier: "SUPER_ADMIN",
    summary: "Procedure for registering academic and non-academic staff members and configuring granular CRUD and edit permissions.",
    prerequisites: [
      "Complete employee bio-data, academic qualifications, and departmental designation",
      "Assigned system role (Principal, Vice Principal, Dean of Studies, Form Master, Subject Teacher, Bursar, Admin)",
    ],
    procedureSteps: [
      "Navigate to Operations → Staff Management (/operations/staff).",
      "Click '+ Register Staff' to open the registration modal.",
      "Enter Full Legal Name, Staff ID (e.g. RCA/PERS/026), Email, Phone, Role, and Assigned Subject/Class Arm.",
      "Configure 'Granular Staff Permissions & Edit Access': toggle 'Can Edit Scores', 'Can Edit Fees', 'Can Publish Results', 'Can Edit Students'.",
      "Click 'Register & Grant Permissions' → Generate Private Access Memo with temporary passcode.",
      "Distribute access memo out-of-band via WhatsApp or printed memo (credentials never displayed on public login screen).",
    ],
    safetyRules: [
      "Only the Super Admin and Dean of Studies may be granted 'Can Publish Results' privileges.",
      "Immediately revoke edit permissions upon staff reassignment or exit.",
    ],
    expectedOutput: "A secured staff profile with verified role badges and private out-of-band credential distribution.",
  },
  {
    id: "sop-1-3",
    code: "SOP-ADM-003",
    title: "Zero-Start Database Baseline Purge & Production Initialization",
    role: "Super Administrator",
    category: "Super Admin",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    minRoleTier: "SUPER_ADMIN",
    summary: "Safety protocol for purging all mock/demo records when transitioning from trial to live production environment.",
    prerequisites: [
      "Super Administrator physical presence & confirmation",
      "Backups of any historical CSV sheets required for archival",
    ],
    procedureSteps: [
      "Navigate to Settings (/settings).",
      "Locate the 'Live Data Store & Database Initialization' panel.",
      "Click 'Purge All Demo Data (Start 100% Clean)'.",
      "Read the browser confirmation prompt carefully and confirm deletion.",
      "Verify student count (0), staff list (only Super Admin active), class registers, timetables, and financial ledgers reset to zero baseline.",
    ],
    safetyRules: [
      "Purge is irreversible. Ensure live student CSV templates are prepared before wiping test registers.",
    ],
    expectedOutput: "A pristine 100% empty production database with only authorized accounts active.",
  },

  // 2. Exam Officer
  {
    id: "sop-2-1",
    code: "SOP-EXM-001",
    title: "Continuous Assessment (CA) Tier Structures & Score Weight Configuration",
    role: "Exam Officer / Dean of Studies",
    category: "Exam Officer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    minRoleTier: "EXAM_OFFICER",
    summary: "Protocol for configuring approved CA structures across Play, Nursery, Primary, and Secondary tiers with max score assignments.",
    prerequisites: [
      "Approved institutional CA weight formula from Academic Board",
      "Access to Setup → CA Structure (/setup/ca-structure) & Setup → Grading (/setup/grading)",
    ],
    procedureSteps: [
      "Navigate to Setup → CA Structure (/setup/ca-structure).",
      "Review the 4 primary institutional tiers: Play & Preschool (Exam 100), Nursery 1 & 2 (4 CA + Exam 60), Primary 1–5 (4 CA + Internal 30 + External 30), and Secondary JSS/SS (4 CA + CBT/Exam 60).",
      "Click 'Edit Scores' on any component to adjust max score caps or weights.",
      "Navigate to Setup → Grading (/setup/grading) to review the approved Universal A–F Scale (A: 70-100, B: 60-69, C: 50-59, D: 45-49 Pass Mark, F: 0-44).",
      "Save changes to synchronize score calculation engines across all teacher gradebooks.",
    ],
    safetyRules: [
      "CA max score weights must not be modified after the commencement of 2nd CA test window.",
    ],
    expectedOutput: "Uniform grade calculation across all institutional gradebooks and automated broadsheets.",
  },
  {
    id: "sop-2-2",
    code: "SOP-EXM-002",
    title: "Universal Terminal Results Publication & Gradebook Lockdown",
    role: "Exam Officer / Dean of Studies",
    category: "Exam Officer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    minRoleTier: "EXAM_OFFICER",
    summary: "Step-by-step procedure to review terminal broadsheets, publish results institution-wide, and lock gradebooks against post-exam tampering.",
    prerequisites: [
      "100% submission of CA scores and examination marks from all subject teachers",
      "Affective and psychomotor domain trait ratings recorded by Form Masters",
    ],
    procedureSteps: [
      "Navigate to Operations → Publish Results (/operations/publish-results).",
      "Review class-by-class submission metrics (Enrolled, Scores Entered, Traits Completed, Fees Cleared).",
      "Click 'Publish All Class Results' to make scorecards accessible to parents and students.",
      "Click 'Lock All Gradebooks' to permanently freeze mark editing across all teacher accounts.",
      "Verify confirmation banner: 'Institution Status: 100% Published & Locked'.",
    ],
    safetyRules: [
      "If a score rectification is required after locking, the Exam Officer must manually unlock the specific class arm and log the audit reason.",
    ],
    expectedOutput: "Locked, tamper-proof terminal results and authorized parent scorecard access.",
  },

  // 3. Faculty / Teacher
  {
    id: "sop-3-1",
    code: "SOP-TCH-001",
    title: "Continuous Assessment (CA) Marks Entry & Local Gradebook Verification",
    role: "Subject Teacher / Form Master",
    category: "Faculty / Teacher",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    minRoleTier: "TEACHER",
    summary: "Standard routine for capturing 1st Assessment, 2nd Assessment, 1st CAT, 2nd CAT, and Terminal Exam scores directly or via CSV import.",
    prerequisites: [
      "Active Subject Teacher account with edit permissions",
      "Assigned classroom arm (e.g. Primary 4, JSS 2, SS 1)",
    ],
    procedureSteps: [
      "Navigate to Operations → Update CA (/operations/update-ca).",
      "The workspace automatically defaults to your assigned class and subject.",
      "For individual entry: Input numerical scores into the grid fields (inputs clamp automatically to tier limits).",
      "For batch CSV upload: Click 'Upload Scores CSV' → select populated spreadsheet → verify preview → click 'Import Score Records Now'.",
      "Review the dynamic tier grade and remark automatically computed for each student.",
      "Click 'Save & Sync Scores' to commit records to the real-time store.",
    ],
    safetyRules: [
      "Do not enter exam scores before verifying CBT/theory moderation results.",
      "Double-check that total scores do not exceed 100 marks.",
    ],
    expectedOutput: "Synchronized student scorecards with real-time class averages, pass rates, and automated WAEC/Primary grades.",
  },
  {
    id: "sop-3-2",
    code: "SOP-TCH-002",
    title: "Psychomotor & Affective Behavioral Domain Assessment (1-5 Scale)",
    role: "Form Master / Class Teacher",
    category: "Faculty / Teacher",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    minRoleTier: "TEACHER",
    summary: "Guidelines for rating pupil behavioral traits, social skills, and psychomotor proficiencies using the Nigerian standard 5-point observational rubric.",
    prerequisites: [
      "Form Master designation for the respective class arm",
      "Observational tracking records over the 12-week term",
    ],
    procedureSteps: [
      "Navigate to Operations → Traits Assessments (/operations/traits-assessments).",
      "Select your Form Class Arm and Academic Term.",
      "Review the Psychomotor & Affective Domain Rating Rubric: 5 = Excellent, 4 = Good, 3 = Fair, 2 = Poor, 1 = Very Poor.",
      "Evaluate traits across standard clusters: Punctuality, Neatness, Politeness, Honesty, Leadership, Handwriting, Sports & Games, Craft & Manual Skills.",
      "Select or type personalized Form Teacher's Remarks (e.g. 'An outstanding performance with exceptional leadership in class activities').",
      "Click 'Save & Synchronize Assessments' to link traits to terminal scorecards.",
    ],
    safetyRules: [
      "Assessments must be objective and reflect constructive behavioral feedback.",
    ],
    expectedOutput: "Complete psychomotor ratings and narrative evaluation attached to terminal scorecards.",
  },
  {
    id: "sop-3-3",
    code: "SOP-TCH-003",
    title: "Class Score Card Inspection & Dossier Compilation",
    role: "Form Master / Teacher",
    category: "Faculty / Teacher",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    minRoleTier: "TEACHER",
    summary: "Procedure for reviewing assigned class scorecards, checking term breakdown or 3-term cumulative dossier, and preparing for terminal publication.",
    prerequisites: [
      "All subject CA scores verified for assigned class",
      "Psychomotor domain ratings completed",
    ],
    procedureSteps: [
      "Navigate to Operations → Score Card (/operations/score-card).",
      "Your assigned class is automatically pre-selected by the RBAC boundary.",
      "Toggle between 'Single Term' and '3-Term Cumulative' to inspect progress.",
      "Review subject breakdown, grade points, term average, class position, and attached newsletter circular.",
      "Ensure all pupils have verified marks before notifying the Exam Officer for result publishing.",
    ],
    safetyRules: [
      "Teachers cannot modify published results once the Exam Officer locks the gradebook.",
    ],
    expectedOutput: "Accurate, verified class terminal dossiers ready for institutional release.",
  },

  // 4. Accounts / Bursary
  {
    id: "sop-4-1",
    code: "SOP-ACC-001",
    title: "Itemized School Fees Structure & Student Billing Schedule",
    role: "Bursar / Accounts Officer",
    category: "Accounts / Bursary",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    minRoleTier: "ACCOUNTANT",
    summary: "Standard procedure for establishing termly fee components (Tuition, Development, ICT, Uniforms) and generating term invoices.",
    prerequisites: [
      "Approved fee schedule from School Management",
      "Active student register across all class arms",
    ],
    procedureSteps: [
      "Navigate to Setup → Fees (/setup/fees).",
      "Review and configure itemized fee components by class tier (e.g. Tuition, ICT Levy, Development Levy).",
      "Click 'Save & Sync Fees' to compute total mandatory term billing.",
      "Navigate to Accounts → Invoicing (/accounts/invoicing).",
      "Click 'Generate Term Invoices' to batch-create invoices for all enrolled students.",
    ],
    safetyRules: [
      "Fee component edits must not be applied without prior formal circular dispatched to parents.",
    ],
    expectedOutput: "Itemized billing ledgers for every student in the active school register.",
  },
  {
    id: "sop-4-2",
    code: "SOP-ACC-002",
    title: "Payment Reconciliation, Partial Billing & Instant Computerized Receipts",
    role: "Bursar / Accounts Officer",
    category: "Accounts / Bursary",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    minRoleTier: "ACCOUNTANT",
    summary: "Protocol for recording bank deposit tellers, POS transactions, cash payments, updating fee status, and generating printable receipts.",
    prerequisites: [
      "Valid bank payment teller, transfer receipt, or POS transaction slip",
      "Student Admission Number or Full Legal Name",
    ],
    procedureSteps: [
      "Navigate to Accounts → Invoicing (/accounts/invoicing).",
      "Search student by Name or Admission Number.",
      "Click 'Record Payment' → enter Amount Paid (₦), Payment Method (Bank Transfer, Cash, POS), and Reference/Teller No.",
      "The system updates the Fee Status ('Fully Cleared', 'Partially Paid', 'Outstanding') and computes remaining balance.",
      "Click 'Print Receipt' to generate the official Royal Crown Academy computerized fee receipt with security serial.",
    ],
    safetyRules: [
      "Never issue a manual receipt without logging the electronic transaction in the portal.",
    ],
    expectedOutput: "Immediate payment receipt generation and automated clearance flag update on the student scorecard.",
  },

  // 5. Administrative / Admissions
  {
    id: "sop-5-1",
    code: "SOP-ADM-004",
    title: "Student Direct Admission & Batch CSV Ingestion Protocol",
    role: "Admissions Officer / Administrative Secretary",
    category: "Administrative",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    minRoleTier: "EXAM_OFFICER",
    summary: "Procedure for registering new intakes, assigning admission numbers, allocating single secondary streams (JSS 1-3, SS 1-3), and batch importing CSV files.",
    prerequisites: [
      "Completed Student Bio-data form, medical report, and parent/guardian contact details",
      "Designated sports house (Sapphire, Ruby, Emerald, Topaz)",
    ],
    procedureSteps: [
      "Navigate to Operations → Students (/operations/students).",
      "For Single Student: Click 'Admit Student' → fill Full Name, Assign Class, Gender, Guardian Name, Phone, and Sports House → click 'Enroll Student'.",
      "For Bulk Enrollment: Click 'CSV Template' to download standard template → fill offline → click 'Bulk Upload CSV' → select file → verify preview → click 'Import Students Now'.",
      "Verify automatic sequential Admission Number generation (e.g. RCA/2026/001).",
    ],
    safetyRules: [
      "Validate parent phone numbers to ensure emergency SMS broadcasts reach active guardians.",
      "Ensure secondary classes strictly use unified single streams: JSS 1, JSS 2, JSS 3, SS 1, SS 2, SS 3.",
    ],
    expectedOutput: "Registered student bio-data synchronized with class registers, attendance, and bursary billing lists.",
  },

  // 6. Parent / Student (Tier 5)
  {
    id: "sop-6-1",
    code: "SOP-PAR-001",
    title: "Accessing Terminal Scorecards, Continuous Assessment Records & Cumulative Dossiers",
    role: "Parent / Guardian / Student",
    category: "Parent / Student",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    minRoleTier: "STUDENT_PARENT",
    summary: "Step-by-step guidance for parents and students to securely view released terminal scorecards, download printable A4 dossiers, and inspect 3-term cumulative progress.",
    prerequisites: [
      "Authorized Parent/Student Login Passcode (issued privately via out-of-band slip)",
      "Fee clearance status in good standing",
    ],
    procedureSteps: [
      "Log in to the portal via /login using your authorized guardian username or ward's admission number.",
      "From your dashboard, click 'View Official Score Cards' or navigate to Operations → Score Card (/operations/score-card).",
      "Your ward's scorecard is automatically displayed with their official bio-data, subject CA breakdown (Test 1, Test 2, Project, Mid-Term), Exam mark, Total (100), and Tier Grade.",
      "Inspect the Psychomotor & Affective Domain ratings (Punctuality, Politeness, Handwriting, Leadership) and Form Teacher & Principal remarks.",
      "Toggle '3-Term Cumulative Annual' to review whole-year academic standing and promotion confirmation.",
      "Click 'Print Official Report Card' to generate a clean A4 PDF dossier complete with attached End-of-Term Newsletter.",
    ],
    safetyRules: [
      "Do not share your parent access passcode with unauthorized third parties.",
      "If tuition is outstanding, contact the Bursary Office to obtain electronic fee clearance.",
    ],
    expectedOutput: "Instant, transparent access to authenticated terminal report cards and official circulars.",
  },
  {
    id: "sop-6-2",
    code: "SOP-PAR-002",
    title: "Taking Online Computer-Based Tests (CBT), Timed Assessments & Answer Submission",
    role: "Student / Candidate",
    category: "Parent / Student",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    minRoleTier: "STUDENT_PARENT",
    summary: "Standard instructions for students taking continuous assessment tests or terminal examinations on the integrated CBT examination engine.",
    prerequisites: [
      "Active CBT examination schedule published by the Dean of Studies",
      "Authorized student portal session with CBT clearance flag",
    ],
    procedureSteps: [
      "Navigate to the CBT Portal (/cbt) from the main menu.",
      "Select your assigned subject test from the active assessment list.",
      "Read the examination guidelines, time limit (e.g. 45 minutes), and question count carefully.",
      "Click 'Start Examination' → answer each multiple-choice question by selecting your choice (A, B, C, D).",
      "Use the Question Navigator grid to jump between answered and unanswered items.",
      "Upon completion, click 'Submit Examination' and confirm final submission.",
      "View your instant computer-graded score and review performance breakdown.",
    ],
    safetyRules: [
      "Do not refresh the browser or open external tabs during active CBT sessions to prevent automatic session disqualification.",
    ],
    expectedOutput: "Accurate, instant CBT score recording directly synchronized with your continuous assessment gradebook.",
  },
  {
    id: "sop-6-3",
    code: "SOP-PAR-003",
    title: "Checking Termly Fee Invoices, Bank Payment Details & Inmail Desks",
    role: "Parent / Guardian",
    category: "Parent / Student",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    minRoleTier: "STUDENT_PARENT",
    summary: "Procedure for checking termly tuition invoices, obtaining official school bank account details, and communicating with school administrators via Inmail.",
    prerequisites: [
      "Authorized Parent Portal account",
    ],
    procedureSteps: [
      "Navigate to Accounts → Invoicing (/accounts/invoicing) to inspect your ward's itemized fee invoice.",
      "Review tuition breakdown, development levies, ICT fees, and current payment status ('Fully Cleared', 'Outstanding').",
      "Obtain the official Royal Crown Academy bank details (GTBank / Account: 0123456789) from the invoice or attached newsletter.",
      "To send enquiries to the Form Teacher, Bursar, or Principal, navigate to Inmail Desk (/inmail) → click 'Compose Message' → select recipient.",
      "Verify replies in your Inmail inbox for official school administrative updates.",
    ],
    safetyRules: [
      "Always verify school bank details against the official circular before executing wire transfers.",
    ],
    expectedOutput: "Accurate billing transparency, payment tracking, and secure direct communication with school faculty.",
  },
];

// Role-to-permitted-categories mapping
const ROLE_ALLOWED_SOP_CATEGORIES: Record<string, string[]> = {
  SUPER_ADMIN: ["all", "Super Admin", "Exam Officer", "Faculty / Teacher", "Accounts / Bursary", "Administrative", "Parent / Student"],
  EXAM_OFFICER: ["all", "Exam Officer", "Faculty / Teacher", "Administrative", "Parent / Student"],
  TEACHER: ["all", "Faculty / Teacher", "Exam Officer", "Parent / Student"],
  ACCOUNTANT: ["all", "Accounts / Bursary", "Administrative", "Parent / Student"],
  STUDENT_PARENT: ["all", "Parent / Student"],
};

export default function SOPManualPage() {
  const { currentUser } = useRealtimeAuth();
  const currentRole = currentUser?.role || "SUPER_ADMIN";

  const allowedCategories = useMemo(() => {
    return ROLE_ALLOWED_SOP_CATEGORIES[currentRole] || ROLE_ALLOWED_SOP_CATEGORIES.SUPER_ADMIN;
  }, [currentRole]);

  // Default initial category based on user's role
  const defaultCategory = useMemo(() => {
    if (currentRole === "STUDENT_PARENT") return "Parent / Student";
    if (currentRole === "TEACHER") return "Faculty / Teacher";
    if (currentRole === "ACCOUNTANT") return "Accounts / Bursary";
    if (currentRole === "EXAM_OFFICER") return "Exam Officer";
    return "all";
  }, [currentRole]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [expandedSOP, setExpandedSOP] = useState<Record<string, boolean>>({
    "sop-1-1": true,
    "sop-2-1": true,
    "sop-3-1": true,
    "sop-6-1": true,
  });

  // Filter SOP list strictly by allowed categories for this role + search query
  const filteredSOPs = useMemo(() => {
    return SOP_MANUAL_DATA.filter((sop) => {
      // Role permission check: User can only see categories allowed for their role
      const isCategoryPermitted = allowedCategories.includes(sop.category);
      if (!isCategoryPermitted) return false;

      // Filter by selected dropdown category
      const matchesCat = selectedCategory === "all" || sop.category === selectedCategory;

      // Filter by search term
      const matchesSearch =
        sop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sop.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sop.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sop.role.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCat && matchesSearch;
    });
  }, [allowedCategories, selectedCategory, searchQuery]);

  const toggleSOP = (id: string) => {
    setExpandedSOP((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    filteredSOPs.forEach((s) => (all[s.id] = true));
    setExpandedSOP(all);
  };

  const collapseAll = () => {
    setExpandedSOP({});
  };

  const handlePrintManual = () => {
    expandAll();
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return { label: "Tier 1: Master Executive SOP Clearance", color: "bg-purple-100 text-purple-800 border-purple-300" };
      case "EXAM_OFFICER":
        return { label: "Tier 2: Academic & Exam Moderation SOP Clearance", color: "bg-blue-100 text-blue-800 border-blue-300" };
      case "TEACHER":
        return { label: "Tier 3: Faculty & Teaching Staff SOP Clearance", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
      case "ACCOUNTANT":
        return { label: "Tier 4: Bursary & Financial Ledgers SOP Clearance", color: "bg-amber-100 text-amber-800 border-amber-300" };
      case "STUDENT_PARENT":
        return { label: "Tier 5: Student & Parent Guardian Helpdesk", color: "bg-sky-100 text-sky-800 border-sky-200" };
      default:
        return { label: "Standard Staff Clearance", color: "bg-slate-100 text-slate-800 border-slate-300" };
    }
  };

  const roleBadge = getRoleBadge(currentRole);

  return (
    <DashboardShell>
      <div className="space-y-6">
        
        {/* Header - Screen View */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Documentation</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">SOP Manual</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Standard Operating Procedures (SOP) Manual
              </h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadge.color} flex items-center gap-1`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {roleBadge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Role-scoped standard operating procedures, compliance rules, and operational checklists for {SCHOOL_INFO.name}.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Collapse All
            </button>
            <button
              onClick={handlePrintManual}
              className="px-4 py-2 text-xs font-bold bg-[#0000FF] hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Download / Print Manual (PDF)
            </button>
          </div>
        </div>

        {/* RBAC Role Clearance Notice Banner */}
        <div className="bg-gradient-to-r from-blue-50/80 via-cyan-50/40 to-slate-50 border border-blue-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0000FF] text-white flex items-center justify-center font-bold shadow-sm">
              <UserCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Active Role Workspace: <strong className="text-[#0000FF]">{currentUser?.fullName || "Authorized User"}</strong> ({currentRole})
              </p>
              <p className="text-[11px] text-slate-600">
                Displaying {filteredSOPs.length} standard operating procedure(s) authorized for your security clearance level.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600">
            RBAC Enforced
          </span>
        </div>

        {/* Search & Role Filter Bar - Screen View */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search authorized SOP title, code (e.g. SOP-ADM-001, SOP-PAR-001), keyword, or procedure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-[#0000FF] focus:outline-hidden cursor-pointer"
            >
              {allowedCategories.includes("all") && (
                <option value="all">All Authorized Categories ({allowedCategories.length - 1} Tiers)</option>
              )}
              {allowedCategories.includes("Super Admin") && (
                <option value="Super Admin">Tier 1: Super Administrator / Principal</option>
              )}
              {allowedCategories.includes("Exam Officer") && (
                <option value="Exam Officer">Tier 2: Exam Officer / Dean of Studies</option>
              )}
              {allowedCategories.includes("Faculty / Teacher") && (
                <option value="Faculty / Teacher">Tier 3: Faculty / Subject &amp; Form Teachers</option>
              )}
              {allowedCategories.includes("Accounts / Bursary") && (
                <option value="Accounts / Bursary">Tier 4: Accounts / Bursary &amp; Finance</option>
              )}
              {allowedCategories.includes("Administrative") && (
                <option value="Administrative">Admissions &amp; Administrative</option>
              )}
              {allowedCategories.includes("Parent / Student") && (
                <option value="Parent / Student">Tier 5: Student &amp; Parent Guardian</option>
              )}
            </select>
          </div>
        </div>

        {/* Printable Manual Header - Print View Only */}
        <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-black uppercase text-slate-900">{SCHOOL_INFO.name}</h1>
          <p className="text-xs font-semibold text-slate-600">{SCHOOL_INFO.address}</p>
          <p className="text-xs font-bold text-slate-800 mt-1 uppercase tracking-wider">
            INSTITUTIONAL STANDARD OPERATING PROCEDURE (SOP) MANUAL • {SCHOOL_INFO.currentSession}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Clearance Level: {roleBadge.label} • Authorized User: {currentUser?.fullName || "Staff Member"}
          </p>
        </div>

        {/* SOP Cards Accordion List */}
        <div className="space-y-4">
          {filteredSOPs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-base text-slate-800">No Matching Standard Operating Procedures</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No SOPs matched your active filter or search query. Adjust your category selector or clear search terms.
              </p>
            </div>
          ) : (
            filteredSOPs.map((sop) => {
              const isExpanded = !!expandedSOP[sop.id];

              return (
                <div
                  key={sop.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-blue-300 print:border-slate-300 print:shadow-none print:break-inside-avoid"
                >
                  {/* Card Title Header / Accordion Trigger */}
                  <div
                    onClick={() => toggleSOP(sop.id)}
                    className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors print:bg-white"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md border border-slate-300">
                          {sop.code}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${sop.badgeColor}`}>
                          {sop.category}
                        </span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="text-xs font-semibold text-slate-600">{sop.role}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {sop.title}
                      </h3>

                      <p className="text-xs text-slate-600 leading-relaxed pr-2">
                        {sop.summary}
                      </p>
                    </div>

                    <div className="pt-1 flex-shrink-0 print:hidden">
                      {isExpanded ? (
                        <div className="p-1 rounded-lg bg-blue-50 text-[#0000FF]">
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-lg bg-slate-100 text-slate-500">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded SOP Details */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100 bg-white space-y-5 text-xs">
                      {/* Prerequisites */}
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          Prerequisites &amp; Authorization Requirements
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          {sop.prerequisites.map((req, i) => (
                            <li key={i} className="leading-relaxed">
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Step-by-step Procedure */}
                      <div>
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          Standard Operating Procedure (Execution Steps)
                        </h4>
                        <ol className="space-y-2 text-slate-800">
                          {sop.procedureSteps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5 leading-relaxed bg-white border border-slate-100 p-2.5 rounded-lg shadow-2xs">
                              <span className="w-5 h-5 rounded-full bg-[#0000FF] text-white font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                                {i + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Safety & Compliance Rules */}
                      {sop.safetyRules && sop.safetyRules.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-950 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider text-[#FF0000]">
                            <AlertTriangle className="w-4 h-4 text-[#FF0000]" />
                            Institutional Safety, Audit &amp; Compliance Rules
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-red-900 text-[11px]">
                            {sop.safetyRules.map((rule, i) => (
                              <li key={i}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Expected Deliverable / Output */}
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 font-medium">
                        <Sparkles className="w-4 h-4 text-[#0000FF] flex-shrink-0" />
                        <div>
                          <strong className="text-[#0000FF] font-bold">Expected Output: </strong>
                          <span className="text-blue-900">{sop.expectedOutput}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
