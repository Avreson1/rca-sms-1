"use client";

import { useState, useEffect, useMemo } from "react";
import { SCHOOL_INFO, ROLES, RBAC_STEPS } from "./constants";
import { cachedSchoolSession, cachedSchoolTerm } from "./school-config";
import { isSupabaseConfigured } from "./supabase/client";
import { reportSyncFailure, reportSyncSaved } from "./sync-status";
import {
  fetchStudentsFromSupabase,
  fetchStaffFromSupabase,
  fetchInvoicesFromSupabase,
  fetchFeeComponentsFromSupabase,
  saveFeeComponentsOnServer,
  removeFeeComponentOnServer,
  fetchGradingTiersFromSupabase,
  insertStudentToSupabase,
  bulkInsertStudentsToSupabase,
  deleteStudentFromSupabase,
  insertStaffToSupabase,
  deleteStaffFromSupabase,
  bulkInsertStaffOnServer,
  type BulkStaffResult,
  recordPaymentOnServer,
  type ReceiptDetails,
  bulkSaveInvoicesToSupabase,
  saveCaScoresToSupabase,
  fetchCaScoresFromSupabase,
  saveGradingTiersToSupabase,
  fetchAssessmentsFromSupabase,
  saveAssessmentOnServer,
  fetchTraitsConfigFromSupabase,
  saveTraitsConfigOnServer,
  fetchClassArmsFromSupabase,
  saveClassArmOnServer,
  removeClassArmOnServer,
  type ClassArmInput,
  fetchSubjectsFromSupabase,
  saveSubjectsOnServer,
  removeSubjectsOnServer,
  type SubjectInput,
  fetchSubjectTemplatesFromSupabase,
  saveSubjectTemplatesOnServer,
  removeSubjectTemplatesOnServer,
  type SubjectTemplateInput,
  fetchCBTQuestionsFromSupabase,
  saveCBTQuestionsOnServer,
  removeCBTQuestionOnServer,
  type CBTQuestionInput,
  fetchCBTConfigFromSupabase,
  saveCBTConfigOnServer,
  fetchCalendarEventsFromSupabase,
  saveCalendarEventsOnServer,
  setCalendarStatusOnServer,
  removeCalendarEventsOnServer,
  type CalendarEventInput,
  fetchActivityTemplatesFromSupabase,
  saveActivityTemplateOnServer,
  removeActivityTemplateOnServer,
  type ActivityTemplateInput,
  fetchCAStructuresFromSupabase,
  saveCAStructuresOnServer,
  type CAStructureFile,
  type CAStructureInput,
  fetchReportThemeFromSupabase,
  saveReportThemeOnServer,
  fetchNewslettersFromSupabase,
  saveNewsletterOnServer,
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
  // The calendar and the activity blueprints are on the school's records now
  // (/api/calendar, /api/activity-templates). These keys stay so a machine can
  // still show something when the school's list cannot be read, and so the
  // settings purge can clear that device copy.
  CALENDAR: "rca_calendar_store_v6",
  INMAIL: "rca_inmail_store_v6",
  // The terminal circulars, the CA structures and the card theme are on the
  // school's records now (/api/newsletter, /api/ca-structures,
  // /api/report-theme). These keys stay so a machine can still print something
  // when the school's list cannot be read, and so the settings purge can clear
  // that device copy — a cached circular carries the school's bank details.
  NEWSLETTER: "rca_newsletter_store_v8",
  GRADING_SCALES: "rca_grading_scales_store_v6",
  ACTIVE_RBAC_ROLE: "rca_active_rbac_role_v6",
  BROWSER_OWNER: "rca_portal_browser_owner_v1",
  CA_STRUCTURES: "rca_ca_structures_store_v7",
  REPORT_THEME: "rca_report_theme_store_v8",
  ACTIVITY_TEMPLATES: "rca_activity_templates_store_v7",
  AUTH_SESSION: "rca_auth_session_store_v7",
  // The timetable is on the school records now (/api/timetable). The key stays so the
  // settings purge can still clear a device copy that was never filed.
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
  /**
   * The job title the school states for this person — Bursar, Dean of Studies,
   * Coordinator. Kept apart from `role` on purpose: the role is the access tier
   * the portal enforces, the designation is what the person is employed as, and
   * letting one imply the other is how somebody ends up with access nobody
   * decided to give them. Empty means the register does not say.
   */
  designation?: string;
  /**
   * Duties this member is ordinarily on, e.g. "Gate Duty". They are suggestions
   * the roster editor offers for a named date; nothing files them on its own.
   */
  standingDuties?: string[];
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
  // Without these, saving a payment on an older invoice would re-date it to the
  // current session and term.
  session?: string;
  term?: string;
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

/**
 * One milestone on the school's calendar.
 *
 * `dateRange` is the school's own words — "Nov 18 - 20, 2025", "Resumption
 * week" — and empty means the date has not been fixed yet, which the screens say
 * in those words rather than printing "TBD". `category` carries the four the
 * Add form offers plus the four an activity blueprint can arrive with: a sports
 * day written as "Academic" is what a printed circular would then get wrong.
 */
export interface CalendarEventRecord {
  id: string;
  title: string;
  dateRange: string;
  category:
    | "Academic"
    | "Examination"
    | "Holiday"
    | "Administrative"
    | "Sports"
    | "Cultural"
    | "Excursion"
    | "Club";
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

/**
 * One finished sitting, as the school's records hold it.
 *
 * The score is the browser's own arithmetic — marking still happens there, which
 * is why this is an attempt and not a mark. `syncedToCa` is false on every row
 * the CBT engine files, and stays false until a person moves the figure into the
 * gradebook.
 */
export interface CBTSittingRecord {
  id: string;
  admissionNo: string;
  studentName: string;
  className: string;
  session: string;
  term: string;
  subject: string;
  questionCount: number;
  cbtScore: number;
  maxMarks: number;
  strikes: number;
  isExpelled: boolean;
  completedAt: string;
}

/**
 * The six report card schemes. The keys are the ids the school's theme row
 * holds, the picker on the setup screen and the print styles on the score card.
 */
export type ReportTheme = "royal" | "scheme2" | "emerald" | "burgundy" | "gold" | "slate";

/**
 * The end-of-term circular for ONE session and term, as the school wrote it.
 *
 * It is keyed by term because the printed sheet carries that term's heading: a
 * single shared message could only be true for one of the three, and for the
 * other two the card printed another term's resumption date, fee deadline and
 * events under a label that did not match.
 *
 * Every field is allowed to be empty, and the card says so in words
 * ("Resumption date not announced") rather than showing a placeholder. The
 * previous defaults invented a resumption date, four dated highlights, a fee
 * deadline and — worst — a bank account number that belongs to nobody. A printed
 * account number sends families money, so it is typed by the bursary or not
 * printed at all.
 */
export interface NewsletterRecord {
  session: string;
  term: "First Term" | "Second Term" | "Third Term";
  title: string;
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
  customNotes: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** The tiers the portal groups classes into. Same four the grading scales use. */
export type CATierKey = "PLAY_PRESCHOOL" | "NURSERY" | "PRIMARY" | "SECONDARY";

export const CA_TIER_KEYS: CATierKey[] = ["PLAY_PRESCHOOL", "NURSERY", "PRIMARY", "SECONDARY"];

/**
 * One column of a tier's assessment, in the order it is taught.
 *
 * There is deliberately no `weight` beside `maxScore`: every screen that ever
 * read this list used the marks, a weight nobody typed was compiled in equal to
 * them, and two numbers for one fact is how they drift apart.
 */
export interface CAComponentItem {
  key: string;
  name: string;
  maxScore: number;
  description: string;
}

export interface TierCAStructure {
  tierKey: CATierKey;
  tierTitle: string;
  applicableClasses: string[];
  components: CAComponentItem[];
  /** The school's own note about the tier. Empty when it has not written one. */
  description: string;
  /** Who last filed this tier, and when. Empty and null when nobody has. */
  updatedBy: string;
  updatedAt: string | null;
}

/**
 * A reusable activity blueprint, as the school wrote it.
 *
 * Every field but `title` and `defaultDurationDays` is allowed to be empty, and
 * empty is printed as "not said". The portal used to fill a gap with
 * "Unassigned", "Main Campus Hall", "₦0" and "Standard co-curricular activity."
 * — each of which reads as a decision the school had made, ₦0 most of all.
 */
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
  scheduledWindow: string; // e.g. "Monday - Friday (8:00 AM - 2:00 PM)"
  offlineMessage: string; // Notice displayed to candidates when CBT is closed
  allowAdminBypass?: boolean; // Super Admin / Exam Officer preview capability
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_CBT_CONFIG: CBTConfigRecord = {
  // Shut, and blank, until the school's own switch row is read. A browser that
  // has not reached the database must not present an exam module as open to a
  // candidate, and a fresh install used to arrive pre-filled with "Terminal
  // Examination", "Monday - Friday (8:00 AM - 2:00 PM)" and a finished lockdown
  // paragraph — a schedule and wording the school had never set. Blank means not
  // announced; the candidate notice on the closed screen says so rather than
  // inventing one.
  isOpen: false,
  activeExamMode: "",
  scheduledWindow: "",
  offlineMessage: "",
  allowAdminBypass: true,
  // No updatedAt / updatedBy either: nobody has changed anything yet, and the
  // defaults used to sign the row "Super Administrator, 1 January 2026".
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
// The four CA tiers and what they are called
//
// Which arm sits in which tier is the portal's own taxonomy — the same map the
// grading scales and the report card group by — so the names and the class lists
// live here rather than on the school's records. What the school decides, and
// now files there (/api/ca-structures), is what each tier is assessed by.
// -------------------------------------------------------------
export const CA_TIER_LABELS: Record<CATierKey, { tierTitle: string; applicableClasses: string[] }> = {
  PLAY_PRESCHOOL: { tierTitle: "Play & Preschool (Creche & Playgroup)", applicableClasses: ["Pre-Play Class", "Play Class"] },
  NURSERY: { tierTitle: "Nursery 1 & 2", applicableClasses: ["Nursery 1", "Nursery 2"] },
  PRIMARY: { tierTitle: "Basic Primary 1 – 5", applicableClasses: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"] },
  SECONDARY: {
    tierTitle: "Junior Secondary (JSS 1-3) & Senior Secondary (SS 1-3)",
    applicableClasses: ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
  },
};

/**
 * A starting outline the office can file and then correct.
 *
 * These distributions — and their "Week 3 early assessment in literacy and
 * numeracy" descriptions — were written by whoever built the portal, not decided
 * by this school. They used to be compiled in as the answer itself, so a
 * nursery's five-part CA appeared on the screen of a school that had never
 * approved it, and "Reset All Defaults" put them back over a list the office had
 * edited. They now reach the screen only through the button that calls them an
 * outline, and only reach the school's records when somebody files them.
 */
export const STANDARD_CA_OUTLINE: Record<CATierKey, { description: string; components: CAComponentItem[] }> = {
  PLAY_PRESCHOOL: {
    description: "Preschool evaluation based on 100% comprehensive practical and milestone examination.",
    components: [
      { key: "exam", name: "Comprehensive Milestone Examination", maxScore: 100, description: "Preschool cognitive, sensory, and motor developmental examination." },
    ],
  },
  NURSERY: {
    description: "4-Part Continuous Assessment (40 Marks) + Terminal Examination (60 Marks).",
    components: [
      { key: "assessment1", name: "1st Assessment", maxScore: 10, description: "Week 3 early assessment in literacy and numeracy." },
      { key: "assessment2", name: "2nd Assessment", maxScore: 10, description: "Week 6 phonics and quantitative assessment." },
      { key: "cat1", name: "1st Continuous Assessment Test (CAT)", maxScore: 10, description: "Mid-term written & oral practical test." },
      { key: "cat2", name: "2nd CAT", maxScore: 10, description: "Post-midterm assessment." },
      { key: "exam", name: "Terminal Examination", maxScore: 60, description: "End of term comprehensive examination." },
    ],
  },
  PRIMARY: {
    description: "4-Part CA (40 Marks) + Internal Exam (30 Marks) + External Exam (30 Marks) = 100 Marks.",
    components: [
      { key: "assessment1", name: "1st Assessment", maxScore: 10, description: "Classroom assessment 1." },
      { key: "assessment2", name: "2nd Assessment", maxScore: 10, description: "Classroom assessment 2." },
      { key: "cat1", name: "1st CAT", maxScore: 10, description: "1st Continuous Assessment Test." },
      { key: "cat2", name: "2nd CAT", maxScore: 10, description: "2nd Continuous Assessment Test." },
      { key: "examInternal", name: "Internal Examination", maxScore: 30, description: "Internal school-moderated terminal theory examination." },
      { key: "examExternal", name: "External Examination", maxScore: 30, description: "Standardized ministry external examination." },
    ],
  },
  SECONDARY: {
    description: "4-Part CA (40 Marks) + Final Terminal CBT & Theory Exam (60 Marks) = 100 Marks.",
    components: [
      { key: "assessment1", name: "1st Assessment", maxScore: 10, description: "Week 3 subject assignment & practical." },
      { key: "assessment2", name: "2nd Assessment", maxScore: 10, description: "Week 6 term project & presentation." },
      { key: "cat1", name: "1st Continuous Assessment Test (CAT)", maxScore: 10, description: "1st Continuous Assessment Test (10 Marks)." },
      { key: "cat2", name: "2nd CAT", maxScore: 10, description: "2nd Continuous Assessment Test (10 Marks)." },
      { key: "exam", name: "Final Terminal Examination", maxScore: 60, description: "Comprehensive Computer-Based Testing & Theory Examination (60 Marks)." },
    ],
  },
};

// -------------------------------------------------------------
// The terminal circular has no baseline either.
//
// A newsletter is a message to families, and the one compiled in here carried a
// resumption date, four dated highlights, a fee deadline and a bank account
// nobody owns. The school writes its own per term (/api/newsletter); a term with
// nothing filed prints no circular rather than an invented one.
// -------------------------------------------------------------

// -------------------------------------------------------------
// Activity Templates have no baseline.
//
// Six were compiled in here — an inter-house championship at ₦450,000, a
// robotics expo, a cultural festival, an industrial tour, a career symposium and
// a PTA assembly, each with a named coordinator, a venue and a budget figure.
// Nobody at this school typed any of them, and "Reset Default Templates" put
// them back over a list the school had written for itself. The blueprints now
// come from the school's own records (/api/activity-templates), and a school
// that has written none is shown an empty list and told so.
// -------------------------------------------------------------

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
// The class arms themselves are this school's real structure, so they stay. The invented
// staff numbers in `formTeacherId` do not: an unassigned arm has no teacher, and naming the
// super admin as SS 2's form teacher put a person on a register who was never appointed.
export const DEFAULT_CLASSES: ClassArmRecord[] = [
  // Creche & Playgroup
  { id: "c-pp", name: "Pre-Play Class", section: "Creche & Playgroup", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-pl", name: "Play Class", section: "Creche & Playgroup", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  // Nursery
  { id: "c-nur1", name: "Nursery 1", section: "Nursery School", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-nur2", name: "Nursery 2", section: "Nursery School", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  // Basic Primary 1 - 5
  { id: "c-pri1", name: "Primary 1", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-pri2", name: "Primary 2", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-pri3", name: "Primary 3", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-pri4", name: "Primary 4", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-pri5", name: "Primary 5", section: "Basic Primary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  // Junior Secondary (Single Unified Stream: JSS 1, JSS 2, JSS 3)
  { id: "c-jss1", name: "JSS 1", section: "Junior Secondary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-jss2", name: "JSS 2", section: "Junior Secondary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-jss3", name: "JSS 3", section: "Junior Secondary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  // Senior Secondary (Single Unified Stream: SS 1, SS 2, SS 3)
  { id: "c-sss1", name: "SS 1", section: "Senior Secondary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-sss2", name: "SS 2", section: "Senior Secondary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
  { id: "c-sss3", name: "SS 3", section: "Senior Secondary", formTeacher: "Unassigned", formTeacherId: "", studentsCount: 0, capacity: 0 },
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

// Helper: Broadcast event across browser tabs
function broadcast(eventType: string, payload?: any) {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: eventType, payload });
      channel.close();
    } catch {}
  }
}

// Screens fill themselves from this browser's own copy of the data before the
// server has answered, so whoever signed in here last leaves their cached roster
// on the machine. When a different person signs in — a parent on a staff laptop —
// that copy must go, or the new person sees it on screen until the server's
// filtered answer replaces it. Emptying the keys and broadcasting makes
// already-mounted screens drop it at once, without a page reload.
//
// The wipe waits for a sign-in rather than firing at logout: if the server
// cannot reach the database, this browser's copy is the only one that exists, so
// an anonymous browser is left holding it.
const PUPIL_DATA_KEYS: [storageKey: string, eventType: string][] = [
  [STORAGE_KEYS.STUDENTS, "STUDENTS_UPDATED"],
  [STORAGE_KEYS.INVOICES, "INVOICES_UPDATED"],
  [STORAGE_KEYS.SUBJECT_SCORES, "SUBJECT_SCORES_UPDATED"],
  [STORAGE_KEYS.PSYCHOMOTOR, "PSYCHOMOTOR_UPDATED"],
  [STORAGE_KEYS.TRAITS, "TRAITS_UPDATED"],
];

function clearPupilDataFromThisBrowser() {
  if (typeof window === "undefined") return;
  for (const [storageKey, eventType] of PUPIL_DATA_KEYS) {
    localStorage.setItem(storageKey, JSON.stringify([]));
    broadcast(eventType);
  }
}

/** Wipes the cached pupil data when the browser changes hands. */
function handOverBrowser(nextUsername: string) {
  if (typeof window === "undefined" || !nextUsername) return;
  const previousOwner = localStorage.getItem(STORAGE_KEYS.BROWSER_OWNER) ?? storedSessionUsername();
  if (previousOwner && previousOwner !== nextUsername) clearPupilDataFromThisBrowser();
  localStorage.setItem(STORAGE_KEYS.BROWSER_OWNER, nextUsername);
}

function storedSessionUsername(): string | undefined {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH_SESSION) || "null") as AuthUserSession | null)?.username;
  } catch {
    return undefined;
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
        } catch {}
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

  /** Files the scale and answers with why the school said no, or null. */
  const updateGradingTierBrackets = async (tierKey: string, newBrackets: GradeBracket[]): Promise<string | null> => {
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
    // The scale decides the letter printed on every card, so it belongs on the
    // school's tables and not in this browser's storage — a reload used to put
    // the seeded numbers back while the marks filed in between stayed graded
    // against the scale the office had typed.
    if (!isSupabaseConfigured) {
      return "this device is not connected to the school database";
    }
    const filed = await saveGradingTiersToSupabase(updated, `the ${updated[tierKey]?.tierTitle ?? tierKey} grading scale`);
    return filed ? null : "the school's records did not accept the new scale";
  };

  return { gradingTiers, updateGradingTierBrackets };
}

/**
 * On screen a pupil has one set of CA scores; in the database the `ca_scores`
 * row is keyed by subject, session and term as well. Without the subject a
 * typed score has nowhere to be filed, so only screens that know it can push
 * scores to the server.
 *
 * Waits for the server rather than firing and claiming success: the Save button
 * used to read "Sent to the school records" the moment it was clicked, while a
 * refused pupil was only ever mentioned in the corner notice.
 */
async function fileCaScoresOnServer(
  students: StudentRecord[],
  subject: string
): Promise<{ filed: number; total: number; reason: string | null }> {
  const scored = students.filter((s) => {
    const { test1, test2, project, midTerm, exam } = s.caScores;
    return test1 + test2 + project + midTerm + exam > 0;
  });
  if (scored.length === 0) return { filed: 0, total: 0, reason: "no pupil in this class has a mark to send" };
  if (!isSupabaseConfigured) {
    return { filed: 0, total: scored.length, reason: "this device is not connected to the school records" };
  }

  // Filed under the session and term the school says it is in. With the compiled
  // constants here, a school that had moved into 2026/2027 in Settings kept
  // filing marks under 2025/2026, and the score card — which reads the filed
  // session — showed the class as if nobody had marked anything.
  const session = cachedSchoolSession() || SCHOOL_INFO.currentSession;
  const term = cachedSchoolTerm() || SCHOOL_INFO.currentTerm;

  const records = scored.map((student) => {
    const { test1, test2, project, midTerm, exam } = student.caScores;
    const total = test1 + test2 + project + midTerm + exam;
    const { grade, remark } = calculateGradeForClass(total, student.className);
    return {
      admissionNo: student.admissionNo,
      subject,
      session,
      term,
      test1,
      test2,
      project,
      midTerm,
      exam,
      total,
      grade,
      remark,
    };
  });

  const saved = await saveCaScoresToSupabase(
    records,
    `${subject} scores for ${scored.length} pupil${scored.length === 1 ? "" : "s"} (${session}, ${term})`
  );
  return {
    filed: saved ? scored.length : 0,
    total: scored.length,
    reason: saved ? null : `the school's records did not take the ${subject} marks`,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Students Store (Connected to Supabase & Live Sync)
// -------------------------------------------------------------
/**
 * Admission numbers that cannot collide with a pupil already on the roll.
 *
 * The number used to be `students.length + 1` with the year typed into the
 * code. Unenrol one child and the next admission reuses that child's number —
 * and `/api/students` upserts on `admission_no`, so a new family silently took
 * over an existing pupil's record, marks and invoices. The year was frozen at
 * 2025 whatever session the school was in.
 */
function allocateAdmissionNos(used: string[], count: number): string[] {
  const taken = new Set(used.map((no) => no.trim().toUpperCase()).filter(Boolean));
  const year = /\d{4}/.exec(cachedSchoolSession() || SCHOOL_INFO.currentSession)?.[0]
    ?? String(new Date().getFullYear());
  const numbers: string[] = [];
  for (let seq = 1; numbers.length < count; seq++) {
    const candidate = `RCA/STD/${year}/${String(seq).padStart(3, "0")}`;
    if (taken.has(candidate)) continue;
    taken.add(candidate);
    numbers.push(candidate);
  }
  return numbers;
}

export function useRealtimeStudents() {
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (stored) {
        try {
          setStudents(JSON.parse(stored));
        } catch {}
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
    }

    // No Supabase Realtime subscription here. Every table the browser could
    // subscribe to is protected by row-level security with no policy for the
    // anon key — deliberately, because the anon key is in the page — so a
    // browser subscriber is told nothing about a change it may not read. What
    // did work was being skipped by that dead subscription: the channel below
    // was only set up when the database was not configured, so two tabs of the
    // same office browser never shared an update.
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

  /**
   * Loads one subject's filed marks into the CA entry grid for one class.
   *
   * Every pupil in that class is set, not only the ones with a row: a buffer
   * left holding the previous subject's numbers would be filed against the
   * subject now showing when Save is pressed. Nothing is broadcast, because the
   * grid on another tab may be mid-entry on a different subject.
   */
  const overlayFiledScores = (subject: string, className: string, filed: SubjectScoreRecord[]) => {
    const blank: StudentRecord["caScores"] = { test1: 0, test2: 0, project: 0, midTerm: 0, exam: 0 };
    const wanted = subject.trim().toLowerCase();
    const byStudent = new Map(
      filed
        .filter((row) => row.subjectName.trim().toLowerCase() === wanted)
        .map((row) => [
          row.studentId,
          { test1: row.test1, test2: row.test2, project: row.project, midTerm: row.midTerm, exam: row.exam },
        ])
    );

    const updated = students.map((s) =>
      s.className === className ? { ...s, caScores: byStudent.get(s.id) ?? blank } : s
    );
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
  };

  /**
   * Applies a class move to this device after the school records have accepted
   * it. This does not write: the database row is the roll, and this only keeps
   * the screen from showing a pupil in the class they were just moved out of.
   */
  const moveStudentsToClass = (studentIds: string[], className: string) => {
    const moved = new Set(studentIds);
    const updated = students.map((s) => (moved.has(s.id) ? { ...s, className } : s));
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");
  };

  /**
   * Enrols one pupil and reports whether the school's records took them.
   *
   * The answer matters: the row is added to this browser first so the roster
   * repaints immediately, and a screen that claimed "enrolled" without waiting
   * would be telling the office about a pupil the database may have refused.
   */
  const addStudent = async (newStudent: {
    fullName: string;
    gender: "Male" | "Female";
    className: string;
    house: StudentRecord["house"];
    guardianName?: string;
    guardianPhone?: string;
    admissionNo?: string;
    feeStatus?: StudentRecord["feeStatus"];
  }): Promise<{ student: StudentRecord; reason: string | null }> => {
    const [generatedAdmissionNo] = allocateAdmissionNos(
      students.map((s) => s.admissionNo),
      1
    );
    const student: StudentRecord = {
      id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      admissionNo: newStudent.admissionNo?.trim() || generatedAdmissionNo,
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

    if (!isSupabaseConfigured) {
      return { student, reason: "no school database is connected, so this pupil exists on this browser only" };
    }
    const filed = await insertStudentToSupabase(student);
    return { student, reason: filed ? null : "the school's records did not accept the enrolment" };
  };

  /**
   * Enrols a batch and reports whether the school's records took them.
   *
   * There are no invented fallbacks here any more. A CSV row with an empty
   * gender used to be filed as "Female" and a row with no class as "Primary 1",
   * so one shifted column in a spreadsheet put a child in the wrong arm, under
   * the wrong sex, on the school's own records. The screen that reads the file
   * rejects those rows instead.
   */
  const bulkAddStudents = async (
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
  ): Promise<{ count: number; reason: string | null }> => {
    const needsNumber = newStudents.filter((ns) => !ns.admissionNo?.trim());
    const generated = allocateAdmissionNos(
      [...students.map((s) => s.admissionNo), ...newStudents.map((ns) => ns.admissionNo ?? "")],
      needsNumber.length
    );
    let nextGenerated = 0;
    const addedRecords: StudentRecord[] = newStudents.map((ns) => {
      return {
        id: `s-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        admissionNo: ns.admissionNo?.trim() || generated[nextGenerated++],
        fullName: ns.fullName,
        gender: ns.gender,
        className: ns.className,
        house: ns.house,
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

    if (!isSupabaseConfigured) {
      return {
        count: addedRecords.length,
        reason: "no school database is connected, so these pupils exist on this browser only",
      };
    }
    const filed = await bulkInsertStudentsToSupabase(addedRecords);
    return { count: addedRecords.length, reason: filed ? null : "the school's records did not accept the batch" };
  };

  const bulkUpdateScores = async (
    scoresList: {
      admissionNo: string;
      test1?: number;
      test2?: number;
      project?: number;
      midTerm?: number;
      exam?: number;
    }[],
    subject?: string
  ): Promise<{ filed: number; total: number; unmatched: number; reason: string | null }> => {
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

    // A row whose admission number is not on the roll matches nothing here, and
    // used to be dropped without a word: 40 rows in the file, 38 marks on screen,
    // and no one told that two children were never on this class's register.
    const onRoll = new Set(updated.map((s) => s.admissionNo.trim().toUpperCase()));
    const unmatched = scoresList.filter((item) => !onRoll.has(item.admissionNo.trim().toUpperCase())).length;

    if (subject) {
      const imported = updated.filter((s) => scoreMap.has(s.admissionNo.trim().toUpperCase()));
      const outcome = await fileCaScoresOnServer(imported, subject);
      return { ...outcome, unmatched };
    }
    return { filed: 0, total: 0, unmatched, reason: "no subject was chosen, so the marks were not filed anywhere" };
  };

  const deleteStudent = (studentId: string) => {
    const removed = students.find((s) => s.id === studentId);
    const updated = students.filter((s) => s.id !== studentId);
    setStudents(updated);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    broadcast("STUDENTS_UPDATED");

    if (removed && isSupabaseConfigured) {
      void deleteStudentFromSupabase(removed.admissionNo);
    }
  };

  const clearAllStudents = () => {
    setStudents([]);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    broadcast("STUDENTS_UPDATED");
  };

  /**
   * The score grid edits this device's copy as you type, so the Save button is
   * where the class on screen is filed against the subject chosen above it.
   */
  const saveCaScores = (subject: string, roster?: StudentRecord[]) =>
    fileCaScoresOnServer(roster ?? students, subject);

  return { students, updateStudentScore, overlayFiledScores, moveStudentsToClass, addStudent, bulkAddStudents, bulkUpdateScores, deleteStudent, clearAllStudents, saveCaScores };
}

// -------------------------------------------------------------
// Hook: Real-Time Multi-Subject CA & Exam Scores Store
// -------------------------------------------------------------
export function useRealtimeSubjectScores(scope?: { session?: string; terms?: string[]; className?: string }) {
  const [subjectScores, setSubjectScores] = useState<SubjectScoreRecord[]>(INITIAL_SUBJECT_SCORES);
  // True only once the school's own rows for this session/term have arrived.
  // A screen that overlays them on an entry grid must not do so before then,
  // or it would blank marks the read has not delivered yet.
  const [filedLoaded, setFiledLoaded] = useState(false);

  const session = scope?.session ?? "";
  const terms = scope?.terms ?? [];
  const className = scope?.className ?? "";
  // A stable key: the effect must not re-run because a caller rebuilt its
  // options object on every render.
  const scopeKey = session && terms.length > 0 ? `${session}|${terms.join(",")}|${className}` : "";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBJECT_SCORES);
      if (stored) {
        try {
          setSubjectScores(JSON.parse(stored));
        } catch {}
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

  useEffect(() => {
    if (!scopeKey || !isSupabaseConfigured) return;

    setFiledLoaded(false);
    let cancelled = false;
    void fetchCaScoresFromSupabase({ session, terms, className: className || undefined }).then((filed) => {
      // null means the read was refused or failed: keep showing this device's
      // copy, which the sync notice has already labelled as such.
      if (cancelled || filed === null) return;
      setSubjectScores(filed);
      localStorage.setItem(STORAGE_KEYS.SUBJECT_SCORES, JSON.stringify(filed));
      setFiledLoaded(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

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

  return { subjectScores, filedLoaded, saveSubjectScore, bulkSaveSubjectScores, getScoresForStudent };
}

// -------------------------------------------------------------
// Hook: Real-Time Psychomotor & Behavioral Traits Assessment Store
// -------------------------------------------------------------

/** One pupil, one session, one term — the key a card is filed under. */
function assessmentKey(record: PsychomotorRecord): string {
  return `${record.studentId}|${record.session}|${record.term}`;
}

/**
 * The school's own rows win for the child and term they cover; everything else on
 * this device is kept. Replacing the whole list would throw away a class a teacher
 * is halfway through rating, and merging the other way would let a stale browser
 * claim ratings the office has since corrected.
 */
function mergeAssessments(local: PsychomotorRecord[], filed: PsychomotorRecord[]): PsychomotorRecord[] {
  const serverKeys = new Set(filed.map(assessmentKey));
  return [...filed, ...local.filter((row) => !serverKeys.has(assessmentKey(row)))];
}

export function useRealtimePsychomotor(scope?: { session?: string; terms?: string[]; className?: string }) {
  const [psychomotorList, setPsychomotorList] = useState<PsychomotorRecord[]>(INITIAL_PSYCHOMOTOR);
  // True only once the school's rows for this session/term have arrived. Until
  // then the list is this browser's copy and a screen must not write it back over
  // what the database holds.
  const [assessmentsFiled, setAssessmentsFiled] = useState(false);

  const session = scope?.session ?? "";
  const terms = scope?.terms ?? [];
  const className = scope?.className ?? "";
  // A stable key: the effect must not re-run because a caller rebuilt its
  // options object on every render.
  const scopeKey = session && terms.length > 0 ? `${session}|${terms.join(",")}|${className}` : "";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.PSYCHOMOTOR);
      if (stored) {
        try {
          setPsychomotorList(JSON.parse(stored));
        } catch {}
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

  useEffect(() => {
    if (!scopeKey || !isSupabaseConfigured) return;

    setAssessmentsFiled(false);
    let cancelled = false;
    void fetchAssessmentsFromSupabase({ session, terms, className: className || undefined }).then((filed) => {
      // null means the read was refused or failed: keep showing this device's
      // copy, which the sync notice has already labelled as such.
      if (cancelled || filed === null) return;
      setPsychomotorList((current) => mergeAssessments(current, filed));
      setAssessmentsFiled(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Only this hook's own mutators write the store, and only the read above can
  // leave the browser holding rows it has never saved anywhere.
  useEffect(() => {
    if (!assessmentsFiled || typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.PSYCHOMOTOR, JSON.stringify(psychomotorList));
  }, [psychomotorList, assessmentsFiled]);

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

  /**
   * Files the listed assessments into the school's records, one pupil per request,
   * and answers with how many landed. The rating grid edits this device's copy as
   * it is typed, which is why the screen has to say plainly that a tick on the
   * form is not a card until it is filed here.
   */
  const fileAssessments = async (
    records: PsychomotorRecord[]
  ): Promise<{ filed: number; total: number; reason: string | null }> => {
    if (records.length === 0) return { filed: 0, total: 0, reason: "no pupil on this screen has an assessment to file" };
    if (!isSupabaseConfigured) {
      return { filed: 0, total: records.length, reason: "this device is not connected to the school records" };
    }

    const failures: string[] = [];
    let filed = 0;
    for (const record of records) {
      if (!record.admissionNo?.trim()) {
        failures.push(`${record.studentId}: no admission number on this record, so the school cannot say which child it rates`);
        continue;
      }
      const result = await saveAssessmentOnServer(record);
      if (result.ok) filed++;
      else failures.push(`${record.admissionNo}: ${result.reason}`);
    }

    const summary = `The assessments for ${records.length} pupil${records.length === 1 ? "" : "s"}`;
    if (failures.length > 0) {
      reportSyncFailure(`${summary} were NOT saved to the school records — ${failures.length} refused (${failures[0]}).`);
      return { filed, total: records.length, reason: failures[0] };
    }

    reportSyncSaved(`${summary} saved to the school records.`);
    return { filed, total: records.length, reason: null };
  };

  return { psychomotorList, savePsychomotorAssessment, getAssessmentForStudent, assessmentsFiled, fileAssessments };
}

// -------------------------------------------------------------
// Hook: Real-Time Configurable Traits Setup Store
// -------------------------------------------------------------
/**
 * The rubric every behaviour rating is written against.
 *
 * It used to be the list compiled into this file plus whatever one browser had
 * added: Setup could invent a trait on the staff-room machine that no other screen
 * in the school would ever offer, and a card printed elsewhere had to name the
 * ratings from a list its reader had never seen. The school's list now comes from
 * /api/traits-config and this device's copy is only what it last read.
 */
export function useRealtimeTraits() {
  const [traits, setTraits] = useState<TraitConfigItem[]>(DEFAULT_TRAITS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.TRAITS);
      if (stored) {
        try {
          setTraits(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(DEFAULT_TRAITS));
      }
    }

    if (isSupabaseConfigured) {
      void fetchTraitsConfigFromSupabase().then((serverTraits) => {
        // null is a refused or failed read, so this browser keeps the list it has
        // and the sync notice has said so. An empty array is the school's answer.
        if (!serverTraits) return;
        setTraits(serverTraits);
        localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(serverTraits));
      });
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

  /** Applies a new list here, on every tab of this device, and on the school's table. */
  const commitTraits = async (updated: TraitConfigItem[]): Promise<string | null> => {
    setTraits(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.TRAITS, JSON.stringify(updated));
      broadcast("TRAITS_UPDATED");
    }

    if (!isSupabaseConfigured) return "this device is not connected to the school records, so the change lives on it alone";
    const result = await saveTraitsConfigOnServer(updated);
    return result.ok ? null : (result.reason ?? "the school's records did not take the change");
  };

  const addTrait = (newTrait: Omit<TraitConfigItem, "id">): Promise<string | null> =>
    commitTraits([...traits, { ...newTrait, id: `tr-${Date.now()}` }]);

  const deleteTrait = (traitId: string): Promise<string | null> =>
    commitTraits(traits.filter((t) => t.id !== traitId));

  const resetTraitsToDefault = (): Promise<string | null> => commitTraits(DEFAULT_TRAITS);

  return { traits, addTrait, deleteTrait, resetTraitsToDefault };
}

// -------------------------------------------------------------
// Hook: Real-Time Class Arms Store
// -------------------------------------------------------------
// The arm list decides which year a fee is priced for, which classes appear in
// the CA grid, and who is moved at promotion, so twelve screens group by it. It
// used to be whatever this browser cached, which meant the office's machine was
// the only one holding the school's real list.
export function useRealtimeClasses() {
  const [classes, setClasses] = useState<ClassArmRecord[]>(DEFAULT_CLASSES);
  const [classesSource, setClassesSource] = useState<"server" | "device">("device");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CLASSES);
      if (stored) {
        try {
          setClasses(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
      }
    }

    if (isSupabaseConfigured) {
      fetchClassArmsFromSupabase().then((serverArms) => {
        // null means the list was not read, so the device copy stays on screen
        // rather than an empty year-group list that every filter would obey.
        if (serverArms === null) return;
        setClasses(serverArms);
        setClassesSource("server");
        localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(serverArms));
      });
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

  /** Puts the school's own list on screen, and says whether it was read. */
  const showServerArms = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchClassArmsFromSupabase().then((serverArms) => {
      if (serverArms === null) return false;
      setClasses(serverArms);
      setClassesSource("server");
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(serverArms));
      broadcast("CLASSES_UPDATED");
      return true;
    });
  };

  /**
   * Files an arm on the school's list, then shows the list back as the server
   * stored it. Nothing appears before the server has taken it, so an arm the
   * office was refused cannot be picked by the fee or CA screens afterwards.
   */
  const addClass = async (
    arm: Omit<ClassArmInput, "id">
  ): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so no arm was filed" };
    }

    const outcome = await saveClassArmOnServer(arm);
    if (outcome.ok) await showServerArms();
    return outcome;
  };

  const deleteClass = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeClassArmOnServer(id);
    if (outcome.ok) await showServerArms();
    return outcome;
  };

  return { classes, classesSource, addClass, deleteClass, reloadClasses: showServerArms };
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
        } catch {}
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

    if (!isSupabaseConfigured) {
      return Promise.resolve({
        login: null,
        loginError: "this device is not connected to the school database",
      });
    }

    // Resolved by the caller: the generated password is shown once on the
    // credential slip and is not kept anywhere else.
    return insertStaffToSupabase(newMember);
  };

  const bulkAddStaff = async (newStaffList: Omit<StaffRecord, "id">[]): Promise<BulkStaffResult> => {
    if (!isSupabaseConfigured) {
      return {
        saved: 0,
        logins: [],
        failures: ["this device is not connected to the school database, so nobody was onboarded"],
      };
    }

    // Every row goes to the server before it appears on the list. An import
    // that only wrote localStorage announced 40 members as onboarded, showed
    // them until the page reloaded, and issued no login for any of them.
    const result = await bulkInsertStaffOnServer(newStaffList.map((item) => ({ ...item, id: "" })));

    if (result.saved > 0) {
      const refreshed = await fetchStaffFromSupabase();
      if (refreshed) {
        setStaff(refreshed);
        localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(refreshed));
        broadcast("STAFF_UPDATED");
      }
    }

    return result;
  };

  /**
   * Removes a member from the school's records, not just from this browser.
   * Returns the server's answer so the register can repeat a warning about a
   * login it could not suspend; on any refusal the list is left as it was,
   * because a name the office cannot remove is not a name to hide.
   */
  const deleteStaff = (staffId: string) => {
    if (!isSupabaseConfigured) {
      return Promise.resolve({
        ok: false,
        reason: "this device is not connected to the school database",
        warning: null,
      });
    }

    return deleteStaffFromSupabase(staffId).then((outcome) => {
      if (!outcome.ok) return outcome;

      const updated = staff.filter((s) => s.staffId !== staffId);
      setStaff(updated);
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updated));
      broadcast("STAFF_UPDATED");
      return outcome;
    });
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
// Hook: The Exam Question Bank (the school's records, this browser's copy only
// as a fallback)
// -------------------------------------------------------------
// The bank decides what every candidate in the room is examined on, so it cannot
// be whatever one machine imported. The device copy is kept only to show while
// the school's bank is being read, and `questionsSource` says which of the two
// is on screen — the CBT screen refuses to call a device copy a paper.
export function useRealtimeCBTQuestions() {
  const [questions, setQuestions] = useState<CBTQuestionRecord[]>(INITIAL_CBT_QUESTIONS);
  const [questionsSource, setQuestionsSource] = useState<"server" | "device">("device");

  const showServerQuestions = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchCBTQuestionsFromSupabase().then((serverQuestions) => {
      if (serverQuestions === null) return false;
      setQuestions(serverQuestions);
      setQuestionsSource("server");
      localStorage.setItem(STORAGE_KEYS.CBT_QUESTIONS, JSON.stringify(serverQuestions));
      return true;
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CBT_QUESTIONS);
      if (stored) {
        try {
          setQuestions(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CBT_QUESTIONS, JSON.stringify(INITIAL_CBT_QUESTIONS));
      }
    }

    if (isSupabaseConfigured) {
      showServerQuestions();
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

  /**
   * Files questions on the school's bank, then re-reads it.
   *
   * A question the school refused is not put on screen from the browser's copy:
   * the list that appears afterwards is the list the database handed back, so an
   * option set with no answer in it never reaches a candidate.
   */
  const addQuestions = async (
    list: Omit<CBTQuestionInput, "id">[]
  ): Promise<{ ok: boolean; saved: number; reason: string | null }> => {
    if (list.length === 0) return { ok: false, saved: 0, reason: "No question was sent." };

    if (!isSupabaseConfigured) {
      return {
        ok: false,
        saved: 0,
        reason: "this device is not connected to the school database, so no question was filed",
      };
    }

    const outcome = await saveCBTQuestionsOnServer(list);
    if (!outcome.ok) return { ok: false, saved: 0, reason: outcome.reason };

    await showServerQuestions();
    return { ok: true, saved: outcome.saved, reason: null };
  };

  /** Corrects a question already on the bank, keeping the number it is filed under. */
  const updateQuestion = async (
    question: CBTQuestionInput
  ): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so nothing was corrected" };
    }
    if (!question.id) return { ok: false, reason: "this question is not on the school's bank yet, so it has no record to correct" };

    const outcome = await saveCBTQuestionsOnServer([question]);
    if (outcome.ok) await showServerQuestions();
    return { ok: outcome.ok, reason: outcome.reason };
  };

  const removeQuestion = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeCBTQuestionOnServer(id);
    if (outcome.ok) await showServerQuestions();
    return { ok: outcome.ok, reason: outcome.reason };
  };

  return {
    questions,
    questionsSource,
    addQuestions,
    updateQuestion,
    removeQuestion,
    reloadQuestions: showServerQuestions,
  };
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
        } catch {}
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

  /**
   * Records a payment the bursar actually took.
   *
   * The school's answer is what changes the list: the server files a receipt and
   * moves the balance in one call, so a sum shown as cleared here is a payment
   * somebody signed for, not a number a browser liked.
   */
  const recordPayment = async (
    invoiceId: string,
    paymentAmount: number,
    meta: { paymentChannel: string; bankReference: string }
  ): Promise<{
    ok: boolean;
    invoice: InvoiceRecord | null;
    receipt: ReceiptDetails | null;
    reason: string | null;
  }> => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) {
      return { ok: false, invoice: null, receipt: null, reason: "that invoice is not on this screen any more" };
    }
    if (!isSupabaseConfigured) {
      return { ok: false, invoice: null, receipt: null, reason: "this device is not connected to the school database" };
    }

    const outcome = await recordPaymentOnServer({
      invoiceNo: target.invoiceNo,
      amount: paymentAmount,
      paymentChannel: meta.paymentChannel,
      bankReference: meta.bankReference,
    });

    if (!outcome.ok || !outcome.filed) {
      return { ok: false, invoice: null, receipt: null, reason: outcome.reason };
    }

    const updatedInvoice: InvoiceRecord = {
      ...target,
      amountPaid: outcome.filed.invoice.amountPaid,
      paymentStatus: outcome.filed.invoice.paymentStatus as InvoiceRecord["paymentStatus"],
      lastPaymentDate: outcome.filed.invoice.lastPaymentDate,
    };
    const updated = invoices.map((inv) => (inv.id === invoiceId ? updatedInvoice : inv));
    setInvoices(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));
      broadcast("INVOICES_UPDATED");
    }

    return {
      ok: true,
      invoice: updatedInvoice,
      receipt: outcome.filed.receipt,
      reason: null,
    };
  };

  /**
   * Files a generated run of invoices and shows the school's own list back.
   *
   * Generated invoices did not exist anywhere until a bulk request went out,
   * and the screen announced "Generated 34 new student invoices!" whether or not
   * the server took them. Now nothing joins the ledger until it is filed.
   */
  const addInvoices = async (
    generated: InvoiceRecord[]
  ): Promise<{ saved: number; reason: string | null }> => {
    if (generated.length === 0) return { saved: 0, reason: "no invoice was generated" };
    if (!isSupabaseConfigured) {
      return { saved: 0, reason: "this device is not connected to the school database" };
    }

    const reason = await bulkSaveInvoicesToSupabase(generated);
    if (reason) return { saved: 0, reason };

    const refreshed = await fetchInvoicesFromSupabase();
    if (refreshed) {
      setInvoices(refreshed);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(refreshed));
      }
      broadcast("INVOICES_UPDATED");
    } else {
      const updated = [...generated, ...invoices];
      setInvoices(updated);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));
      broadcast("INVOICES_UPDATED");
    }

    return { saved: generated.length, reason: null };
  };

  return { invoices, recordPayment, addInvoices };
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
        } catch {}
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
  isCompulsory?: boolean;
}

export const INITIAL_SUBJECTS: SubjectRecord[] = [];

export function useRealtimeSubjects() {
  const [subjects, setSubjects] = useState<SubjectRecord[]>(INITIAL_SUBJECTS);
  const [subjectsSource, setSubjectsSource] = useState<"server" | "device">("device");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (stored) {
        try {
          setSubjects(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
      }
    }

    if (isSupabaseConfigured) {
      fetchSubjectsFromSupabase().then((serverSubjects) => {
        if (serverSubjects === null) return;
        setSubjects(serverSubjects);
        setSubjectsSource("server");
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(serverSubjects));
      });
    }

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type === "SUBJECTS_UPDATED" && typeof window !== "undefined") {
        const stored = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
        if (stored) {
          try {
            setSubjects(JSON.parse(stored));
          } catch {}
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

  const showServerSubjects = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchSubjectsFromSupabase().then((serverSubjects) => {
      if (serverSubjects === null) return false;
      setSubjects(serverSubjects);
      setSubjectsSource("server");
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(serverSubjects));
      broadcast("SUBJECTS_UPDATED");
      return true;
    });
  };

  /**
   * Files subjects on the school's list and reloads it from the server.
   *
   * The same name in the same band is one row, so re-sending a corrected paper
   * updates it instead of adding a second line the CA grid would have to choose
   * between.
   */
  const addSubjects = async (
    list: Omit<SubjectInput, "id">[]
  ): Promise<{ ok: boolean; saved: number; reason: string | null }> => {
    if (list.length === 0) return { ok: false, saved: 0, reason: "No subject was sent." };

    if (!isSupabaseConfigured) {
      return {
        ok: false,
        saved: 0,
        reason: "this device is not connected to the school database, so no subject was filed",
      };
    }

    const outcome = await saveSubjectsOnServer(list);
    if (outcome.reason) return { ok: false, saved: 0, reason: outcome.reason };

    await showServerSubjects();
    return { ok: true, saved: list.length, reason: null };
  };

  const deleteSubject = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeSubjectsOnServer([id]);
    if (outcome.ok) await showServerSubjects();
    return { ok: outcome.ok, reason: outcome.reason };
  };

  /**
   * Removes every subject the school holds.
   *
   * This is the one action on this screen that takes something away from every
   * other machine, so the caller asks for it by name and the server answers with
   * the subjects that still have marks filed behind them.
   */
  const clearAllSubjects = async (): Promise<{ ok: boolean; reason: string | null; stillFiled: string[] }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database", stillFiled: [] };
    }

    // The server decides which of these are rows at all — a browser-invented id
    // is not one, and it says so rather than quietly removing nothing.
    const outcome = await removeSubjectsOnServer(subjects.map((s) => s.id));
    if (outcome.ok) await showServerSubjects();
    return { ok: outcome.ok, reason: outcome.reason, stillFiled: outcome.stillFiled };
  };

  return {
    subjects,
    subjectsSource,
    addSubjects,
    deleteSubject,
    clearAllSubjects,
    reloadSubjects: showServerSubjects,
  };
}

// -------------------------------------------------------------
// Hook: The Academic Calendar (the school's own term plan)
// -------------------------------------------------------------
// The dates a term runs by decide when families send a child with a uniform and
// when staff meet the score-entry deadline, so a list kept in one browser was
// never the school's plan — it was one person's cache. `calendarSource` is the
// part the screen needs: rows that came off this device can look identical to
// the school's calendar while being nothing anybody else has seen, and a circular
// drawn from them would publish dates no office filed.
export function useRealtimeCalendar() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>(INITIAL_CALENDAR);
  const [calendarSource, setCalendarSource] = useState<"server" | "device">("device");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CALENDAR);
      if (stored) {
        try {
          setCalendarEvents(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(INITIAL_CALENDAR));
      }
    }

    if (isSupabaseConfigured) {
      fetchCalendarEventsFromSupabase().then((serverEvents) => {
        // null means the calendar was not read, so the device copy stays on
        // screen rather than an empty term the school may not have planned.
        if (serverEvents === null) return;
        setCalendarEvents(serverEvents);
        setCalendarSource("server");
        localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(serverEvents));
      });
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

  /** Puts the school's own calendar on screen, and says whether it was read. */
  const showServerCalendar = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchCalendarEventsFromSupabase().then((serverEvents) => {
      if (serverEvents === null) return false;
      setCalendarEvents(serverEvents);
      setCalendarSource("server");
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(serverEvents));
      broadcast("CALENDAR_UPDATED");
      return true;
    });
  };

  /**
   * Files milestones on the school's calendar, then shows the calendar back as
   * the server stored it. A row the office was refused never appears on screen,
   * so a date nobody approved cannot be picked up by the next circular.
   */
  const addCalendarEvents = async (
    list: Omit<CalendarEventInput, "id">[]
  ): Promise<{ ok: boolean; saved: number; reason: string | null }> => {
    if (list.length === 0) return { ok: false, saved: 0, reason: "No milestone was sent." };

    if (!isSupabaseConfigured) {
      return {
        ok: false,
        saved: 0,
        reason: "this device is not connected to the school database, so no milestone was filed",
      };
    }

    const outcome = await saveCalendarEventsOnServer(list);
    if (outcome.reason) return { ok: false, saved: 0, reason: outcome.reason };

    await showServerCalendar();
    return { ok: true, saved: list.length, reason: null };
  };

  const setMilestoneStatus = async (
    id: string,
    status: CalendarEventRecord["status"]
  ): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await setCalendarStatusOnServer(id, status);
    if (outcome.ok) await showServerCalendar();
    return outcome;
  };

  const deleteCalendarEvent = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeCalendarEventsOnServer([id]);
    if (outcome.ok) await showServerCalendar();
    return { ok: outcome.ok, reason: outcome.reason };
  };

  /**
   * Clears the school's calendar.
   *
   * This is the one action on the screen that takes dates away from every other
   * machine, and it cannot be undone — there is no archive of a term's plan.
   */
  const clearAllCalendarEvents = async (): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    // The server decides which of these are rows at all — a browser-invented id
    // is not one, and it says so rather than quietly removing nothing.
    const outcome = await removeCalendarEventsOnServer(calendarEvents.map((event) => event.id));
    if (outcome.ok) await showServerCalendar();
    return { ok: outcome.ok, reason: outcome.reason };
  };

  return {
    calendarEvents,
    calendarSource,
    addCalendarEvents,
    setMilestoneStatus,
    deleteCalendarEvent,
    clearAllCalendarEvents,
    reloadCalendar: showServerCalendar,
  };
}

// -------------------------------------------------------------
// Hook: Fee Structure & Components (the school's own schedule)
// -------------------------------------------------------------

export interface FeeSaveResult {
  saved: number;
  failures: string[];
  /** True when the schedule on screen is the one filed on the school's records. */
  fromServer: boolean;
}

/**
 * The fee schedule prices every invoice, so it cannot live in one browser.
 *
 * `feesSource` is the part the screens need: a list read from this device's
 * cache can look identical to the school's schedule while being somebody's
 * unpublished draft, and a bill built from it would quote amounts nobody else
 * can check. Invoicing refuses to price from a device-only schedule.
 */
export function useRealtimeFees() {
  const [fees, setFees] = useState<FeeComponentRecord[]>(INITIAL_FEES);
  const [feesSource, setFeesSource] = useState<"server" | "device">("device");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.FEES);
      if (stored) {
        try {
          setFees(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(INITIAL_FEES));
      }
    }

    if (isSupabaseConfigured) {
      fetchFeeComponentsFromSupabase().then((serverFees) => {
        if (serverFees === null) return;
        setFees(serverFees);
        setFeesSource("server");
        localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(serverFees));
      });
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

  const showServerSchedule = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchFeeComponentsFromSupabase().then((serverFees) => {
      if (serverFees === null) return false;
      setFees(serverFees);
      setFeesSource("server");
      localStorage.setItem(STORAGE_KEYS.FEES, JSON.stringify(serverFees));
      broadcast("FEES_UPDATED");
      return true;
    });
  };

  /**
   * Files fee items on the school's schedule, then shows the schedule back as
   * the server stored it — including the session and term it was filed under,
   * which is the school's current one rather than this device's.
   *
   * Nothing is added to the list before the server has taken it, so a refused
   * price cannot sit on screen and get billed from.
   */
  const saveFeeComponents = async (items: Omit<FeeComponentRecord, "id">[]): Promise<FeeSaveResult> => {
    if (items.length === 0) return { saved: 0, failures: [], fromServer: feesSource === "server" };

    if (!isSupabaseConfigured) {
      return {
        saved: 0,
        failures: ["this device is not connected to the school database, so no price was filed"],
        fromServer: false,
      };
    }

    const { saved, reason } = await saveFeeComponentsOnServer(
      items.map((item) => ({ ...item, id: "" }))
    );
    if (reason) return { saved: 0, failures: [reason], fromServer: feesSource === "server" };

    await showServerSchedule();
    return { saved: saved.length, failures: [], fromServer: true };
  };

  const removeFeeComponent = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeFeeComponentOnServer(id);
    if (outcome.ok) await showServerSchedule();
    return outcome;
  };

  return {
    fees,
    feesSource,
    saveFeeComponents,
    removeFeeComponent,
    reloadFees: showServerSchedule,
  };
}

// -------------------------------------------------------------
// Hook: Real-Time Subject Templates Store
// -------------------------------------------------------------
export function useRealtimeSubjectTemplates() {
  const [templates, setTemplates] = useState<SubjectTemplateRecord[]>(INITIAL_SUBJECT_TEMPLATES);
  const [templatesSource, setTemplatesSource] = useState<"server" | "device">("device");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.SUBJECT_TEMPLATES);
      if (stored) {
        try {
          setTemplates(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(INITIAL_SUBJECT_TEMPLATES));
      }
    }

    if (isSupabaseConfigured) {
      fetchSubjectTemplatesFromSupabase().then((serverTemplates) => {
        if (serverTemplates === null) return;
        setTemplates(serverTemplates);
        setTemplatesSource("server");
        localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(serverTemplates));
      });
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

  const showServerTemplates = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchSubjectTemplatesFromSupabase().then((serverTemplates) => {
      if (serverTemplates === null) return false;
      setTemplates(serverTemplates);
      setTemplatesSource("server");
      localStorage.setItem(STORAGE_KEYS.SUBJECT_TEMPLATES, JSON.stringify(serverTemplates));
      broadcast("SUBJECT_TEMPLATES_UPDATED");
      return true;
    });
  };

  /**
   * Files the packages on the school's records, then reloads them.
   *
   * The CA grid offers these packages as a shortcut to every teacher, so a
   * package that was never filed must not sit on screen and get used from.
   */
  const addTemplates = async (
    list: Omit<SubjectTemplateInput, "id">[]
  ): Promise<{ ok: boolean; saved: number; reason: string | null }> => {
    if (list.length === 0) return { ok: false, saved: 0, reason: "No subject package was sent." };

    if (!isSupabaseConfigured) {
      return {
        ok: false,
        saved: 0,
        reason: "this device is not connected to the school database, so no package was filed",
      };
    }

    const outcome = await saveSubjectTemplatesOnServer(list);
    if (outcome.reason) return { ok: false, saved: 0, reason: outcome.reason };

    await showServerTemplates();
    return { ok: true, saved: list.length, reason: null };
  };

  const deleteTemplate = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeSubjectTemplatesOnServer([id]);
    if (outcome.ok) await showServerTemplates();
    return { ok: outcome.ok, reason: outcome.reason };
  };

  return {
    templates,
    templatesSource,
    addTemplates,
    deleteTemplate,
    reloadTemplates: showServerTemplates,
  };
}

// -------------------------------------------------------------
// Hook: The terminal circular, one per session and term
// -------------------------------------------------------------
// The words on the back of every report card. They used to be one browser's
// localStorage value shared by no machine and by no term: a card printed for
// Third Term carried the resumption date and fee deadline written for First
// under a heading that said Third Term. A bulletin is now filed against the
// session and term it was written for (/api/newsletter), and a term with no
// bulletin prints none rather than borrowing another's.
//
// `bulletinsSource` is what the screens say out loud: "server" means these are
// the school's filed circulars, "device" means the school's list could not be
// read and this machine is showing its own last copy.
function isBulletinShape(value: unknown): value is NewsletterRecord {
  const record = value as NewsletterRecord | null;
  return !!record && typeof record.session === "string" && typeof record.term === "string";
}

function readDeviceBulletins(): NewsletterRecord[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEYS.NEWSLETTER);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    // A browser holding the old single-object bulletin shows nothing rather than
    // a circular with no term on it: the term is the whole point of the row.
    return Array.isArray(parsed) ? parsed.filter(isBulletinShape) : [];
  } catch {
    return [];
  }
}

export function useRealtimeNewsletter() {
  const [bulletins, setBulletins] = useState<NewsletterRecord[]>([]);
  const [bulletinsSource, setBulletinsSource] = useState<"server" | "device">("device");

  useEffect(() => {
    setBulletins(readDeviceBulletins());

    if (isSupabaseConfigured) {
      fetchNewslettersFromSupabase().then((serverBulletins) => {
        // null means nothing was read, so this browser keeps its own copy rather
        // than presenting "no circular has been filed" as a fact about the school.
        if (!serverBulletins) return;
        setBulletins(serverBulletins);
        setBulletinsSource("server");
        localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(serverBulletins));
      });
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "NEWSLETTER_UPDATED") setBulletins(readDeviceBulletins());
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const showServerBulletins = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchNewslettersFromSupabase().then((serverBulletins) => {
      if (!serverBulletins) return false;
      setBulletins(serverBulletins);
      setBulletinsSource("server");
      localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify(serverBulletins));
      broadcast("NEWSLETTER_UPDATED");
      return true;
    });
  };

  /** The circular filed for one session and term, or null when that term has none. */
  const newsletterFor = (session: string, term: string): NewsletterRecord | null =>
    bulletins.find((bulletin) => bulletin.session === session && bulletin.term === term) ?? null;

  /**
   * Files the circular for the term it is labelled with, then shows the school's
   * answer back rather than the draft that was sent.
   */
  const saveBulletin = async (record: NewsletterRecord): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so nothing was filed" };
    }

    const outcome = await saveNewsletterOnServer(record);
    if (outcome.ok) await showServerBulletins();
    return outcome;
  };

  return {
    bulletins,
    bulletinsSource,
    newsletterFor,
    saveBulletin,
    reloadBulletins: showServerBulletins,
  };
}

// -------------------------------------------------------------
// Hook: The report card theme (the school's one standing choice)
// -------------------------------------------------------------
// Which of the six schemes the cards are printed in. It is one row on the
// school's records (/api/report-theme); before that row is read a screen shows
// the portal's built-in scheme and says that is what it is doing. Picking a
// different scheme on the score-card screen is a choice about the sheets in the
// printer and does not come near this value.
const BUILT_IN_REPORT_THEME: ReportTheme = "royal";

interface ThemeOnDevice {
  theme: ReportTheme;
  updatedBy: string;
  updatedAt: string | null;
}

function readDeviceTheme(): ThemeOnDevice | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEYS.REPORT_THEME);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { theme?: unknown; updatedBy?: unknown; updatedAt?: unknown };
    if (typeof parsed?.theme !== "string") return null;
    return {
      theme: parsed.theme as ReportTheme,
      updatedBy: typeof parsed.updatedBy === "string" ? parsed.updatedBy : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return null;
  }
}

function storeThemeOnDevice(cached: ThemeOnDevice) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.REPORT_THEME, JSON.stringify(cached));
  broadcast("REPORT_THEME_UPDATED");
}

export function useRealtimeReportTheme() {
  const [theme, setTheme] = useState<ReportTheme>(BUILT_IN_REPORT_THEME);
  const [themeUpdatedBy, setThemeUpdatedBy] = useState("");
  const [themeUpdatedAt, setThemeUpdatedAt] = useState<string | null>(null);
  const [themeSource, setThemeSource] = useState<"server" | "device">("device");

  const adopt = (cached: ThemeOnDevice | null) => {
    if (!cached) return;
    setTheme(cached.theme);
    setThemeUpdatedBy(cached.updatedBy);
    setThemeUpdatedAt(cached.updatedAt);
  };

  useEffect(() => {
    adopt(readDeviceTheme());

    if (isSupabaseConfigured) {
      fetchReportThemeFromSupabase().then((filed) => {
        // null means the row could not be read — or has never been filed — so
        // this machine keeps showing the built-in scheme and says where it is from.
        if (!filed) return;
        storeThemeOnDevice(filed);
        adopt(filed);
        setThemeSource("server");
      });
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type !== "REPORT_THEME_UPDATED") return;
        // A purge deletes the cached theme, so the screen goes back to the
        // built-in scheme and says that is what it is showing.
        const cachedTheme = readDeviceTheme();
        adopt(cachedTheme ?? { theme: BUILT_IN_REPORT_THEME, updatedBy: "", updatedAt: null });
        if (!cachedTheme) setThemeSource("device");
      };
    }
    return () => {
      channel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showServerTheme = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchReportThemeFromSupabase().then((filed) => {
      if (!filed) return false;
      storeThemeOnDevice(filed);
      adopt(filed);
      setThemeSource("server");
      return true;
    });
  };

  /** Files the school's theme, then reads it back so the screen shows the answer. */
  const fileTheme = async (next: ReportTheme): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so nothing was filed" };
    }

    const outcome = await saveReportThemeOnServer(next);
    if (outcome.ok) await showServerTheme();
    return outcome;
  };

  return {
    theme,
    themeSource,
    themeUpdatedBy,
    themeUpdatedAt,
    fileTheme,
    reloadTheme: showServerTheme,
  };
}

// -------------------------------------------------------------
// Hook: The CA component structure of each tier
// -------------------------------------------------------------
// What a tier's assessment is made of. This used to be four distributions
// compiled into the portal and editable only in one browser's localStorage, so
// every machine disagreed about what the school's assessment was — and the
// invented one won until somebody typed over it.
//
// What filing a structure does NOT do is change a computed mark. The gradebook
// and /api/ca still add the five columns written into that code, so the CA screen
// says plainly that this record is what the school states, not a re-grading.
function readDeviceStructures(): Record<string, CAStructureFile> {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(STORAGE_KEYS.CA_STRUCTURES);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as Record<string, { components?: unknown; description?: unknown }>;
    const files: Record<string, CAStructureFile> = {};
    for (const [tierKey, value] of Object.entries(parsed ?? {})) {
      if (!Array.isArray(value?.components)) continue;
      const key = tierKey as CATierKey;
      if (!CA_TIER_KEYS.includes(key)) continue;
      files[key] = {
        tierKey: key,
        description: typeof value.description === "string" ? value.description : "",
        updatedBy: "",
        updatedAt: null,
        components: value.components.flatMap((entry) => {
          const component = entry as { key?: unknown; name?: unknown; maxScore?: unknown; description?: unknown };
          if (typeof component?.name !== "string" || !component.name) return [];
          return [
            {
              key: typeof component.key === "string" ? component.key : component.name.toLowerCase().replace(/\W+/g, "_"),
              name: component.name,
              maxScore: Number(component.maxScore) || 0,
              description: typeof component.description === "string" ? component.description : "",
            },
          ];
        }),
      };
    }
    return files;
  } catch {
    return {};
  }
}

export function useRealtimeCAStructure() {
  const [filed, setFiled] = useState<Record<string, CAStructureFile>>({});
  const [caStructuresSource, setCAStructuresSource] = useState<"server" | "device">("device");

  useEffect(() => {
    setFiled(readDeviceStructures());

    if (isSupabaseConfigured) {
      fetchCAStructuresFromSupabase().then((serverStructures) => {
        // null means nothing was read, so the device copy stays rather than an
        // empty set of tiers the school may well have filed already.
        if (!serverStructures) return;
        setFiled(serverStructures);
        setCAStructuresSource("server");
        localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify(serverStructures));
      });
    }

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "CA_STRUCTURES_UPDATED") setFiled(readDeviceStructures());
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  const showServerStructures = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchCAStructuresFromSupabase().then((serverStructures) => {
      if (!serverStructures) return false;
      setFiled(serverStructures);
      setCAStructuresSource("server");
      localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify(serverStructures));
      broadcast("CA_STRUCTURES_UPDATED");
      return true;
    });
  };

  // The four tiers always appear on the screen; a tier with no filed row appears
  // with no components, which the screen calls what it is.
  const caStructures = useMemo(() => {
    const map = {} as Record<CATierKey, TierCAStructure>;
    for (const tierKey of CA_TIER_KEYS) {
      const structure = filed[tierKey];
      map[tierKey] = {
        tierKey,
        tierTitle: CA_TIER_LABELS[tierKey].tierTitle,
        applicableClasses: CA_TIER_LABELS[tierKey].applicableClasses,
        components: structure?.components ?? [],
        description: structure?.description ?? "",
        updatedBy: structure?.updatedBy ?? "",
        updatedAt: structure?.updatedAt ?? null,
      };
    }
    return map;
  }, [filed]);

  /** Files one tier's whole component list, then shows the school's answer back. */
  const fileTierStructure = async (
    tierKey: CATierKey,
    structure: { components: CAComponentItem[]; description: string }
  ): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so nothing was filed" };
    }

    const outcome = await saveCAStructuresOnServer([{ tierKey, components: structure.components, description: structure.description }]);
    if (outcome.ok) await showServerStructures();
    return outcome;
  };

  /**
   * Files the built-in starting outline for all four tiers, for an office that
   * agrees with it and wants to correct it afterwards. Nothing is filed until
   * this button is pressed, and the toast says it is an outline rather than the
   * school's approved structure.
   */
  const fileStandardOutline = async (): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so nothing was filed" };
    }

    const structures: CAStructureInput[] = CA_TIER_KEYS.map((tierKey) => ({
      tierKey,
      description: STANDARD_CA_OUTLINE[tierKey].description,
      components: STANDARD_CA_OUTLINE[tierKey].components,
    }));

    const outcome = await saveCAStructuresOnServer(structures);
    if (outcome.ok) await showServerStructures();
    return outcome;
  };

  return {
    caStructures,
    caStructuresSource,
    fileTierStructure,
    fileStandardOutline,
    reloadCAStructures: showServerStructures,
  };
}

// -------------------------------------------------------------
// Hook: Activity Templates (the school's own blueprints)
// -------------------------------------------------------------
// A template is copied into a milestone when the office schedules one, so its
// words — coordinator, venue, budget — end up on the published plan. Keeping
// them in one browser meant the copy a family saw could be a draft nobody else
// had approved, and the six templates compiled into the portal were not this
// school's at all. `activityTemplatesSource` is what the screen says out loud.
export function useRealtimeActivityTemplates() {
  const [activityTemplates, setActivityTemplates] = useState<ActivityTemplateRecord[]>([]);
  const [activityTemplatesSource, setActivityTemplatesSource] = useState<"server" | "device">("device");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITY_TEMPLATES);
      if (stored) {
        try {
          setActivityTemplates(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify([]));
      }
    }

    if (isSupabaseConfigured) {
      fetchActivityTemplatesFromSupabase().then((serverTemplates) => {
        // null means nothing was read, so the device copy stays rather than an
        // empty blueprint list the school may not actually have.
        if (serverTemplates === null) return;
        setActivityTemplates(serverTemplates);
        setActivityTemplatesSource("server");
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(serverTemplates));
      });
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

  const showServerTemplates = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchActivityTemplatesFromSupabase().then((serverTemplates) => {
      if (serverTemplates === null) return false;
      setActivityTemplates(serverTemplates);
      setActivityTemplatesSource("server");
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify(serverTemplates));
      broadcast("ACTIVITY_TEMPLATES_UPDATED");
      return true;
    });
  };

  /**
   * Files a blueprint on the school's records, then shows the list back as the
   * server stored it. A template the office was refused — a title that is
   * already on the list, a duration that is not a length of days — never reaches
   * the screen, so it cannot be scheduled into a term from a cache.
   */
  const addActivityTemplate = async (
    template: Omit<ActivityTemplateInput, "id">
  ): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database, so no template was filed" };
    }

    const outcome = await saveActivityTemplateOnServer(template);
    if (outcome.ok) await showServerTemplates();
    return outcome;
  };

  const deleteActivityTemplate = async (id: string): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      return { ok: false, reason: "this device is not connected to the school database" };
    }

    const outcome = await removeActivityTemplateOnServer(id);
    if (outcome.ok) await showServerTemplates();
    return outcome;
  };

  return {
    activityTemplates,
    activityTemplatesSource,
    addActivityTemplate,
    deleteActivityTemplate,
    reloadActivityTemplates: showServerTemplates,
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
            handOverBrowser(session.username);
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

  /**
   * Adopts the person the server just authenticated. There is no fallback
   * profile: the screen used to invent "Dr. Dominic Mark, RCA/PERS/025" for a
   * SUPER_ADMIN role when no profile was supplied, and every card, greeting and
   * audit trail then carried that invented name.
   */
  const loginWithRole = (
    role: "SUPER_ADMIN" | "EXAM_OFFICER" | "TEACHER" | "ACCOUNTANT" | "STUDENT_PARENT" | "TESTERS",
    profile: { username: string; fullName: string; staffId?: string; email?: string }
  ) => {
    const targetUser: AuthUserSession = {
      id: profile.username,
      username: profile.username,
      fullName: profile.fullName,
      role,
      staffId: profile.staffId ?? "",
      email: profile.email,
      loginTime: new Date().toISOString(),
    };
    setCurrentUser(targetUser);
    if (typeof window !== "undefined") {
      handOverBrowser(targetUser.username);
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
// Hook: The CBT lockdown switch (the school's records)
// -------------------------------------------------------------
// One row on the school's database says whether the module is open, what it is
// being used for and what a candidate is told when it is shut. It used to be a
// browser's localStorage under that name, so moving the switch in Settings
// changed nothing on any other machine — an exam could be sat while the office
// believed the module was closed. The device copy remains only as what is shown
// before the row is read; `configSource` says which of the two is on screen.
export function useRealtimeCBTConfig() {
  const [cbtConfig, setCBTConfig] = useState<CBTConfigRecord>(DEFAULT_CBT_CONFIG);
  const [configSource, setConfigSource] = useState<"server" | "device">("device");

  const showServerConfig = (): Promise<boolean> => {
    if (!isSupabaseConfigured) return Promise.resolve(false);
    return fetchCBTConfigFromSupabase().then((serverConfig) => {
      if (serverConfig === null) return false;
      setCBTConfig(serverConfig);
      setConfigSource("server");
      localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(serverConfig));
      return true;
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.CBT_CONFIG);
      if (stored) {
        try {
          setCBTConfig(JSON.parse(stored));
        } catch {}
      } else {
        localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(DEFAULT_CBT_CONFIG));
      }
    }

    if (isSupabaseConfigured) {
      showServerConfig();
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
            } catch {}
          }
        }
      };
    }
    return () => {
      channel?.close();
    };
  }, []);

  /**
   * Saves the switch and the notice that goes with it, then shows what the
   * school actually holds.
   *
   * Opening the module is refused unless it names a purpose and the hours it
   * runs in, and the refusal is returned rather than smoothed over: a screen
   * that looked open after a refusal would be the exact lie this table exists
   * to stop.
   */
  const updateCBTConfig = async (
    updates: Partial<CBTConfigRecord>
  ): Promise<{ ok: boolean; reason: string | null }> => {
    if (!isSupabaseConfigured) {
      const local: CBTConfigRecord = { ...cbtConfig, ...updates, updatedAt: new Date().toISOString() };
      setCBTConfig(local);
      localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(local));
      broadcast("CBT_CONFIG_UPDATED");
      return {
        ok: false,
        reason: "this device is not connected to the school database, so the switch only moved on this browser",
      };
    }

    const outcome = await saveCBTConfigOnServer(updates);
    if (!outcome.ok) return { ok: false, reason: outcome.reason };

    if (outcome.config) {
      setCBTConfig(outcome.config);
      setConfigSource("server");
      localStorage.setItem(STORAGE_KEYS.CBT_CONFIG, JSON.stringify(outcome.config));
    }
    broadcast("CBT_CONFIG_UPDATED");
    return { ok: true, reason: null };
  };

  const toggleCBTAccess = (explicitState?: boolean) =>
    updateCBTConfig({ isOpen: typeof explicitState === "boolean" ? explicitState : !cbtConfig.isOpen });

  return {
    cbtConfig,
    configSource,
    updateCBTConfig,
    toggleCBTAccess,
    reloadConfig: showServerConfig,
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
  localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify({}));
  localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify([]));
  localStorage.removeItem(STORAGE_KEYS.REPORT_THEME);
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
  broadcast("REPORT_THEME_UPDATED");
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
  // The CA structures and the circulars have no built-in answer to put back:
  // what this browser holds is either what the school filed or nothing, and
  // "nothing" is what a fresh device copy means.
  localStorage.setItem(STORAGE_KEYS.CA_STRUCTURES, JSON.stringify({}));
  localStorage.setItem(STORAGE_KEYS.ACTIVITY_TEMPLATES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.NEWSLETTER, JSON.stringify([]));
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
