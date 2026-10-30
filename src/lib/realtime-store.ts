"use client";

import { useState, useEffect } from "react";
import { SCHOOL_INFO, ROLES, RBAC_STEPS } from "./constants";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";
import {
  fetchStudentsFromSupabase,
  fetchStaffFromSupabase,
  fetchInvoicesFromSupabase,
  fetchGradingTiersFromSupabase,
  insertStudentToSupabase,
  bulkInsertStudentsToSupabase,
  insertStaffToSupabase,
} from "./supabase/db";

// Channel for instant multi-tab & multi-window event synchronization
const CHANNEL_NAME = "rca_vcs_realtime_channel";

// Keys for persistence
const STORAGE_KEYS = {
  STUDENTS: "rca_students_store_v6",
  STAFF: "rca_staff_store_v6",
  SUBJECTS: "rca_subjects_store_v6",
  SUBJECT_SCORES: "rca_subject_scores_store_v6",
  PSYCHOMOTOR: "rca_psychomotor_store_v6",
  TRAITS: "rca_traits_store_v6",
  CLASSES: "rca_classes_store_v6",
  SUBJECT_TEMPLATES: "rca_subject_templates_store_v6",
  INVOICES: "rca_invoices_store_v6",
  FEES: "rca_fees_store_v6",
  CBT_QUESTIONS: "rca_cbt_questions_store_v6",
  CALENDAR: "rca_calendar_store_v6",
  INMAIL: "rca_inmail_store_v6",
  NEWSLETTER: "rca_newsletter_store_v6",
  GRADING_SCALES: "rca_grading_scales_store_v6",
  ACTIVE_RBAC_ROLE: "rca_active_rbac_role_v6",
  CA_STRUCTURES: "rca_ca_structures_store_v7",
  ACTIVITY_TEMPLATES: "rca_activity_templates_store_v7",
  AUTH_SESSION: "rca_auth_session_store_v7",
  TIMETABLE: "rca_timetable_store_v7",
  CBT_CONFIG: "rca_cbt_config_store_v7",
};

// -------------------------------------------------------------
// Core Interfaces
// -------------------------------------------------------------
export interface StudentRecord {
  id: string;
  admissionNo: string;
  fullName: string;
  gender: "Male" | "Female";
  className: string;
  house: "Sapphire (Blue)" | "Ruby (Red)" | "Emerald (Green)" | "Topaz (Yellow)";
  guardianName?: string;
  guardianPhone?: string;
  feeStatus: "Fully Cleared" | "Partially Paid" | "Outstanding";
  caScores: {
    test1: number; // Max 10
    test2: number; // Max 10
    project: number; // Max 10
    midTerm: number; // Max 10
    exam: number; // Max 60
  };
  cbtSyncStatus?: {
    syncedAt: string;
    cbtScore: number;
    maxMarks: number;
    assessmentName: string;
    isExpelled?: boolean;
  };
}

export interface SubjectScoreRecord {
  id: string;
  studentId: string;
  admissionNo: string;
  subjectName: string;
  className: string;
  session: string; // e.g. "2025/2026"
  term: "First Term" | "Second Term" | "Third Term";
  test1: number; // Max 10
  test2: number; // Max 10
  project: number; // Max 10
  midTerm: number; // Max 10
  exam: number; // Max 60
  total: number; // Max 100
  grade: string;
  remark: string;
  updatedAt?: string;
}

export interface PsychomotorRecord {
  id: string;
  studentId: string;
  admissionNo: string;
  className: string;
  session: string;
  term: "First Term" | "Second Term" | "Third Term";
  affectiveRatings: Record<string, number>; // traitId -> rating (1-5)
  psychomotorRatings: Record<string, number>; // traitId -> rating (1-5)
  attendance: {
    daysOpened: number;
    daysPresent: number;
    daysAbsent: number;
  };
  formTeacherRemark: string;
  principalRemark: string;
  nextTermBegins: string;
  promotedTo?: string;
  updatedAt?: string;
}

export interface TraitConfigItem {
  id: string;
  name: string;
  category: "Affective (Behavioral)" | "Psychomotor (Physical / Skill)";
  scale: string;
  description: string;
}

export interface ClassArmRecord {
  id: string;
  name: string;
  section: "Creche & Playgroup" | "Nursery School" | "Basic Primary" | "Junior Secondary" | "Senior Secondary";
  formTeacher: string;
  formTeacherId: string;
  studentsCount: number;
  capacity: number; // Default 0 (Dynamic relative to onboarding)
}

export interface StaffPermissions {
  canCreateStudents: boolean;
  canEditStudents: boolean;
  canDeleteStudents: boolean;
  canEnterScores: boolean;
  canEditScores: boolean;
  canPublishResults: boolean;
  canEditFees: boolean;
  canManageCurriculum: boolean;
  canEditAttendance: boolean;
  canApprovePromotions: boolean;
}

export interface StaffRecord {
  id: string;
  staffId: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: "SUPER_ADMIN" | "EXAM_OFFICER" | "TEACHER" | "ACCOUNTANT" | "ADMIN";
  assignedSubjects: string[];
  assignedClass: string;
  isFormMaster: boolean;
  emailVerified: boolean;
  status: "Active" | "On Leave" | "Suspended";
  permissions?: StaffPermissions;
}

export interface GradeBracket {
  grade: string;
  minScore: number;
  maxScore: number;
  gradePoint: number;
  remark: string;
  classification: string;
  colorBadge: string;
}

export interface TierGradingConfig {
  tierKey: "PRE_PLAY_PLAY" | "NURSERY" | "PRIMARY" | "JUNIOR_SECONDARY" | "SECONDARY";
  tierTitle: string;
  applicableClasses: string[];
  description: string;
  brackets: GradeBracket[];
}

export interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  admissionNo: string;
  studentName: string;
  className: string;
  amountBilled: number;
  amountPaid: number;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  lastPaymentDate: string;
}

export interface FeeComponentRecord {
  id: string;
  name: string;
  category: "Tuition" | "Levy" | "Examination" | "Laboratory" | "Extracurricular";
  applicableClass: string;
  amount: number;
  isMandatory: boolean;
  session?: string;
  term?: string;
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  dateRange: string;
  category: "Academic" | "Examination" | "Holiday" | "Administrative";
  term: "First Term" | "Second Term" | "Third Term";
  session: string;
  description: string;
  status: "Completed" | "Current" | "Upcoming";
}

export interface SubjectTemplateRecord {
  id: string;
  name: string;
  department: "Early Years" | "Nursery" | "Primary" | "Science" | "Arts" | "Commercial" | "General";
  targetClass: string;
  subjects: string[];
  enrolledStudentsCount: number;
}

export interface CBTQuestionRecord {
  id: string | number;
  subject: string;
  className: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  correctAnswerIndex?: number;
  marks: number;
  explanation?: string;
  category?: string;
}

export interface NewsletterRecord {
  id: string;
  session: string;
  term: "First Term" | "Second Term" | "Third Term";
  themeColor: "royal" | "scheme2" | "emerald" | "burgundy" | "gold" | "slate";
  title?: string;
  resumptionDate?: string;
  principalName: string;
  principalMessage: string;
  nextTermResumption: string;
  eventsAndHighlights: string[];
  feePolicyAndDeadlines: string;
  bankAccountDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  customNotes?: string;
  updatedAt?: string;
}

export interface CAComponentItem {
  id: string;
  name: string;
  key: string;
  maxScore: number;
  weight: number;
  description: string;
}

export interface TierCAStructure {
  tierKey: "PLAY_PRESCHOOL" | "NURSERY" | "PRIMARY" | "SECONDARY";
  tierTitle: string;
  applicableClasses: string[];
  components: CAComponentItem[];
  totalMaxScore: number;
  description: string;
}

export interface ActivityTemplateRecord {
  id: string;
  title: string;
  category: "Academic" | "Sports" | "Cultural" | "Excursion" | "Administrative" | "Club";
  targetSection: string;
  coordinator: string;
  venue: string;
  budget: string;
  objectives: string;
  defaultDurationDays: number;
}

export interface AuthUserSession {
  id: string;
  username: string;
  fullName: string;
  role: "SUPER_ADMIN" | "EXAM_OFFICER" | "TEACHER" | "ACCOUNTANT" | "STUDENT_PARENT" | "TESTERS";
  staffId: string;
  email?: string;
  assignedSubject?: string;
  assignedClass?: string;
  loginTime: string;
}

export interface TimetableEntryRecord {
  id: string;
  className: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  periodIndex: number; // 0..5
  periodLabel: string;
  subject: string;
  teacherName: string;
  teacherId?: string;
  room?: string;
}

export interface InmailMessage {
  id: string;
  sender: string;
  senderRole: string;
  recipient: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
}

export interface CBTConfigRecord {
  isOpen: boolean; // Master toggle: true = Open for Exams, false = Closed / Offline Lockdown
  activeExamMode: string; // e.g. "Terminal Examination", "Continuous Assessment Test (CAT)", "Mid-Term Assessment", "Mock & Revision Practice", "Closed / Maintenance"
  targetClasses?: string[];
  scheduledWindow: string; // e.g. "Monday - Friday (8:00 AM - 2:00 PM)"
  offlineMessage: string; // Notice displayed to candidates when CBT is closed
  allowAdminBypass?: boolean; // Super Admin / Exam Officer preview capability
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_CBT_CONFIG: CBTConfigRecord = {
  isOpen: true,
  activeExamMode: "Terminal Examination",
  targetClasses: ["All Classes"],
  scheduledWindow: "Monday - Friday (8:00 AM - 2:00 PM)",
  offlineMessage: "The Computer-Based Testing (CBT) portal is currently closed for the term. Please contact the Examination Office or Dean of Studies for the approved assessment schedule.",
  allowAdminBypass: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
  updatedBy: "Super Administrator",
};

// -------------------------------------------------------------
// Official Educational Tier Grading Scales (Standard Nigerian Curriculum)
// -------------------------------------------------------------
// Approved Universal Grading Scales (A: 70-100, B: 60-69, C: 50-59, D: 45-49 Pass Mark, F: 0-44)
// -------------------------------------------------------------
export const UNIVERSAL_GRADING_BRACKETS: GradeBracket[] = [
  { grade: "A", minScore: 70, maxScore: 100, gradePoint: 4.0, remark: "Distinction / Excellent", classification: "Distinction", colorBadge: "bg-blue-100 text-blue-900 border-blue-300" },
  { grade: "B", minScore: 60, maxScore: 69, gradePoint: 3.0, remark: "Very Good / Upper Credit", classification: "Credit", colorBadge: "bg-cyan-100 text-cyan-900 border-cyan-300" },
  { grade: "C", minScore: 50, maxScore: 59, gradePoint: 2.0, remark: "Good / Lower Credit", classification: "Credit", colorBadge: "bg-sky-100 text-sky-900 border-sky-300" },
  { grade: "D", minScore: 45, maxScore: 49, gradePoint: 1.0, remark: "Fair / Pass Mark", classification: "Pass", colorBadge: "bg-amber-100 text-amber-900 border-amber-300" },
  { grade: "F", minScore: 0, maxScore: 44, gradePoint: 0.0, remark: "Fail / Needs Improvement", classification: "Fail", colorBadge: "bg-red-100 text-red-900 border-red-300" },
];

export const DEFAULT_GRADING_TIERS: Record<string, TierGradingConfig> = {
  PRE_PLAY_PLAY: {
    tierKey: "PRE_PLAY_PLAY",
    tierTitle: "Creche & Playgroup (Pre-Play & Play Class)",
    applicableClasses: ["Pre-Play Class", "Play Class"],
    description: "Approved Universal Educational Standard (A - F Scale, 45% Pass Mark).",
    brackets: UNIVERSAL_GRADING_BRACKETS,
  },
  NURSERY: {
    tierKey: "NURSERY",
    tierTitle: "Nursery School (Nursery 1 & 2)",
    applicableClasses: ["Nursery 1", "Nursery 2"],
    description: "Approved Universal Educational Standard (A - F Scale, 45% Pass Mark).",
    brackets: UNIVERSAL_GRADING_BRACKETS,
  },
  PRIMARY: {
    tierKey: "PRIMARY",
    tierTitle: "Basic Primary Education (Primary 1 - 5)",
    applicableClasses: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"],
    description: "Approved Universal Educational Standard (A - F Scale, 45% Pass Mark).",
    brackets: UNIVERSAL_GRADING_BRACKETS,
  },
  JUNIOR_SECONDARY: {
    tierKey: "JUNIOR_SECONDARY",
    tierTitle: "Junior Secondary (JSS 1 - 3)",
    applicableClasses: ["JSS 1", "JSS 2", "JSS 3"],
    description: "Approved Universal Educational Standard (A - F Scale, 45% Pass Mark).",
    brackets: UNIVERSAL_GRADING_BRACKETS,
  },
  SECONDARY: {
    tierKey: "SECONDARY",
    tierTitle: "Senior Secondary (SS 1 - 3)",
    applicableClasses: ["SS 1", "SS 2", "SS 3"],
    description: "Approved Universal Educational Standard (A - F Scale, 45% Pass Mark).",
    brackets: UNIVERSAL_GRADING_BRACKETS,
  },
};

// -------------------------------------------------------------
// Approved Tier CA Structures Baseline (Assignable by Super Admin & Exam Officer)
// -------------------------------------------------------------
export const DEFAULT_CA_STRUCTURES: Record<string, TierCAStructure> = {
  PLAY_PRESCHOOL: {
    tierKey: "PLAY_PRESCHOOL",
    tierTitle: "Play & Preschool (Creche & Playgroup)",
    applicableClasses: ["Pre-Play Class", "Play Class"],
    description: "Preschool evaluation based on 100% comprehensive practical and milestone examination.",
    totalMaxScore: 100,
    components: [
      { id: "comp-play-exam", name: "Comprehensive Milestone Examination", key: "exam", maxScore: 100, weight: 100, description: "Preschool cognitive, sensory, and motor developmental examination." },
    ],
  },
  NURSERY: {
    tierKey: "NURSERY",
    tierTitle: "Nursery 1 & 2",
    applicableClasses: ["Nursery 1", "Nursery 2"],
    description: "4-Part Continuous Assessment (40 Marks) + Terminal Examination (60 Marks).",
    totalMaxScore: 100,
    components: [
      { id: "comp-nur-1", name: "1st Assessment", key: "assessment1", maxScore: 10, weight: 10, description: "Week 3 early assessment in literacy and numeracy." },
      { id: "comp-nur-2", name: "2nd Assessment", key: "assessment2", maxScore: 10, weight: 10, description: "Week 6 phonics and quantitative assessment." },
      { id: "comp-nur-3", name: "1st Continuous Assessment Test (CAT)", key: "cat1", maxScore: 10, weight: 10, description: "Mid-term written & oral practical test." },
      { id: "comp-nur-4", name: "2nd CAT", key: "cat2", maxScore: 10, weight: 10, description: "Post-midterm assessment." },
      { id: "comp-nur-5", name: "Terminal Examination", key: "exam", maxScore: 60, weight: 60, description: "End of term comprehensive examination." },
    ],
  },
  PRIMARY: {
    tierKey: "PRIMARY",
    tierTitle: "Basic Primary 1 – 5",
    applicableClasses: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"],
    description: "4-Part CA (40 Marks) + Internal Exam (30 Marks) + External Exam (30 Marks) = 100 Marks.",
    totalMaxScore: 100,
    components: [
      { id: "comp-pri-1", name: "1st Assessment", key: "assessment1", maxScore: 10, weight: 10, description: "Classroom assessment 1." },
      { id: "comp-pri-2", name: "2nd Assessment", key: "assessment2", maxScore: 10, weight: 10, description: "Classroom assessment 2." },
      { id: "comp-pri-3", name: "1st CAT", key: "cat1", maxScore: 10, weight: 10, description: "1st Continuous Assessment Test." },
      { id: "comp-pri-4", name: "2nd CAT", key: "cat2", maxScore: 10, weight: 10, description: "2nd Continuous Assessment Test." },
      { id: "comp-pri-5", name: "Internal Examination", key: "examInternal", maxScore: 30, weight: 30, description: "Internal school-moderated terminal theory examination." },
      { id: "comp-pri-6", name: "External Examination", key: "examExternal", maxScore: 30, weight: 30, description: "Standardized ministry external examination." },
    ],
  },
  SECONDARY: {
    tierKey: "SECONDARY",
    tierTitle: "Junior Secondary (JSS 1-3) & Senior Secondary (SS 1-3)",
    applicableClasses: ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
    description: "4-Part CA (40 Marks) + Final Terminal CBT & Theory Exam (60 Marks) = 100 Marks.",
    totalMaxScore: 100,
    components: [
      { id: "comp-sec-1", name: "1st Assessment", key: "assessment1", maxScore: 10, weight: 10, description: "Week 3 subject assignment & practical." },
      { id: "comp-sec-2", name: "2nd Assessment", key: "assessment2", maxScore: 10, weight: 10, description: "Week 6 term project & presentation." },
      { id: "comp-sec-3", name: "1st Continuous Assessment Test (CAT)", key: "cat1", maxScore: 10, weight: 10, description: "1st Continuous Assessment Test (10 Marks)." },
      { id: "comp-sec-4", name: "2nd CAT", key: "cat2", maxScore: 10, weight: 10, description: "2nd Continuous Assessment Test (10 Marks)." },
      { id: "comp-sec-5", name: "Final Terminal Examination", key: "exam", maxScore: 60, weight: 60, description: "Comprehensive Computer-Based Testing & Theory Examination (60 Marks)." },
    ],
  },
};

// -------------------------------------------------------------
// Activity Templates Baseline for Academic Calendar
// -------------------------------------------------------------
export const DEFAULT_ACTIVITY_TEMPLATES: ActivityTemplateRecord[] = [
  {
    id: "act-sports",
    title: "Inter-House Athletic Sports Championship",
    category: "Sports",
    targetSection: "All School Sections (EY, Primary, Secondary)",
    coordinator: "Head of Physical & Health Education",
    venue: "RCA Sports Pavilion & Track",
    budget: "₦450,000",
    objectives: "Foster sportsmanship, physical fitness, teamwork, and athletic talent identification.",
    defaultDurationDays: 2,
  },
  {
    id: "act-science",
    title: "Annual Science, Robotics & Innovation Expo",
    category: "Academic",
    targetSection: "Primary 3 - 5, JSS 1 - 3, SS 1 - 3",
    coordinator: "Dean of Science & Technology",
    venue: "School Multipurpose Hall & STEM Laboratories",
    budget: "₦350,000",
    objectives: "Showcase student-built engineering models, robotic prototypes, and scientific experiments.",
    defaultDurationDays: 1,
  },
  {
    id: "act-cultural",
    title: "National Heritage & Cultural Diversity Festival",
    category: "Cultural",
    targetSection: "All Enrolled Students & Faculty",
    coordinator: "Department of Humanities & Arts",
    venue: "Main Auditorium & Courtyard",
    budget: "₦280,000",
    objectives: "Celebrate Nigerian cultural diversity through traditional cuisine, folklore, dance, and attires.",
    defaultDurationDays: 1,
  },
  {
    id: "act-excursion",
    title: "Educational Field Excursion & Industrial Tour",
    category: "Excursion",
    targetSection: "Secondary School (JSS 1 - SS 3)",
    coordinator: "Vice Principal (Academics)",
    venue: "National Museum & Technology Innovation Hub, Jos",
    budget: "₦520,000",
    objectives: "Bridge classroom learning with real-world technological applications and historical heritage.",
    defaultDurationDays: 1,
  },
  {
    id: "act-career",
    title: "Career Mentorship & Future Leaders Symposium",
    category: "Academic",
    targetSection: "SS 1 – SS 3",
    coordinator: "Guidance & Counseling Directorate",
    venue: "E-Library Conference Suite",
    budget: "₦180,000",
    objectives: "Provide vocational guidance, university matriculation advice, and industry mentoring.",
    defaultDurationDays: 1,
  },
  {
    id: "act-pta",
    title: "Parent-Teacher Consultative Assembly (PTA)",
    category: "Administrative",
    targetSection: "All Parents & Guardians",
    coordinator: "Principal & PTA Executive Committee",
    venue: "School Chapel / Central Hall",
    budget: "₦120,000",
    objectives: "Deliberate on institutional advancement, academic welfare, and developmental projects.",
    defaultDurationDays: 1,
  },
];

// -------------------------------------------------------------
// Standard Educational Traits Baseline (Configurable)
// -------------------------------------------------------------
export const DEFAULT_TRAITS: TraitConfigItem[] = [
  // Affective (Behavioral & Social)
  { id: "tr-punc", name: "Punctuality & Regularity", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Timeliness to morning assemblies, roll-call, and lectures." },
  { id: "tr-neat", name: "Neatness & Uniform Compliance", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Personal hygiene, haircut, and school uniform compliance." },
  { id: "tr-hone", name: "Honesty & Moral Integrity", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Trustworthiness, truthfulness, and character in interactions." },
  { id: "tr-poli", name: "Politeness & Courteousness", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Respectful conduct towards teachers, elders, and visitors." },
  { id: "tr-lead", name: "Leadership & Sense of Responsibility", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Initiative, prefect duties, and group project leadership." },
  { id: "tr-emot", name: "Emotional Stability & Self-Control", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Maturity, anger management, and emotional composure." },
  { id: "tr-peer", name: "Relationship with Peers", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Cooperation, friendliness, and anti-bullying mindset." },
  { id: "tr-attent", name: "Attentiveness & Class Participation", category: "Affective (Behavioral)", scale: "1 - 5 Scale", description: "Focus, active listening, and contributing in discussions." },

  // Psychomotor (Skills & Physical Agility)
  { id: "tr-hand", name: "Handwriting & Calligraphy", category: "Psychomotor (Physical / Skill)", scale: "1 - 5 Scale", description: "Legibility, neatness, and precision in written work." },
  { id: "tr-verb", name: "Verbal Expression & Fluency", category: "Psychomotor (Physical / Skill)", scale: "1 - 5 Scale", description: "Clarity of speech, debates, and public presentation." },
  { id: "tr-spor", name: "Sports & Physical Agility", category: "Psychomotor (Physical / Skill)", scale: "1 - 5 Scale", description: "Participation and coordination in inter-house sports and games." },
  { id: "tr-craf", name: "Drawing, Crafts & Visual Arts", category: "Psychomotor (Physical / Skill)", scale: "1 - 5 Scale", description: "Creative illustrations, technical drawings, and craft projects." },
  { id: "tr-musi", name: "Music, Rhythm & Performing Arts", category: "Psychomotor (Physical / Skill)", scale: "1 - 5 Scale", description: "Musical instrument performance, singing, and drama." },
  { id: "tr-lab", name: "Laboratory & Workshop Dexterity", category: "Psychomotor (Physical / Skill)", scale: "1 - 5 Scale", description: "Handling scientific apparatus, computers, and practical tools." },
];

// -------------------------------------------------------------
// Standard Educational Class Arms Baseline (Single Class Stream for Secondary, Zero Default Capacity)
// -------------------------------------------------------------
export const DEFAULT_CLASSES: ClassArmRecord[] = [
  // Creche & Playgroup
  { id: "c-pp", name: "Pre-Play Class", section: "Creche & Playgroup", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/001", studentsCount: 0, capacity: 0 },
  { id: "c-pl", name: "Play Class", section: "Creche & Playgroup", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/002", studentsCount: 0, capacity: 0 },
  // Nursery
  { id: "c-nur1", name: "Nursery 1", section: "Nursery School", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/003", studentsCount: 0, capacity: 0 },
  { id: "c-nur2", name: "Nursery 2", section: "Nursery School", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/004", studentsCount: 0, capacity: 0 },
  // Basic Primary 1 - 5
  { id: "c-pri1", name: "Primary 1", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/005", studentsCount: 0, capacity: 0 },
  { id: "c-pri2", name: "Primary 2", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/006", studentsCount: 0, capacity: 0 },
  { id: "c-pri3", name: "Primary 3", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/007", studentsCount: 0, capacity: 0 },
  { id: "c-pri4", name: "Primary 4", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/008", studentsCount: 0, capacity: 0 },
  { id: "c-pri5", name: "Primary 5", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/009", studentsCount: 0, capacity: 0 },
  // Junior Secondary (Single Unified Stream: JSS 1, JSS 2, JSS 3)
  { id: "c-jss1", name: "JSS 1", section: "Junior Secondary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/010", studentsCount: 0, capacity: 0 },
  { id: "c-jss2", name: "JSS 2", section: "Junior Secondary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/011", studentsCount: 0, capacity: 0 },
  { id: "c-jss3", name: "JSS 3", section: "Junior Secondary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/012", studentsCount: 0, capacity: 0 },
  // Senior Secondary (Single Unified Stream: SS 1, SS 2, SS 3)
  { id: "c-sss1", name: "SS 1", section: "Senior Secondary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/013", studentsCount: 0, capacity: 0 },
  { id: "c-sss2", name: "SS 2", section: "Senior Secondary", formTeacher: "Dominic Mark", formTeacherId: "RCA/PERS/025", studentsCount: 0, capacity: 0 },
  { id: "c-sss3", name: "SS 3", section: "Senior Secondary", formTeacher: "Unassigned", formTeacherId: "RCA/PERS/016", studentsCount: 0, capacity: 0 },
];

// -------------------------------------------------------------
// Clean Initial Records (Flushed of all dummy mock data)
// -------------------------------------------------------------
export const INITIAL_STUDENTS: StudentRecord[] = [];
export const INITIAL_STAFF: StaffRecord[] = [];
export const INITIAL_INVOICES: InvoiceRecord[] = [];
export const INITIAL_FEES: FeeComponentRecord[] = [];
export const INITIAL_CALENDAR: CalendarEventRecord[] = [];
export const INITIAL_SUBJECT_TEMPLATES: SubjectTemplateRecord[] = [];
export const INITIAL_CBT_QUESTIONS: CBTQuestionRecord[] = [];
export const INITIAL_INMAIL: InmailMessage[] = [];
export const INITIAL_SUBJECT_SCORES: SubjectScoreRecord[] = [];
export const INITIAL_PSYCHOMOTOR: PsychomotorRecord[] = [];
export const INITIAL_TIMETABLE: TimetableEntryRecord[] = [];

export const DEFAULT_NEWSLETTER: NewsletterRecord = {
  id: "nl-default",
  session: "2025/2026",
  term: "First Term",
  themeColor: "royal",
  principalName: "Dominic Mark (Principal / Director)",
  principalMessage: "We express our sincere appreciation to God Almighty and our esteemed parents and guardians for a successful and academically rewarding term. Our students have demonstrated remarkable diligence, discipline, and commitment to excellence across all learning domains.",
  nextTermResumption: "Monday, January 12, 2026",
  eventsAndHighlights: [
    "Resumption & Registration: January 12, 2026",
    "Inter-House Athletic Sports Competition: February 14, 2026",
    "Mid-Term Break & Open Day Consultations: February 25 - 27, 2026",
    "Second Term Examination Period: March 23 - 27, 2026",
  ],
  feePolicyAndDeadlines: "Parents are kindly reminded that 100% tuition fees must be cleared on or before the resumption date to ensure uninterrupted academic participation and CBT portal access for your ward.",
  bankAccountDetails: {
    bankName: "Guaranty Trust Bank (GTBank)",
    accountName: "Royal Crown Academy Rayfield",
    accountNumber: "0123456789",
  },
  customNotes: "Please ensure students return with complete academic uniforms, sports kits, and authorized textbooks.",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// Helper: Broadcast event across browser tabs
function broadcast(eventType: string, payload?: any) {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: eventType, payload });
      channel.close();
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// Grade Calculation Engine
// -------------------------------------------------------------
export function calculateGradeForClass(
  totalScore: number,
  className: string,
  customScales?: Record<string, TierGradingConfig>
): { grade: string; remark: string; color: string; gradePoint: number } {
  const scales = customScales || DEFAULT_GRADING_TIERS;
  const lowerClass = (className || "").toLowerCase();

  let tierKey = "SECONDARY";
  if (lowerClass.includes("pre-play") || (lowerClass.includes("play") && !lowerClass.includes("display"))) {
    tierKey = "PRE_PLAY_PLAY";
  } else if (lowerClass.includes("nursery")) {
    tierKey = "NURSERY";
  } else if (lowerClass.includes("primary") || lowerClass.includes("basic")) {
    tierKey = "PRIMARY";
  } else if (lowerClass.includes("jss") || lowerClass.includes("junior")) {
    tierKey = "JUNIOR_SECONDARY";
  } else {
    tierKey = "SECONDARY";
  }

  const tier = scales[tierKey] || scales["SECONDARY"] || scales["PRIMARY"];
  const matchedBracket = tier?.brackets?.find(
    (b) => totalScore >= b.minScore && totalScore <= b.maxScore
  );

  if (matchedBracket) {
    return {
      grade: matchedBracket.grade,
      remark: matchedBracket.remark,
      color: matchedBracket.colorBadge,
      gradePoint: matchedBracket.gradePoint,
    };
  }

  return {
    grade: "F",
    remark: "Unclassified / Incomplete",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    gradePoint: 0.0,
  };
}

// -------------------------------------------------------------
// Ordinal Number Formatter (1st, 2nd, 3rd, etc.)
// -------------------------------------------------------------
export function formatOrdinal(n: number): string {
  if (!n || isNaN(n) || n <= 0) return "-";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// -------------------------------------------------------------
// Hook: Real-Time 4-Step RBAC Active Role Switcher
// -------------------------------------------------------------
const DEFAULT_ROLE_CONFIG = RBAC_STEPS[0] || {
  step: 1,
  role: "SUPER_ADMIN",
  title: "Tier 1: Executive, Proprietor & System Admin",
  badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  description: "Full institutional control: tuition structure, staff management, grading policy authorization, and master records.",
  permissions: ["ALL_ACCESS", "SETUP_WRITE", "FINANCE_WRITE", "USER_MGMT", "RESULT_OVERRIDE"],
};

export function useActiveRole() {
  const [activeRole, setActiveRoleState] = useState<string>(ROLES.SUPER_ADMIN);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_RBAC_ROLE);
      if (stored && RBAC_STEPS.some((r) => r.role === stored)) {
        setActiveRoleState(stored);
      }
    }
  }, []);

  const setActiveRole = (role: string) => {
    setActiveRoleState(role);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_RBAC_ROLE, role);
      broadcast("RBAC_ROLE_CHANGED", { role });
    }
  };

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (e) => {
        if (e.data?.type === "RBAC_ROLE_CHANGED" && e.data.payload?.role) {
          setActiveRoleState(e.data.payload.role);
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const currentRoleConfig = RBAC_STEPS.find((r) => r.role === activeRole) || DEFAULT_ROLE_CONFIG;

  return { activeRole, setActiveRole, currentRoleConfig: currentRoleConfig || DEFAULT_ROLE_CONFIG };
}

// -------------------------------------------------------------
// Hook: Real-Time Adjustable Grading Scales Store
// -------------------------------------------------------------
export function useRealtimeGradingScales() {
  const [gradingTiers, setGradingTiers] = useState<Record<string, TierGradingConfig>>(DEFAULT_GRADING_TIERS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.GRADING_SCALES);
      if (stored) {
        try {
          setGradingTiers(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.GRADING_SCALES, JSON.stringify(DEFAULT_GRADING_TIERS));
      }
    }

    if (isSupabaseConfigured) {
      fetchGradingTiersFromSupabase().then((supabaseTiers) => {
        if (supabaseTiers) {
          setGradingTiers(supabaseTiers);
          localStorage.setItem(STORAGE_KEYS.GRADING_SCALES, JSON.stringify(supabaseTiers));
        }
      });
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "GRADING_SCALES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.GRADING_SCALES);
          if (stored) setGradingTiers(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const updateGradingTierBrackets = (tierKey: string, newBrackets: GradeBracket[]) => {
    const updated = {
      ...gradingTiers,
      [tierKey]: {
        ...gradingTiers[tierKey],
        brackets: newBrackets,
      },
    };
    setGradingTiers(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.GRADING_SCALES, JSON.stringify(updated));
      broadcast("GRADING_SCALES_UPDATED");
    }
  };

  const resetGradingScalesToDefault = () => {
    setGradingTiers(DEFAULT_GRADING_TIERS);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.GRADING_SCALES, JSON.stringify(DEFAULT_GRADING_TIERS));
      broadcast("GRADING_SCALES_UPDATED");
    }
  };

  return { gradingTiers, updateGradingTierBrackets, resetGradingScalesToDefault };
}

// -------------------------------------------------------------
// Hook: Real-Time Students Store (Connected to Supabase & Live Sync)
// -------------------------------------------------------------
export function useRealtimeStudents() {
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (stored) {
        try {
          setStudents(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
      }
    }

    if (isSupabaseConfigured) {
      fetchStudentsFromSupabase().then((supabaseStudents) => {
        if (supabaseStudents !== null) {
          setStudents(supabaseStudents);
          localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(supabaseStudents));
        }
      });

      const client = getSupabaseBrowserClient();
      if (client) {
        const sub = client
          .channel("realtime-students")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "students" },
            () => {
              fetchStudentsFromSupabase().then((refreshed) => {
                if (refreshed) {
                  setStudents(refreshed);
                  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(refreshed));
                }
              });
            }
          )
          .subscribe();

        return () => {
          client.removeChannel(sub);
        };
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "STUDENTS_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
          if (stored) setStudents(JSON.parse(stored));
        }
      };
    }

    return () => {
      channel?.close();
    };
  }, []);

  const updateStudentScore = (studentId: string, newScores: StudentRecord["caScores"]) => {
    const updated = students.map((s) => (s.id === studentId ? { ...s, caScores: newScores } : s));
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");
  };

  const addStudent = (newStudent: {
    fullName: string;
    gender: "Male" | "Female";
    className: string;
    house: StudentRecord["house"];
    guardianName?: string;
    guardianPhone?: string;
    admissionNo?: string;
    feeStatus?: StudentRecord["feeStatus"];
  }) => {
    const nextSeq = (students.length + 1).toString().padStart(3, "0");
    const student: StudentRecord = {
      id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      admissionNo: newStudent.admissionNo || `RCA/STD/2025/${nextSeq}`,
      fullName: newStudent.fullName,
      gender: newStudent.gender,
      className: newStudent.className,
      house: newStudent.house,
      guardianName: newStudent.guardianName || "Not Specified",
      guardianPhone: newStudent.guardianPhone || "N/A",
      feeStatus: newStudent.feeStatus || "Outstanding",
      caScores: { test1: 0, test2: 0, project: 0, midTerm: 0, exam: 0 },
    };
    const updated = [student, ...students];
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");

    if (isSupabaseConfigured) {
      insertStudentToSupabase(student);
    }
    return student;
  };

  const bulkAddStudents = (
    newStudents: {
      fullName: string;
      gender: "Male" | "Female";
      className: string;
      house: StudentRecord["house"];
      guardianName?: string;
      guardianPhone?: string;
      admissionNo?: string;
      feeStatus?: StudentRecord["feeStatus"];
    }[]
  ) => {
    let currentSeq = students.length;
    const addedRecords: StudentRecord[] = newStudents.map((ns) => {
      currentSeq++;
      const seqStr = currentSeq.toString().padStart(3, "0");
      return {
        id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        admissionNo: ns.admissionNo || `RCA/STD/2025/${seqStr}`,
        fullName: ns.fullName,
        gender: ns.gender || "Female",
        className: ns.className || "Primary 1",
        house: ns.house || "Sapphire (Blue)",
        guardianName: ns.guardianName || "Not Specified",
        guardianPhone: ns.guardianPhone || "N/A",
        feeStatus: ns.feeStatus || "Outstanding",
        caScores: { test1: 0, test2: 0, project: 0, midTerm: 0, exam: 0 },
      };
    });

    const updated = [...addedRecords, ...students];
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");

    if (isSupabaseConfigured) {
      bulkInsertStudentsToSupabase(addedRecords);
    }

    return addedRecords.length;
  };

  const bulkUpdateScores = (
    scoresList: {
      admissionNo: string;
      test1?: number;
      test2?: number;
      project?: number;
      midTerm?: number;
      exam?: number;
    }[]
  ) => {
    const scoreMap = new Map(scoresList.map((item) => [item.admissionNo.trim().toUpperCase(), item]));
    const updated = students.map((s) => {
      const match = scoreMap.get(s.admissionNo.trim().toUpperCase());
      if (match) {
        return {
          ...s,
          caScores: {
            test1: match.test1 !== undefined ? match.test1 : s.caScores.test1,
            test2: match.test2 !== undefined ? match.test2 : s.caScores.test2,
            project: match.project !== undefined ? match.project : s.caScores.project,
            midTerm: match.midTerm !== undefined ? match.midTerm : s.caScores.midTerm,
            exam: match.exam !== undefined ? match.exam : s.caScores.exam,
          },
        };
      }
      return s;
    });

    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");
  };

  const deleteStudent = (studentId: string) => {
    const updated = students.filter((s) => s.id !== studentId);
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");
  };

  const clearAllStudents = () => {
    setStudents([]);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    broadcast("STUDENTS_UPDATED");
  };

  return { students, updateStudentScore, addStudent, bulkAddStudents, bulkUpdateScores, deleteStudent, clearAllStudents };
}

// -------------------------------------------------------------
// Hook: Real-Time Multi-Subject CA & Exam Scores Store
// -------------------------------------------------------------
export function useRealtimeSubjectScores() {
  const [subjectScores, setSubjectScores] = useState<SubjectScoreRecord[]>(INITIAL_SUBJECT_SCORES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBJECT_SCORES);
      if (stored) {
        try {
          setSubjectScores(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.SUBJECT_SCORES, JSON.stringify(INITIAL_SUBJECT_SCORES));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "SUBJECT_SCORES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.SUBJECT_SCORES);
          if (stored) setSubjectScores(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const saveSubjectScore = (record: Omit<SubjectScoreRecord, "id">) => {
    const total = (record.test1 || 0) + (record.test2 || 0) + (record.project || 0) + (record.midTerm || 0) + (record.exam || 0);
    const gradeInfo = calculateGradeForClass(total, record.className);

    const existingIndex = subjectScores.findIndex(
      (s) =>
        s.studentId === record.studentId &&
        s.subjectName.toLowerCase() === record.subjectName.toLowerCase() &&
        s.session === record.session &&
        s.term === record.term
    );

    let updated: SubjectScoreRecord[];
    if (existingIndex > -1) {
      updated = [...subjectScores];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...record,
        total,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newEntry: SubjectScoreRecord = {
        ...record,
        id: `sc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        total,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        updatedAt: new Date().toISOString(),
      };
      updated = [newEntry, ...subjectScores];
    }

    setSubjectScores(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_SCORES, JSON.stringify(updated));
      broadcast("SUBJECT_SCORES_UPDATED");
    }
  };

  const bulkSaveSubjectScores = (records: Omit<SubjectScoreRecord, "id">[]) => {
    const updated = [...subjectScores];
    for (const record of records) {
      const total = (record.test1 || 0) + (record.test2 || 0) + (record.project || 0) + (record.midTerm || 0) + (record.exam || 0);
      const gradeInfo = calculateGradeForClass(total, record.className);

      const existingIndex = updated.findIndex(
        (s) =>
          s.studentId === record.studentId &&
          s.subjectName.toLowerCase() === record.subjectName.toLowerCase() &&
          s.session === record.session &&
          s.term === record.term
      );

      if (existingIndex > -1) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...record,
          total,
          grade: gradeInfo.grade,
          remark: gradeInfo.remark,
          updatedAt: new Date().toISOString(),
        };
      } else {
        updated.push({
          ...record,
          id: `sc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          total,
          grade: gradeInfo.grade,
          remark: gradeInfo.remark,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setSubjectScores(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_SCORES, JSON.stringify(updated));
      broadcast("SUBJECT_SCORES_UPDATED");
    }
    return records.length;
  };

  const getScoresForStudent = (studentId: string, session?: string, term?: string) => {
    return subjectScores.filter((s) => {
      const matchesStudent = s.studentId === studentId;
      const matchesSession = !session || s.session === session;
      const matchesTerm = !term || s.term === term;
      return matchesStudent && matchesSession && matchesTerm;
    });
  };

  return { subjectScores, saveSubjectScore, bulkSaveSubjectScores, getScoresForStudent };
}

// -------------------------------------------------------------
// Hook: Real-Time Psychomotor & Behavioral Traits Assessment Store
// -------------------------------------------------------------
export function useRealtimePsychomotor() {
  const [psychomotorList, setPsychomotorList] = useState<PsychomotorRecord[]>(INITIAL_PSYCHOMOTOR);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.PSYCHOMOTOR);
      if (stored) {
        try {
          setPsychomotorList(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.PSYCHOMOTOR, JSON.stringify(INITIAL_PSYCHOMOTOR));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "PSYCHOMOTOR_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.PSYCHOMOTOR);
          if (stored) setPsychomotorList(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const savePsychomotorAssessment = (record: Omit<PsychomotorRecord, "id">) => {
    const existingIndex = psychomotorList.findIndex(
      (p) =>
        p.studentId === record.studentId &&
        p.session === record.session &&
        p.term === record.term
    );

    let updated: PsychomotorRecord[];
    if (existingIndex > -1) {
      updated = [...psychomotorList];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...record,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newEntry: PsychomotorRecord = {
        ...record,
        id: `psy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        updatedAt: new Date().toISOString(),
      };
      updated = [newEntry, ...psychomotorList];
    }

    setPsychomotorList(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.PSYCHOMOTOR, JSON.stringify(updated));
      broadcast("PSYCHOMOTOR_UPDATED");
    }
  };

  const getAssessmentForStudent = (studentId: string, session: string, term: string) => {
    return psychomotorList.find(
      (p) => p.studentId === studentId && p.session === session && p.term === term
    );
  };

  return { psychomotorList, savePsychomotorAssessment, getAssessmentForStudent };
}

// -------------------------------------------------------------
// Hook: Real-Time Configurable Traits Setup Store
// -------------------------------------------------------------
export function useRealtimeTraits() {
  const [traits, setTraits] = useState<TraitConfigItem[]>(DEFAULT_TRAITS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.TRAITS);
      if (stored) {
        try {
          setTraits(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(DEFAULT_TRAITS));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "TRAITS_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.TRAITS);
          if (stored) setTraits(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addTrait = (newTrait: Omit<TraitConfigItem, "id">) => {
    const item: TraitConfigItem = {
      ...newTrait,
      id: `tr-${Date.now()}`,
    };
    const updated = [...traits, item];
    setTraits(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(updated));
      broadcast("TRAITS_UPDATED");
    }
  };

  const deleteTrait = (traitId: string) => {
    const updated = traits.filter((t) => t.id !== traitId);
    setTraits(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(updated));
      broadcast("TRAITS_UPDATED");
    }
  };

  const resetTraitsToDefault = () => {
    setTraits(DEFAULT_TRAITS);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(DEFAULT_TRAITS));
      broadcast("TRAITS_UPDATED");
    }
  };

  return { traits, addTrait, deleteTrait, resetTraitsToDefault };
}

// -------------------------------------------------------------
// Hook: Real-Time Class Arms Store
// -------------------------------------------------------------
export function useRealtimeClasses() {
  const [classes, setClasses] = useState<ClassArmRecord[]>(DEFAULT_CLASSES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CLASSES);
      if (stored) {
        try {
          setClasses(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "CLASSES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.CLASSES);
          if (stored) setClasses(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addClass = (newClass: Omit<ClassArmRecord, "id">) => {
    const entry: ClassArmRecord = {
      ...newClass,
      id: `c-${Date.now()}`,
    };
    const updated = [entry, ...classes];
    setClasses(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(updated));
      broadcast("CLASSES_UPDATED");
    }
  };

  const deleteClass = (id: string) => {
    const updated = classes.filter((c) => c.id !== id);
    setClasses(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(updated));
      broadcast("CLASSES_UPDATED");
    }
  };

  const updateClass = (id: string, updates: Partial<ClassArmRecord>) => {
    const updated = classes.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setClasses(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(updated));
      broadcast("CLASSES_UPDATED");
    }
  };

  return { classes, addClass, deleteClass, updateClass };
}

// -------------------------------------------------------------
// Hook: Real-Time Staff Store (Connected to Supabase & Live Sync)
// -------------------------------------------------------------
export function useRealtimeStaff() {
  const [staff, setStaff] = useState<StaffRecord[]>(INITIAL_STAFF);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.STAFF);
      if (stored) {
        try {
          setStaff(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(INITIAL_STAFF));
      }
    }

    if (isSupabaseConfigured) {
      fetchStaffFromSupabase().then((supabaseStaff) => {
        if (supabaseStaff !== null) {
          setStaff(supabaseStaff);
          localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(supabaseStaff));
        }
      });
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "STAFF_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.STAFF);
          if (stored) setStaff(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addStaff = (newStaffData: Omit<StaffRecord, "id">) => {
    const newMember: StaffRecord = {
      ...newStaffData,
      id: `st-${Date.now()}`,
    };
    const updated = [newMember, ...staff];
    setStaff(updated);
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updated));
    broadcast("STAFF_UPDATED");

    if (isSupabaseConfigured) {
      insertStaffToSupabase(newMember);
    }
  };

  const bulkAddStaff = (newStaffList: Omit<StaffRecord, "id">[]) => {
    const newMembers: StaffRecord[] = newStaffList.map((item, idx) => ({
      ...item,
      id: `st-${Date.now()}-${idx}`,
    }));
    const updated = [...newMembers, ...staff];
    setStaff(updated);
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updated));
    broadcast("STAFF_UPDATED");
    return newMembers.length;
  };

  const deleteStaff = (staffId: string) => {
    const updated = staff.filter((s) => s.id !== staffId);
    setStaff(updated);
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updated));
    broadcast("STAFF_UPDATED");
  };

  const updateStaff = (staffId: string, updates: Partial<StaffRecord>) => {
    const updated = staff.map((s) => (s.id === staffId ? { ...s, ...updates } : s));
    setStaff(updated);
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updated));
    broadcast("STAFF_UPDATED");
  };

  return { staff, addStaff, bulkAddStaff, deleteStaff, updateStaff };
}

// -------------------------------------------------------------
// Hook: Real-Time CBT Questions Store
// -------------------------------------------------------------
export function useRealtimeCBTQuestions() {
  const [questions, setQuestions] = useState<CBTQuestionRecord[]>(INITIAL_CBT_QUESTIONS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CBT_QUESTIONS);
      if (stored) {
        try {
          setQuestions(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CBT_QUESTIONS, JSON.stringify(INITIAL_CBT_QUESTIONS));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "CBT_QUESTIONS_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.CBT_QUESTIONS);
          if (stored) setQuestions(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addQuestion = (newQ: Omit<CBTQuestionRecord, "id">) => {
    const q: CBTQuestionRecord = {
      ...newQ,
      id: questions.length + 1,
    };
    const updated = [...questions, q];
    setQuestions(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CBT_QUESTIONS, JSON.stringify(updated));
      broadcast("CBT_QUESTIONS_UPDATED");
    }
  };

  const bulkAddQuestions = (newQuestions: Omit<CBTQuestionRecord, "id">[]) => {
    let nextId = questions.length;
    const added = newQuestions.map((q) => {
      nextId++;
      return { ...q, id: nextId };
    });
    const updated = [...questions, ...added];
    setQuestions(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CBT_QUESTIONS, JSON.stringify(updated));
      broadcast("CBT_QUESTIONS_UPDATED");
    }
    return added.length;
  };

  return { questions, addQuestion, bulkAddQuestions };
}

// -------------------------------------------------------------
// Hook: Real-Time Invoices Store (Connected to Supabase)
// -------------------------------------------------------------
export function useRealtimeInvoices() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(INITIAL_INVOICES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.INVOICES);
      if (stored) {
        try {
          setInvoices(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(INITIAL_INVOICES));
      }
    }

    if (isSupabaseConfigured) {
      fetchInvoicesFromSupabase().then((supabaseInvoices) => {
        if (supabaseInvoices !== null) {
          setInvoices(supabaseInvoices);
          localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(supabaseInvoices));
        }
      });
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "INVOICES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.INVOICES);
          if (stored) setInvoices(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const recordPayment = (invoiceId: string, paymentAmount: number) => {
    const updated = invoices.map((inv) => {
      if (inv.id === invoiceId) {
        const newPaid = Math.min(inv.amountBilled, inv.amountPaid + paymentAmount);
        const status = newPaid >= inv.amountBilled ? "Paid" : "Partial";
        return {
          ...inv,
          amountPaid: newPaid,
          paymentStatus: status as InvoiceRecord["paymentStatus"],
          lastPaymentDate: new Date().toISOString().split("T")[0],
        };
      }
      return inv;
    });

    setInvoices(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));
      broadcast("INVOICES_UPDATED");
    }
  };

  return { invoices, recordPayment };
}

// -------------------------------------------------------------
// Sync CBT Score to Continuous Assessment (Exam Column: 0-60)
// -------------------------------------------------------------
export function syncCBTScoreToCA(
  admissionNo: string,
  cbtRawScore: number,
  cbtMaxMarks: number,
  targetCAField: "test1" | "test2" | "project" | "midTerm" | "exam" = "exam",
  assessmentName: string = "CBT Assessment",
  isExpelled: boolean = false
): { success: boolean; scaledScore: number } {
  if (typeof window === "undefined") return { success: false, scaledScore: 0 };

  const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (!stored) return { success: false, scaledScore: 0 };

  try {
    const studentList: StudentRecord[] = JSON.parse(stored);
    const targetStudentIndex = studentList.findIndex(
      (s) => s.admissionNo.trim().toUpperCase() === admissionNo.trim().toUpperCase()
    );

    if (targetStudentIndex === -1) return { success: false, scaledScore: 0 };

    const maxLimits: Record<string, number> = { test1: 10, test2: 10, project: 10, midTerm: 10, exam: 60 };
    const fieldMax = maxLimits[targetCAField] || 60;
    const scaledScore = isExpelled
      ? 0
      : Math.min(fieldMax, Math.round((cbtRawScore / Math.max(1, cbtMaxMarks)) * fieldMax));

    studentList[targetStudentIndex] = {
      ...studentList[targetStudentIndex],
      caScores: {
        ...studentList[targetStudentIndex].caScores,
        [targetCAField]: scaledScore,
      },
      cbtSyncStatus: {
        syncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        cbtScore: cbtRawScore,
        maxMarks: cbtMaxMarks,
        assessmentName,
        isExpelled,
      },
    };

    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentList));
    broadcast("STUDENTS_UPDATED");
    return { success: true, scaledScore };
  } catch (error) {
    console.error("Failed to sync CBT score to CA Gradebook:", error);
    return { success: false, scaledScore: 0 };
  }
}

// -------------------------------------------------------------
// Hook: Real-Time Inmail Store
// -------------------------------------------------------------
export function useRealtimeInmail() {
  const [messages, setMessages] = useState<InmailMessage[]>(INITIAL_INMAIL);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.INMAIL);
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.INMAIL, JSON.stringify(INITIAL_INMAIL));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "INMAIL_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.INMAIL);
          if (stored) setMessages(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const sendMessage = (newMsg: {
    recipient: string;
    subject: string;
    body: string;
    sender?: string;
    senderRole?: string;
    snippet?: string;
  }) => {
    const msg: InmailMessage = {
      id: `msg-${Date.now()}`,
      sender: newMsg.sender || "Dominic (Admin)",
      senderRole: newMsg.senderRole || "Administration",
      recipient: newMsg.recipient,
      subject: newMsg.subject,
      snippet: newMsg.snippet || (newMsg.body.length > 80 ? newMsg.body.substring(0, 80) + "..." : newMsg.body),
      body: newMsg.body,
      date: "Just now",
      unread: false,
      starred: false,
    };
    const updated = [msg, ...messages];
    setMessages(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.INMAIL, JSON.stringify(updated));
      broadcast("INMAIL_UPDATED");
    }
  };

  return { messages, sendMessage };
}

// -------------------------------------------------------------
// Subject Types & Hook: Real-Time Subjects Store
// -------------------------------------------------------------
export interface SubjectRecord {
  id: string;
  name: string;
  code?: string;
  category?: string;
  applicableClasses: string[];
  creditUnits?: number;
  isCompulsory?: boolean;
  assignedTeachersCount?: number;
  createdAt?: string;
}

export const INITIAL_SUBJECTS: SubjectRecord[] = [];

export function useRealtimeSubjects() {
  const [subjects, setSubjects] = useState<SubjectRecord[]>(INITIAL_SUBJECTS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (stored) {
        try {
          setSubjects(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
      }
    }

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type === "SUBJECTS_UPDATED" && typeof window !== "undefined") {
        const stored = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
        if (stored) {
          try {
            setSubjects(JSON.parse(stored));
          } catch (e) {}
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = handleBroadcast;
    }

    return () => {
      channel?.close();
    };
  }, []);

  const addSubject = (newSubject: Omit<SubjectRecord, "id">) => {
    const sub: SubjectRecord = {
      ...newSubject,
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: newSubject.code?.trim() || undefined,
      creditUnits: newSubject.creditUnits || 3,
      isCompulsory: newSubject.isCompulsory ?? true,
      assignedTeachersCount: newSubject.assignedTeachersCount || 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [sub, ...subjects];
    setSubjects(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updated));
      broadcast("SUBJECTS_UPDATED");
    }
    return sub;
  };

  const bulkAddSubjects = (newSubjectsList: Omit<SubjectRecord, "id">[]) => {
    const created: SubjectRecord[] = newSubjectsList.map((s, idx) => ({
      ...s,
      id: `sub-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      code: s.code?.trim() || undefined,
      creditUnits: s.creditUnits || 3,
      isCompulsory: s.isCompulsory ?? true,
      assignedTeachersCount: s.assignedTeachersCount || 0,
      createdAt: new Date().toISOString(),
    }));
    const updated = [...created, ...subjects];
    setSubjects(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updated));
      broadcast("SUBJECTS_UPDATED");
    }
  };

  const deleteSubject = (id: string) => {
    const updated = subjects.filter((s) => s.id !== id);
    setSubjects(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updated));
      broadcast("SUBJECTS_UPDATED");
    }
  };

  const updateSubject = (id: string, updates: Partial<SubjectRecord>) => {
    const updated = subjects.map((s) => (s.id === id ? { ...s, ...updates } : s));
    setSubjects(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(updated));
      broadcast("SUBJECTS_UPDATED");
    }
  };

  const clearAllSubjects = () => {
    setSubjects([]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
      broadcast("SUBJECTS_UPDATED");
    }
  };

  return {
    subjects,
    setSubjects,
    addSubject,
    bulkAddSubjects,
    deleteSubject,
    updateSubject,
    clearAllSubjects,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Academic Calendar Store
// -------------------------------------------------------------
export function useRealtimeCalendar() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>(INITIAL_CALENDAR);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CALENDAR);
      if (stored) {
        try {
          setCalendarEvents(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(INITIAL_CALENDAR));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "CALENDAR_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.CALENDAR);
          if (stored) setCalendarEvents(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addCalendarEvent = (newEvent: Omit<CalendarEventRecord, "id">) => {
    const ev: CalendarEventRecord = {
      ...newEvent,
      id: `cal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [ev, ...calendarEvents];
    setCalendarEvents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(updated));
      broadcast("CALENDAR_UPDATED");
    }
    return ev;
  };

  const updateCalendarEvent = (id: string, updates: Partial<CalendarEventRecord>) => {
    const updated = calendarEvents.map((e) => (e.id === id ? { ...e, ...updates } : e));
    setCalendarEvents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(updated));
      broadcast("CALENDAR_UPDATED");
    }
  };

  const deleteCalendarEvent = (id: string) => {
    const updated = calendarEvents.filter((e) => e.id !== id);
    setCalendarEvents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(updated));
      broadcast("CALENDAR_UPDATED");
    }
  };

  const clearAllCalendarEvents = () => {
    setCalendarEvents([]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify([]));
      broadcast("CALENDAR_UPDATED");
    }
  };

  return {
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    clearAllCalendarEvents,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Fee Structure & Components Store
// -------------------------------------------------------------
export function useRealtimeFees() {
  const [fees, setFees] = useState<FeeComponentRecord[]>(INITIAL_FEES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.FEES);
      if (stored) {
        try {
          setFees(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(INITIAL_FEES));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "FEES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.FEES);
          if (stored) setFees(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addFeeComponent = (newFee: Omit<FeeComponentRecord, "id">) => {
    const item: FeeComponentRecord = {
      ...newFee,
      id: `fee-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [...fees, item];
    setFees(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(updated));
      broadcast("FEES_UPDATED");
    }
    return item;
  };

  const deleteFeeComponent = (id: string) => {
    const updated = fees.filter((f) => f.id !== id);
    setFees(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(updated));
      broadcast("FEES_UPDATED");
    }
  };

  const updateFeeComponent = (id: string, updates: Partial<FeeComponentRecord>) => {
    const updated = fees.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setFees(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(updated));
      broadcast("FEES_UPDATED");
    }
  };

  const clearAllFees = () => {
    setFees([]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify([]));
      broadcast("FEES_UPDATED");
    }
  };

  return {
    fees,
    addFeeComponent,
    deleteFeeComponent,
    updateFeeComponent,
    clearAllFees,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Subject Templates Store
// -------------------------------------------------------------
export function useRealtimeSubjectTemplates() {
  const [templates, setTemplates] = useState<SubjectTemplateRecord[]>(INITIAL_SUBJECT_TEMPLATES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBJECT_TEMPLATES);
      if (stored) {
        try {
          setTemplates(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(INITIAL_SUBJECT_TEMPLATES));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "SUBJECT_TEMPLATES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.SUBJECT_TEMPLATES);
          if (stored) setTemplates(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addTemplate = (newTpl: Omit<SubjectTemplateRecord, "id">) => {
    const tpl: SubjectTemplateRecord = {
      ...newTpl,
      id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [tpl, ...templates];
    setTemplates(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(updated));
      broadcast("SUBJECT_TEMPLATES_UPDATED");
    }
    return tpl;
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(updated));
      broadcast("SUBJECT_TEMPLATES_UPDATED");
    }
  };

  const updateTemplate = (id: string, updates: Partial<SubjectTemplateRecord>) => {
    const updated = templates.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setTemplates(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(updated));
      broadcast("SUBJECT_TEMPLATES_UPDATED");
    }
  };

  const clearAllTemplates = () => {
    setTemplates([]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify([]));
      broadcast("SUBJECT_TEMPLATES_UPDATED");
    }
  };

  return {
    templates,
    addTemplate,
    deleteTemplate,
    updateTemplate,
    clearAllTemplates,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Dynamic Newsletter Store
// -------------------------------------------------------------
export function useRealtimeNewsletter() {
  const [newsletter, setNewsletter] = useState<NewsletterRecord>(DEFAULT_NEWSLETTER);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.NEWSLETTER);
      if (stored) {
        try {
          setNewsletter(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(DEFAULT_NEWSLETTER));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "NEWSLETTER_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.NEWSLETTER);
          if (stored) setNewsletter(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const updateNewsletter = (updates: Partial<NewsletterRecord>) => {
    const updated: NewsletterRecord = {
      ...newsletter,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setNewsletter(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(updated));
      broadcast("NEWSLETTER_UPDATED");
    }
  };

  const resetNewsletter = () => {
    setNewsletter(DEFAULT_NEWSLETTER);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(DEFAULT_NEWSLETTER));
      broadcast("NEWSLETTER_UPDATED");
    }
  };

  return {
    newsletter,
    updateNewsletter,
    resetNewsletter,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Dynamic CA Structure Store (Assignable by Super Admin & Exam Officer)
// -------------------------------------------------------------
export function useRealtimeCAStructure() {
  const [caStructures, setCAStructures] = useState<Record<string, TierCAStructure>>(DEFAULT_CA_STRUCTURES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CA_STRUCTURES);
      if (stored) {
        try {
          setCAStructures(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify(DEFAULT_CA_STRUCTURES));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "CA_STRUCTURES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.CA_STRUCTURES);
          if (stored) setCAStructures(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const updateTierCAComponents = (tierKey: string, components: CAComponentItem[]) => {
    const totalMaxScore = components.reduce((sum, c) => sum + (c.maxScore || 0), 0);
    const updated = {
      ...caStructures,
      [tierKey]: {
        ...caStructures[tierKey],
        components,
        totalMaxScore,
      },
    };
    setCAStructures(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify(updated));
      broadcast("CA_STRUCTURES_UPDATED");
    }
  };

  const resetCAStructuresToDefault = () => {
    setCAStructures(DEFAULT_CA_STRUCTURES);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify(DEFAULT_CA_STRUCTURES));
      broadcast("CA_STRUCTURES_UPDATED");
    }
  };

  return {
    caStructures,
    updateTierCAComponents,
    resetCAStructuresToDefault,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Activity Templates Store
// -------------------------------------------------------------
export function useRealtimeActivityTemplates() {
  const [activityTemplates, setActivityTemplates] = useState<ActivityTemplateRecord[]>(DEFAULT_ACTIVITY_TEMPLATES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITY_TEMPLATES);
      if (stored) {
        try {
          setActivityTemplates(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(DEFAULT_ACTIVITY_TEMPLATES));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "ACTIVITY_TEMPLATES_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITY_TEMPLATES);
          if (stored) setActivityTemplates(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addActivityTemplate = (template: Omit<ActivityTemplateRecord, "id">) => {
    const newRecord: ActivityTemplateRecord = {
      ...template,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [newRecord, ...activityTemplates];
    setActivityTemplates(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(updated));
      broadcast("ACTIVITY_TEMPLATES_UPDATED");
    }
    return newRecord;
  };

  const deleteActivityTemplate = (id: string) => {
    const updated = activityTemplates.filter((a) => a.id !== id);
    setActivityTemplates(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(updated));
      broadcast("ACTIVITY_TEMPLATES_UPDATED");
    }
  };

  const resetActivityTemplatesToDefault = () => {
    setActivityTemplates(DEFAULT_ACTIVITY_TEMPLATES);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(DEFAULT_ACTIVITY_TEMPLATES));
      broadcast("ACTIVITY_TEMPLATES_UPDATED");
    }
  };

  return {
    activityTemplates,
    addActivityTemplate,
    deleteActivityTemplate,
    resetActivityTemplatesToDefault,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Authentication & Session Store (Tiered 5-Role Support)
// -------------------------------------------------------------
export function useRealtimeAuth() {
  const [currentUser, setCurrentUser] = useState<AuthUserSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: BroadcastChannel | null = null;

    const applyStoredSession = () => {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
          return;
        } catch {
          // fall through to server check
        }
      }
      setCurrentUser(null);
    };

    if (typeof window !== "undefined") {
      // The server session cookie is the source of truth. If it is valid it
      // overwrites whatever localStorage claims; if it is missing/expired the
      // client is treated as logged out even if localStorage still has data.
      void fetch("/api/auth/session", { cache: "no-store" })
        .then(async (response) => {
          if (cancelled) return;
          if (!response.ok) {
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_RBAC_ROLE);
            setCurrentUser(null);
            return;
          }
          const payload = (await response.json()) as { user?: AuthUserSession };
          if (payload?.user) {
            const session: AuthUserSession = {
              id: payload.user.username,
              username: payload.user.username,
              fullName: payload.user.fullName,
              role: payload.user.role,
              staffId: payload.user.staffId,
              email: payload.user.email,
              loginTime: new Date().toISOString(),
            };
            localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
            localStorage.setItem(STORAGE_KEYS.ACTIVE_RBAC_ROLE, session.role);
            setCurrentUser(session);
          } else {
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_RBAC_ROLE);
            setCurrentUser(null);
          }
        })
        .catch(() => {
          if (!cancelled) applyStoredSession();
        });

      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event) => {
          if (event.data?.type === "AUTH_SESSION_UPDATED") {
            applyStoredSession();
          }
        };
      }
    }
    return () => {
      cancelled = true;
      channel?.close();
    };
  }, []);

  const loginWithRole = (
    role: "SUPER_ADMIN" | "EXAM_OFFICER" | "TEACHER" | "ACCOUNTANT" | "STUDENT_PARENT" | "TESTERS",
    profile?: { username?: string; fullName?: string; staffId?: string; email?: string }
  ) => {
    const roleProfiles: Record<string, AuthUserSession> = {
      SUPER_ADMIN: {
        id: "u-025",
        username: "dominic370",
        fullName: "Dr. Dominic Mark",
        role: "SUPER_ADMIN",
        staffId: "RCA/PERS/025",
        email: "dominic370@royalcrownacademy.edu.ng",
        assignedSubject: "Information & Communication Technology",
        assignedClass: "SS 2",
        loginTime: new Date().toISOString(),
      },
      EXAM_OFFICER: {
        id: "u-012",
        username: "exam_officer",
        fullName: "Prof. Jeremiah Alabi",
        role: "EXAM_OFFICER",
        staffId: "RCA/PERS/012",
        email: "dean.exams@royalcrownacademy.edu.ng",
        assignedSubject: "General Mathematics",
        assignedClass: "SS 3",
        loginTime: new Date().toISOString(),
      },
      TEACHER: {
        id: "u-048",
        username: "teacher_grace",
        fullName: "Mrs. Grace Adams",
        role: "TEACHER",
        staffId: "RCA/PERS/048",
        email: "grace.adams@royalcrownacademy.edu.ng",
        assignedSubject: "English Language & Literacy",
        assignedClass: "Primary 4",
        loginTime: new Date().toISOString(),
      },
      ACCOUNTANT: {
        id: "u-008",
        username: "bursar_accounts",
        fullName: "Mr. Samuel Danladi",
        role: "ACCOUNTANT",
        staffId: "RCA/PERS/008",
        email: "bursar@royalcrownacademy.edu.ng",
        assignedSubject: "Accounts & Commercial Studies",
        assignedClass: "SS 2",
        loginTime: new Date().toISOString(),
      },
      STUDENT_PARENT: {
        id: "u-104",
        username: "parent_rca",
        fullName: "Chief & Mrs. A. Oladipo (Guardian)",
        role: "STUDENT_PARENT",
        staffId: "RCA/PAR/104",
        email: "parent.oladipo@gmail.com",
        loginTime: new Date().toISOString(),
      },
      TESTERS: {
        id: "u-tst",
        username: "tester",
        fullName: "QA Tester",
        role: "TESTERS",
        staffId: "RCA/TST/001",
        email: "",
        loginTime: new Date().toISOString(),
      },
    };

    const targetUser: AuthUserSession = profile
      ? {
          id: profile.username ?? role,
          username: profile.username ?? "",
          fullName: profile.fullName ?? "",
          role,
          staffId: profile.staffId ?? "",
          email: profile.email,
          loginTime: new Date().toISOString(),
        }
      : roleProfiles[role] || roleProfiles.SUPER_ADMIN;
    setCurrentUser(targetUser);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(targetUser));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_RBAC_ROLE, targetUser.role);
      broadcast("AUTH_SESSION_UPDATED");
      broadcast("RBAC_ROLE_CHANGED", { role: targetUser.role });
    }
    return targetUser;
  };

  const logout = () => {
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      broadcast("AUTH_SESSION_UPDATED");
      void fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }
  };

  const purgeAllSessions = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    broadcast("AUTH_SESSION_UPDATED");
  };

  return {
    currentUser,
    loginWithRole,
    logout,
    purgeAllSessions,
    isAuthenticated: !!currentUser,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Timetable Store (Flushed of all dummy data)
// -------------------------------------------------------------
export function useRealtimeTimetable() {
  const [timetable, setTimetable] = useState<TimetableEntryRecord[]>(INITIAL_TIMETABLE);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.TIMETABLE);
      if (stored) {
        try {
          setTimetable(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(INITIAL_TIMETABLE));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "TIMETABLE_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.TIMETABLE);
          if (stored) setTimetable(JSON.parse(stored));
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const addEntry = (entry: Omit<TimetableEntryRecord, "id">) => {
    const newEntry: TimetableEntryRecord = {
      ...entry,
      id: `tt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const filtered = timetable.filter(
      (item) => !(item.className === entry.className && item.day === entry.day && item.periodIndex === entry.periodIndex)
    );
    const updated = [...filtered, newEntry];
    setTimetable(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(updated));
      broadcast("TIMETABLE_UPDATED");
    }
  };

  const removeEntry = (id: string) => {
    const updated = timetable.filter((t) => t.id !== id);
    setTimetable(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(updated));
      broadcast("TIMETABLE_UPDATED");
    }
  };

  const clearClassTimetable = (className: string) => {
    const updated = timetable.filter((t) => t.className !== className);
    setTimetable(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(updated));
      broadcast("TIMETABLE_UPDATED");
    }
  };

  const purgeAllTimetable = () => {
    setTimetable([]);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify([]));
      broadcast("TIMETABLE_UPDATED");
    }
  };

  return { timetable, addEntry, removeEntry, clearClassTimetable, purgeAllTimetable };
}

// -------------------------------------------------------------
// Hook: Real-Time CBT Engine Configuration & Lockdown Store
// -------------------------------------------------------------
export function useRealtimeCBTConfig() {
  const [cbtConfig, setCBTConfig] = useState<CBTConfigRecord>(DEFAULT_CBT_CONFIG);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CBT_CONFIG);
      if (stored) {
        try {
          setCBTConfig(JSON.parse(stored));
        } catch (e) {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(DEFAULT_CBT_CONFIG));
      }
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "CBT_CONFIG_UPDATED") {
          const stored = localStorage.getItem(STORAGE_KEYS.CBT_CONFIG);
          if (stored) {
            try {
              setCBTConfig(JSON.parse(stored));
            } catch (e) {}
          }
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const updateCBTConfig = (updates: Partial<CBTConfigRecord>) => {
    const updated: CBTConfigRecord = {
      ...cbtConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setCBTConfig(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(updated));
      broadcast("CBT_CONFIG_UPDATED");
    }
    return updated;
  };

  const toggleCBTAccess = (explicitState?: boolean) => {
    const nextState = typeof explicitState === "boolean" ? explicitState : !cbtConfig.isOpen;
    return updateCBTConfig({ isOpen: nextState });
  };

  const resetCBTConfig = () => {
    setCBTConfig(DEFAULT_CBT_CONFIG);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(DEFAULT_CBT_CONFIG));
      broadcast("CBT_CONFIG_UPDATED");
    }
  };

  return {
    cbtConfig,
    updateCBTConfig,
    toggleCBTAccess,
    resetCBTConfig,
    isCBTOpen: cbtConfig.isOpen,
  };
}

// -------------------------------------------------------------
// Database Reset / Purge Helpers (Flushes All Data to Pure Zero State)
// -------------------------------------------------------------
export function purgeAllDemoData() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SUBJECT_SCORES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.PSYCHOMOTOR, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CBT_QUESTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.INMAIL, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify({ ...DEFAULT_CBT_CONFIG, isOpen: false }));
  localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  broadcast("STUDENTS_UPDATED");
  broadcast("SUBJECT_SCORES_UPDATED");
  broadcast("PSYCHOMOTOR_UPDATED");
  broadcast("STAFF_UPDATED");
  broadcast("INVOICES_UPDATED");
  broadcast("FEES_UPDATED");
  broadcast("CALENDAR_UPDATED");
  broadcast("SUBJECT_TEMPLATES_UPDATED");
  broadcast("CBT_QUESTIONS_UPDATED");
  broadcast("INMAIL_UPDATED");
  broadcast("SUBJECTS_UPDATED");
  broadcast("CLASSES_UPDATED");
  broadcast("NEWSLETTER_UPDATED");
  broadcast("CA_STRUCTURES_UPDATED");
  broadcast("ACTIVITY_TEMPLATES_UPDATED");
  broadcast("TIMETABLE_UPDATED");
  broadcast("CBT_CONFIG_UPDATED");
  broadcast("AUTH_SESSION_UPDATED");
}

export function restoreDefaultSeedData() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SUBJECT_SCORES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.PSYCHOMOTOR, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
  localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(DEFAULT_TRAITS));
  localStorage.setItem(STORAGE_KEYS.GRADING_SCALES, JSON.stringify(DEFAULT_GRADING_TIERS));
  localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify(DEFAULT_CA_STRUCTURES));
  localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(DEFAULT_ACTIVITY_TEMPLATES));
  localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(DEFAULT_NEWSLETTER));
  localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(DEFAULT_CBT_CONFIG));
  broadcast("STUDENTS_UPDATED");
  broadcast("SUBJECT_SCORES_UPDATED");
  broadcast("PSYCHOMOTOR_UPDATED");
  broadcast("STAFF_UPDATED");
  broadcast("INVOICES_UPDATED");
  broadcast("FEES_UPDATED");
  broadcast("CALENDAR_UPDATED");
  broadcast("SUBJECT_TEMPLATES_UPDATED");
  broadcast("SUBJECTS_UPDATED");
  broadcast("CLASSES_UPDATED");
  broadcast("TRAITS_UPDATED");
  broadcast("GRADING_SCALES_UPDATED");
  broadcast("NEWSLETTER_UPDATED");
  broadcast("CA_STRUCTURES_UPDATED");
  broadcast("ACTIVITY_TEMPLATES_UPDATED");
  broadcast("TIMETABLE_UPDATED");
  broadcast("CBT_CONFIG_UPDATED");
}
