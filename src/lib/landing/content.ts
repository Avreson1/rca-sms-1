export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  tag: string;
  paragraphs: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  category: "Campus" | "Academics" | "Events" | "Sports & Clubs";
  gradient: string;
  image?: string;
}

// Editorial content for the public site. Replace with real announcements
// when there is a CMS or database table behind the blog.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "2025-2026-first-term-begins",
    title: "2025/2026 Academic Session: First Term Begins",
    excerpt:
      "All pupils and students resume with a full timetable, fresh CA structures, and updated house assignments.",
    date: "2025-09-15",
    author: "ICT Directorate",
    tag: "Announcement",
    paragraphs: [
      "Royal Crown Academy resumes the 2025/2026 academic session, First Term, with full reporting for all classes from Pre-Play Class through Senior Secondary 3.",
      "Continuous assessment this session follows the approved 40:60 structure — four CA components of ten marks each, plus a sixty-mark terminal examination. Teachers have already received their subject and class assignments in the portal.",
      "Parents can track term progress, invoices, and published report cards through the VCS portal using the login credentials issued by the school office.",
    ],
  },
  {
    slug: "multi-tier-grading-system",
    title: "Our Multi-Tier Grading System, Explained",
    excerpt:
      "Why a Play Class pupil and an SS 3 student are assessed on different scales — and how each tier works.",
    date: "2025-08-02",
    author: "Academic Directorate",
    tag: "Academics",
    paragraphs: [
      "Developmental evaluation differs radically between toddler stages and senior secondary education, so the academy operates four grading tiers: Creche & Playgroup, Nursery, Basic Primary, and Secondary (JSS/SSS).",
      "Early tiers use expectation-based descriptors (Exceeding Expectations, Meeting Expectations, Approaching Expectations, Emerging), while the secondary tier follows the standard A1–F9 examination scale aligned with WAEC and NECO reporting.",
      "Every tier's thresholds are configurable centrally by the exam officer, and gradebooks recompute automatically whenever a scale is adjusted — no manual re-marking required.",
    ],
  },
  {
    slug: "cbt-examinations-rollout",
    title: "Computer-Based Testing Rolls Out Across Senior Classes",
    excerpt:
      "SS classes now take terminal examinations on the CBT engine, with scores syncing straight into the 60-mark exam column.",
    date: "2025-07-10",
    author: "ICT Directorate",
    tag: "Technology",
    paragraphs: [
      "The academy's CBT engine now handles terminal examinations for senior classes. Question banks are prepared by subject teachers, assembled by the exam officer, and delivered inside the portal.",
      "Scores from completed CBT sessions scale automatically into the sixty-point examination column of each student's gradebook, eliminating transcription errors between the exam room and the broadsheet.",
      "JSS classes will join the rollout in the second term after the question-bank pilot concludes.",
    ],
  },
  {
    slug: "house-system-revamp",
    title: "House System Revamp: Four Houses, One Crown",
    excerpt:
      "Sapphire, Ruby, Emerald and Topaz return with a fresh points matrix spanning academics, conduct, and sports.",
    date: "2025-06-21",
    author: "Student Affairs",
    tag: "Community",
    paragraphs: [
      "Every student belongs to one of four houses — Sapphire (Blue), Ruby (Red), Emerald (Green), and Topaz (Yellow) — and the inter-house competition now awards points across academics, conduct ratings, attendance, and sports.",
      "House points are recorded in the portal as they happen, and the live standings are visible to every student on the houses board.",
      "The term ends with the Crown House Trophy awarded to the leading house at the prize-giving assembly.",
    ],
  },
];

// Gallery plates. The campus tile carries original artwork drawn for this
// portal; the rest are six labelled hues from the palette, so the tiles stay
// apart without pretending to be photographs the school has not taken yet.
// Drop real images into public/ and set the image field when there are
// photographs to show.
export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "campus-gate",
    title: "The Main Gate",
    caption: "No 5 Resort Road, Rayfield — welcome to the academy.",
    category: "Campus",
    gradient: "from-brand-600 via-brand-800 to-night-900",
    image: "/images/rca-campus.svg",
  },
  {
    id: "early-years",
    title: "Early Years Wing",
    caption: "Montessori-inspired classrooms for Pre-Play and Nursery.",
    category: "Campus",
    gradient: "from-azure-500 via-azure-700 to-night-900",
  },
  {
    id: "science-lab",
    title: "Science & ICT Labs",
    caption: "Practical sessions for JSS and SSS students.",
    category: "Academics",
    gradient: "from-emerald-600 via-emerald-800 to-night-900",
  },
  {
    id: "cbt-hall",
    title: "CBT Examination Hall",
    caption: "Terminal exams delivered on the computer-based testing engine.",
    category: "Academics",
    gradient: "from-slate-500 via-slate-700 to-night-900",
  },
  {
    id: "prize-giving",
    title: "Prize-Giving Day",
    caption: "Honouring academic excellence and the Crown House Trophy.",
    category: "Events",
    gradient: "from-amber-500 via-amber-700 to-night-900",
  },
  {
    id: "inter-house-sports",
    title: "Inter-House Sports",
    caption: "Sapphire, Ruby, Emerald and Topaz on the field.",
    category: "Sports & Clubs",
    gradient: "from-accent-500 via-accent-700 to-night-900",
  },
];

export const MAP_QUERY = "Royal Crown Academy, No 5 Resort Road, Rayfield, Jos South, Plateau State, Nigeria";
export const MAPS_EMBED_URL = `https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=15&output=embed`;
export const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(MAP_QUERY)}`;
