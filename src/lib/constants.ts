export const SCHOOL_INFO = {
  name: "Royal Crown Academy",
  shortName: "RCA",
  address: "No 5 Resort Road, Rayfield, Jos South LGA, Plateau State",
  motto: "Excellence and Integrity",
  portalName: "VCS (Virtual Classroom System)",
  currentSession: "2025/2026",
  currentTerm: "First Term",
  email: "admin@royalcrownacademy.edu.ng",
  phone: "0803 123 4567",
  website: "www.royalcrownacademy.edu.ng",
} as const;

// 4-Step Role-Based Access Control (RBAC) System
export const RBAC_STEPS = [
  {
    step: 1,
    role: "SUPER_ADMIN",
    title: "Tier 1: Executive, Proprietor & System Admin",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Full institutional control: tuition structure, staff management, grading policy authorization, and master records.",
    permissions: ["ALL_ACCESS", "SETUP_WRITE", "FINANCE_WRITE", "USER_MGMT", "RESULT_OVERRIDE"],
  },
  {
    step: 2,
    role: "EXAM_OFFICER",
    title: "Tier 2: Academic Directorate & Exam Officer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    description: "Curriculum configuration, adjustable tier grading scales (Pre-Play to Primary 5 & Secondary), CBT management, and result publication.",
    permissions: ["GRADING_SETUP", "CBT_ADMIN", "RESULT_PUBLISH", "TIMETABLE_MGMT", "BROADSHEET_EXPORT"],
  },
  {
    step: 3,
    role: "TEACHER",
    title: "Tier 3: Teaching Staff & Form Masters",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    description: "Continuous Assessment score entry, affective/psychomotor trait matrix ratings, and classroom invigilation.",
    permissions: ["CA_ENTRY", "TRAITS_RATING", "CBT_MONITOR", "ATTENDANCE_WRITE", "CLASS_VIEW"],
  },
  {
    step: 4,
    role: "STUDENT_PARENT",
    title: "Tier 4: Student & Parent Portal",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    description: "View published report cards, take CBT examinations, inspect fee invoices, and download receipts.",
    permissions: ["VIEW_RESULTS", "TAKE_CBT", "VIEW_INVOICES", "MAKE_PAYMENT", "INMAIL_SEND"],
  },
  {
    step: 5,
    role: "TESTERS",
    title: "Tier 5: QA Testers",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    description: "Quality-assurance access: navigate and exercise every module read-only, with no access to settings or destructive actions.",
    permissions: ["MODULE_PREVIEW", "CBT_TAKE", "REPORT_VIEW", "INMAIL_SEND"],
  },
] as const;

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  EXAM_OFFICER: "EXAM_OFFICER",
  TEACHER: "TEACHER",
  STUDENT_PARENT: "STUDENT_PARENT",
  ACCOUNTANT: "ACCOUNTANT",
  TESTERS: "TESTERS",
  ADMIN: "SUPER_ADMIN",
} as const;

// Official School Sections & Class Tiers (Pre-Play, Play, Nursery 1-2, Primary 1-5, JSS & SSS)
export const ALL_SCHOOL_SECTIONS = [
  {
    id: "sec-preplay-play",
    name: "Creche & Playgroup (Pre-Play & Play)",
    code: "EY-PLAY",
    classes: ["Pre-Play Class", "Play Class"],
    gradingModel: "SENSORY_HABITS_DEVELOPMENTAL",
  },
  {
    id: "sec-nursery",
    name: "Nursery School (Nursery 1 - 2)",
    code: "EY-NUR",
    classes: ["Nursery 1", "Nursery 2"],
    gradingModel: "MONTESSORI_EARLY_LITERACY",
  },
  {
    id: "sec-primary",
    name: "Basic Primary Education (Primary 1 - 5)",
    code: "PRI",
    classes: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5"],
    gradingModel: "PRIMARY_DESCRIPTIVE_NUMERIC",
  },
  {
    id: "sec-jss",
    name: "Junior Secondary School (JSS 1 - 3)",
    code: "JSS",
    classes: ["JSS 1", "JSS 2", "JSS 3"],
    gradingModel: "BECE_STANDARD",
  },
  {
    id: "sec-sss",
    name: "Senior Secondary School (SS 1 - 3)",
    code: "SSS",
    classes: ["SS 1", "SS 2", "SS 3"],
    gradingModel: "WAEC_NECO_9POINT",
  },
] as const;

export const ALL_CLASSES = [
  "Pre-Play Class",
  "Play Class",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SS 1",
  "SS 2",
  "SS 3",
];

export const DRAFT_LOGIN_ACCOUNTS = [
  {
    role: "SUPER_ADMIN",
    roleTitle: "Super Administrator / Principal",
    badgeColor: "bg-blue-600 text-white border-blue-700",
    username: "dominic370",
    fullName: "Dr. Dominic Mark",
    staffId: "RCA/PERS/025",
    description: "Complete institutional governance, policy configurations, result authorization & database controls.",
    icon: "ShieldCheck",
  },
  {
    role: "EXAM_OFFICER",
    roleTitle: "Exam Officer / Dean of Studies",
    badgeColor: "bg-cyan-500 text-slate-950 border-cyan-400",
    username: "exam_officer",
    fullName: "Prof. Jeremiah Alabi",
    staffId: "RCA/PERS/012",
    description: "CA weights setup, universal grading rules, broadsheets, CBT management & result locking.",
    icon: "Sliders",
  },
  {
    role: "TEACHER",
    roleTitle: "Form Master / Subject Teacher",
    badgeColor: "bg-emerald-600 text-white border-emerald-700",
    username: "teacher_grace",
    fullName: "Mrs. Grace Adams",
    staffId: "RCA/PERS/048",
    description: "Continuous assessment mark entry, psychomotor domain scoring, remarks & class gradebooks.",
    icon: "GraduationCap",
  },
  {
    role: "ACCOUNTANT",
    roleTitle: "Bursar / Account Officer",
    badgeColor: "bg-amber-500 text-slate-950 border-amber-600",
    username: "bursar_accounts",
    fullName: "Mr. Samuel Danladi",
    staffId: "RCA/PERS/008",
    description: "Fee structure configuration, student invoicing, payment reconciliation & receipt issuance.",
    icon: "Receipt",
  },
  {
    role: "STUDENT_PARENT",
    roleTitle: "Student & Parent Portal",
    badgeColor: "bg-purple-600 text-white border-purple-700",
    username: "parent_rca",
    fullName: "Chief & Mrs. A. Oladipo (Guardian)",
    staffId: "RCA/PAR/104",
    description: "View published terminal scorecards, attendance records, CBT tests & fee clearance receipts.",
    icon: "Users",
  },
] as const;

export const COLOR_THEMES = {
  SCHEME_1: {
    name: "Scheme 1 (Vibrant Royal & Academic Contrast)",
    primary: "#0000FF", // 60% Royal Blue
    secondary: "#00FFFF", // 25% Cyan / Sky Blue
    accent: "#FF0000", // 10% Vivid Red
    surface: "#FFFFFF", // 5% Pure White
  },
  SCHEME_2: {
    name: "Scheme 2 (Deep Corporate & Print Tone - Alternate)",
    primary: "#0B2F9E", // 60% Deep Navy
    secondary: "#FF00FF", // 25% Bright Magenta
    accent: "#D90429", // 10% Crimson Red
    surface: "#F8F9FA", // 5% Off-White / Cream
  },
} as const;

export const CURRENT_USER = {
  id: "u-025",
  fullName: "Dr. Dominic Mark",
  username: "dominic370",
  email: "dominic370@royalcrownacademy.edu.ng",
  staffId: "RCA/PERS/025",
  role: "SUPER_ADMIN",
  assignedSubject: "Information & Communication Technology",
  assignedClass: "SS 2",
} as const;
