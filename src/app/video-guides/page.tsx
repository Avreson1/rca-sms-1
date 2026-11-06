"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth } from "@/lib/realtime-store";
import type { UserRole } from "@/lib/rbac";
import {
  BookOpen,
  ArrowLeft,
  Printer,
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  UserCheck,
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
    summary: "Protocol for laying out a term's milestones on the calendar screen. The calendar is kept on the machine you click it from: it has no place on the school's records yet, so other machines do not see what you add here.",
    prerequisites: [
      "A Super Administrator sign-in of your own. The portal never prints a password on a screen, a slip or a manual — do not look for one here.",
      "The approved academic-year dates from the Ministry of Education and the Board of Governors.",
      "The session and term the school actually is in, set on Setup → School (/setup/school). The header and the filters on every screen read from there.",
    ],
    procedureSteps: [
      "Navigate to Setup → Calendar (/setup/calendar).",
      "Check the session and term named in the header. They come from the school's own record, not from this browser's memory.",
      "When the calendar is still empty, 'Populate Term Milestones' lays the standard week-by-week outline down on this machine. 'Reset Default Templates' does the same for the activity templates.",
      "For each date the school has fixed on its own, click 'Add Calendar Milestone' and enter the title, the date and the category (holiday, examination, vacation).",
      "'Create Activity Template' adds a repeatable item (sports day, inter-house events) that 'Schedule into Term' then drops into the current term on this machine.",
      "Read the notice at the top of the screen: the calendar is saved on this browser only.",
    ],
    safetyRules: [
      "Never alter vacation or examination dates mid-term without written authorization from the Principal.",
      "Because the calendar is not on the school's records, do not treat it as the authority families and staff follow. Announce the dates through the circular until the calendar has a server.",
    ],
    expectedOutput: "A term outline on this machine's calendar. Nothing here has reached the school's records, so a colleague on another machine will not see it.",
  },
  {
    id: "sop-1-2",
    code: "SOP-ADM-002",
    title: "Staff Onboarding, Role Provisioning & Granular Permission Governance",
    role: "Super Administrator / Principal",
    category: "Super Admin",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    minRoleTier: "SUPER_ADMIN",
    summary: "Procedure for registering academic and non-academic staff, setting what each one may change, and issuing the sign-in that the school's records actually accept.",
    prerequisites: [
      "Complete employee bio-data, academic qualifications and departmental designation",
      "The role the person will sign in as (Principal, Vice Principal, Dean of Studies, Form Master, Subject Teacher, Bursar, Admin, or the QA TESTERS role)",
    ],
    procedureSteps: [
      "Navigate to Operations → Staff (/operations/staff).",
      "Click 'Register Staff' to open the registration form, or 'Bulk Upload CSV' with 'CSV Template' for a whole department at once.",
      "Enter Full Legal Name, Staff ID (e.g. RCA/PERS/026), Email, Phone, Role, and the Assigned Subject / Class Arm.",
      "Set the permission checkboxes — 'Can Edit Scores', 'Can Edit Fees', 'Can Publish Results', 'Can Edit Students' — to what the job actually needs. These are the marks the server checks when the person tries to write.",
      "Confirm with 'Register & Grant Permissions'. The profile and its sign-in are filed on the school's records, not on this browser.",
      "Open the new row's 'Access Slip'. The slip prints the username and the password the server made for it, and shows once — it is not kept on screen afterwards.",
      "Hand the slip to the person in person or by a private channel. Credentials are never shown on the public login screen or in this manual.",
    ],
    safetyRules: [
      "Only grant 'Can Publish Results' to the people the Board has named. The screen refuses anyone else, whatever its checkbox once said.",
      "Revoke the account the day a person leaves or moves post: 'Access Slip' and the manager's revoke action end the sign-in on the server, so the old password stops working everywhere at once.",
    ],
    expectedOutput: "A staff profile on the school's records with the permissions its job needs, and one private credential slip issued once to the person who owns it.",
  },
  {
    id: "sop-1-3",
    code: "SOP-ADM-003",
    title: "Zero-Start Database Baseline Purge & Production Initialization",
    role: "Super Administrator",
    category: "Super Admin",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    minRoleTier: "SUPER_ADMIN",
    summary: "Safety protocol for clearing the demo copies this browser is holding when a machine moves from trial to real use — and for knowing exactly what this button does NOT clear.",
    prerequisites: [
      "Super Administrator presence at the machine whose copies are being cleared",
      "A CSV export of anything on this machine that still has to be kept (Operations → Students → 'Export CSV' for the roster; Reports → Master Academic Broadsheet for filed marks)",
    ],
    procedureSteps: [
      "Navigate to Settings (/settings).",
      "Find the 'Live Data Store & Zero-Start Baseline Controls' panel.",
      "Read the prompt on 'Purge All Demo Data (Start 100% Clean)' before answering. It clears the demo copies held on this browser — pupils, staff, scores, invoices, calendar, timetable, this browser's copy of the question bank and inmail — and nothing else. What the school's records hold, including the questions the exam office filed, is untouched.",
      "Confirm only when you accept that this browser's lists cannot be brought back.",
      "Check the roster and the staff list on this machine now read zero (or only your own account for staff).",
      "Understand what is left standing: pupils, marks, invoices, receipts and accounts already filed on the school's own records stay there. This button has never reached them, and a clean-looking screen on this machine is not a clean database.",
    ],
    safetyRules: [
      "This is not a database wipe. Clearing rows on the school's records is done on Supabase by the person who holds the project, with a backup taken first — never from this button.",
      "'Restore Standard Defaults' beside it puts this browser back to the standard demo lists; your own edits to the browser-held lists are dropped and cannot be recovered.",
    ],
    expectedOutput: "This machine's demo lists emptied, with the school's filed records still standing on the server — and the operator aware that the two are different things.",
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
    summary: "Protocol for the two marks-and-grading settings the portal computes from: the CA component weights per tier, and the grading scale. One is still kept on the machine that edits it; the other is filed on the school's records.",
    prerequisites: [
      "The institutional CA formula the Academic Board approved",
      "Access to Setup → CA Structure (/setup/ca-structure) and Setup → Grading Scales (/setup/grading)",
    ],
    procedureSteps: [
      "Navigate to Setup → CA Structure (/setup/ca-structure). The chip at the top says 'EDIT ACCESS GRANTED' or 'READ ONLY VIEW' for the sign-in you are using.",
      "Review the four tiers: 'Play & Preschool' (Creche & Play, Exam 100), 'Nursery 1 & 2' (4 Assessments + Exam), 'Primary 1 – 5' (4 Assessments + Internal/External) and 'JSS 1-3 & SS 1-3' (4 Assessments + CBT Exam).",
      "Edit a component's maximum score, then click 'Save CA Weights'. Read the line beside the button: the change lands on this browser's copy of the structure until the CA structure is saved to the school database. 'Open Live CA Gradebook' shows the marks the pupils actually have.",
      "'Reset All Defaults' returns every tier on this browser to the built-in structure; weights you changed here are dropped and cannot be brought back.",
      "Navigate to Setup → Grading Scales (/setup/grading) and set the brackets per tier. The usual scale is A (70-100), B (60-69), C (50-59), D (45-49 Pass Mark), F (0-44 Fail).",
      "Click 'File Scale On The School's Records'. This one does reach the server: the screen says the scale is filed, or says it was NOT filed and quotes why. Cards printed from now on grade with the filed scale; cards already handed out keep the grades they went out with.",
    ],
    safetyRules: [
      "Do not change CA component weights after the second assessment window has started, whatever machine you are on.",
      "Because the CA weights are still browser-held, one clerk's machine can grade differently from another's. Until the structure has a server, keep the weights on one designated machine and say so in the circular.",
    ],
    expectedOutput: "A grading scale on the school's records that every later score card reads, and CA weights that still live on the machine that set them — with that difference known, not assumed away.",
  },
  {
    id: "sop-2-2",
    code: "SOP-EXM-002",
    title: "Universal Terminal Results Publication & Gradebook Lockdown",
    role: "Exam Officer / Dean of Studies",
    category: "Exam Officer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    minRoleTier: "EXAM_OFFICER",
    summary: "Step-by-step procedure to review each class arm, release its terminal score cards to parents on the school's records, and withdraw a release again when a mark has to be corrected.",
    prerequisites: [
      "CA marks and examination scores entered for the class by its subject teachers (Operations → Update CA)",
      "The session and term the school is in, as filed on Setup → School — this screen reads them and will not guess",
    ],
    procedureSteps: [
      "Navigate to Operations → Publish Results (/operations/publish-results).",
      "Click 'Re-read' to pull the register and the release state from the school's records. The screen names the session and term it is working on.",
      "Read the per-class rows: each says 'Released by … on …' or 'Not released', with how many pupils are on the arm. 'Inspect Score Cards' opens what a parent would see.",
      "Release one arm at a time with its 'Release' button, or the whole school with 'Release every class with marks'. The header counts the release: 'n of m classes released'.",
      "The release is written to the school's records, so it is the same on every machine. If it fails, the notice says so in the same words: 'Publishing did not happen: …' — no silent half-success.",
      "To correct a mark after release, use that arm's 'Withdraw'. The cards come down for parents, the class returns to 'Not released', and the release can be made again after the correction.",
      "'Lock all released classes' stops further mark editing on the arms already released. Before unlocking a class, record who authorized the correction.",
    ],
    safetyRules: [
      "There is no 'Publish All Class Results' banner and no 'Institution Status: 100% Published & Locked' badge on this screen — the count in the header is the whole truth, so read it rather than looking for a green guarantee.",
      "A release only reaches parents once the school's records have the table for it (supabase/operations_state.sql). Until that is run, this screen refuses and says so; nothing has been published.",
    ],
    expectedOutput: "The named session and term with the listed class arms released on the school's records, visible as released on every machine, and each release reversible by 'Withdraw'.",
  },
  {
    id: "sop-2-3",
    code: "SOP-EXM-003",
    title: "Master Timetable Building, Clash Refusal and Teacher Workload",
    role: "Exam Officer / Dean of Studies",
    category: "Exam Officer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    minRoleTier: "EXAM_OFFICER",
    summary: "Procedure for building the term's timetable on the school's records: one lesson in one labelled slot, a teacher who is already booked refused with the other class named, a whole week drafted from a plan a person writes and filed only when that person says so, and the workload read off the same grid a family's schedule is printed from.",
    prerequisites: [
      "A SUPER_ADMIN or EXAM_OFFICER login to file anything — a teacher or QA login can read the grid and ask for a draft, but the Schedule / Assign / Clear controls are not shown, the draft tab says your role can plan a week but not file one, and the server refuses the write",
      "supabase/timetable.sql run on this project. Until it is, the screen prints 'The timetable could not be read' and names that file, and refuses to show an empty week in its place — and 'Draft the week' has no school day to place lessons into, so it answers the same 503 and files nothing",
      "The class arms on the school's records (Setup → Classes) and the staff list on this machine — the arms are read from the database and the staff list is still browser-held",
    ],
    procedureSteps: [
      "Navigate to Operations → Academics (/operations/academics). The header reads 'Academic Operations & Master Timetable' and names the session and term the grid is being read for.",
      "Check the green or amber line under the header. 'n lesson(s) read from the school's records' means the grid is what every machine sees. 'The timetable could not be read' means nothing below is a schedule — run the migration and press 'Refresh'.",
      "Choose the term in the selector beside 'Refresh'. A timetable is a term's document: the session comes from the school's own Settings record, and if that record could not be read the screen says it is using the values compiled into the portal.",
      "If a banner appears saying 'This browser is still holding n period(s)', that is the copy the older version of this screen saved to nothing but itself. Press 'Carry these n period(s) into the school's records'. Rows the school refuses are named one by one — the banner does not claim a save it did not make.",
      "Press 'Schedule Class Period', or any empty cell's 'Assign' button, to open one slot. Pick the subject, choose the teacher from the staff list (or leave 'Not named yet'), and set the room; blank room means the class's own room.",
      "Press 'File On The School's Timetable'. If that teacher already holds another class in the same slot, the save is refused and the message names the other class, day and period. Move one of the two lessons; do not rename a teacher to get past it.",
      "Read the line under the grid: 'Day shape: n teaching period(s) × m days = k slots a week, as the school filed it' — or 'the n periods the portal ships with … the school has not filed its own'. Only the first is the school's day; a period count nobody chose still prints on a family's schedule.",
      "If that line says the periods come from the portal, press 'Set the school's day'. Tick the weekdays the school actually teaches on, name each entry ('Period 1 (08:00 - 08:45 AM)'), use 'Add period' / 'Add break', and press 'File this day on the school's records'. The panel says which shape it opened with, so a saved six-period day is known to be the office's choice and not the portal's default.",
      "A period cannot be removed while a lesson still sits in it: the school refuses that save and names the lessons that would keep existing with no period to print them in. Move those lessons first, or clear the arm.",
      "Use 'Class Arm Timetable' for one arm ('n filled of m' and 'Assign' in every empty cell), 'Master Institutional Schedule' for every arm at once (each row shows 'n of m' and 'slot(s) empty'), and 'Faculty Workload Matrix' for periods per teacher.",
      "To plan a week instead of typing it cell by cell, press 'Draft the week'. Write what each arm needs — class arm, subject, teacher (or 'Not named yet'), and how many periods — one line at a time with 'Add a line'. Optionally state the most periods one teacher should carry; left blank, the portal sets no limit, because it has no record of what a fair load at this school is and will not invent one.",
      "Press 'Draft the week'. The portal chooses the times: no teacher in two arms at once (the same rule that refuses a hand-filed lesson), lessons spread over the week rather than stacked on Monday, and the periods already on the school's records left exactly where they are. Read all three numbers it answers with — what was placed, which parts of the plan did not fit and why, and how many slots are still empty. Nothing has been saved yet.",
      "Press 'File these n lesson(s)' to put the draft on the timetable, and read the confirm line first: it says how many lessons land and that the ones already filed stay where they are. Filing is judged again by the school's rule, so anything a colleague added since the draft was built is refused and named rather than overwritten.",
      "In the workload tab, a count flagged 'by name, not staff id' means the lesson carries a typed name rather than a staff reference — two spellings of one person read as two people there. 'Awaiting Schedule' is a teacher with no filed lesson, not an idle one.",
      "'Clear Class Schedule' takes every lesson off one arm for the named session and term, after naming how many it is about to remove. There is no undo.",
    ],
    safetyRules: [
      "A slot holding two lessons is stopped by the database, not by this screen's good behaviour: one lesson per class, day and period is a rule in supabase/timetable.sql.",
      "If the panel says 'n teacher(s) are in two classes at the same time on this timetable', fix it before the schedule is printed. Those lessons came in through an older browser copy or a name that does not match the staff file.",
      "Do not file a timetable into a term the school is not in. The term selector and the header are the only date on the grid — a schedule printed under the wrong term is worse than no schedule.",
      "The class arms you group by are read from the school's records, so every machine groups the same way; the teacher names are still this browser's staff list. A lesson filed for an arm nobody has on file stays on the school's records — it simply does not appear under an arm name until that arm is filed.",
      "A draft is not a timetable. Until 'File these n lesson(s)' is pressed nothing is on the school's records, and a draft left open on screen schedules nobody. Switching the session or the term discards it, because what is on screen is then a plan for a different week.",
      "The portal places times only from the plan it was handed. It never chooses a subject for a class or a teacher for a lesson — the school's records do not say who teaches what well enough to stake a printed schedule on it — and an arm the plan does not mention is left untouched.",
      "A draft places lessons, not rooms: every line it files comes in with no room, which the grid prints as the class's own room. Set a room by hand where a lesson genuinely moves out of it.",
    ],
    expectedOutput: "A timetable for one named session and term on the school's records, with no teacher double-booked, every unfilled slot shown as unfilled, and a workload count that matches what the grid prints — or a drafted week that names every part of the plan it could not place, waiting for a person to file it.",
  },

  {
    id: "sop-2-4",
    code: "SOP-EXM-004",
    title: "Daily Duty Roster: Designation, Assignment and the Workspace Panel",
    role: "Super Administrator / Exam Officer (office); every staff member reads their own",
    category: "Exam Officer",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    minRoleTier: "EXAM_OFFICER",
    summary: "Procedure for saying what each member of staff is employed as, and for assigning who is on duty for which part of which day. A duty is a dated record, not a standing arrangement: yesterday's gate duty does not carry into today, and nothing is filed on anybody's behalf by their job title.",
    prerequisites: [
      "supabase/staff_duties.sql run on this project. Until it is, Operations → Duty Roster and the On Duty Today panel both print 'The duty roster could not be read' and name that file, and the roster refuses to show an empty week in its place.",
      "The people you are rostering already on the register at Operations → Staff. A duty cannot be filed against a name the school does not hold; the route answers 404 and nothing is filed.",
      "A login of your own that the portal accepts as Super Administrator or Exam Officer. A teacher or bursar login can read only its own rows and cannot file, replace or remove a duty.",
    ],
    procedureSteps: [
      "At Operations → Staff, open 'Register Staff' and fill 'Designation (job title)' — Bursar, Dean of Studies, Coordinator — and, if you wish, 'Standing duties' as a comma-separated list. The designation is what the school employs the person as; the role in the same form is what the portal lets them do. They are stored apart and neither implies the other.",
      "Leave a designation blank when the school has not stated one. The register, the roster and the workspace all then print 'not stated'. Never let a screen's guess stand in for the school's decision.",
      "Navigate to Operations → Duty Roster (/operations/duties). Check the line 'Today at the school' — it is the server's date in West African time, not this machine's, and the host that runs the portal sits several hours behind Jos.",
      "Move to the week you mean with the arrows, or press 'This week'. To read a Saturday or a Sunday (sports day, inter-house games), use 'One day instead' and pick that date.",
      "Press 'File A Duty', or the 'Duty' button on the day you mean. Pick the date, then the person from the register — the dropdown shows each one's designation, and marks any who are not Active. Suspended members are not offered at all: their login is closed, so a duty filed there would never reach them.",
      "Write the duty. The list offers the school's usual names (and whatever you entered as that person's standing duties), but typing your own is allowed and gets filed in your wording.",
      "Choose which part of the day: Before School, Morning Assembly, Break Time, Lunch Break, After School, All Day. A duty with no time of day is a duty nobody knows when to keep, and the route refuses it.",
      "Read the answer. 'Filed: …' means the row is on the school's records. If the slot already held a duty, the line says which one it replaced — one person holds one duty per part of a day, and that rule lives in the database, not in this screen's good behaviour.",
      "Check the member's own workspace. The On Duty Today panel prints their designation, today's duties and, under each, the login that filed it ('Assigned by …'). A parent login has no panel: a guardian holds no staff record and therefore no duty.",
      "To take a duty off, use the bin icon on that row and read the confirm line first — it names the duty, the person, the date and the part of the day. Removal is by that row's own id, so a half-filled form cannot clear a whole day.",
    ],
    safetyRules: [
      "A day the roster shows empty is a day nobody assigned, not a day that needs no cover. Say so out loud before the gates open; the screen will not quietly fill it for you.",
      "Do not roster around a suspension. If a member is Suspended, reinstate the record in Settings → User Access or assign somebody else — do not create a second spelling of their name to get past the picker.",
      "Never file a duty for a date the school has not decided. The portal refuses a date it cannot read (YYYY-MM-DD, and between 2020 and 2100), because a duty filed for 2126 is a typo that would sit unread on the register for a century.",
      "Do not correct a duty by filing a second one into the same slot and hoping the first drops off harmlessly. Read the 'It replaces …' line, and if it names a duty you did not mean to move, refresh the week and put it back.",
      "The 'Assigned by' name is the login that filed the row, taken from the signed session. It cannot be typed, so it is the record the office is held to — which is why a duty is never filed from a shared login.",
      "If the roster could not be read, no day is listed. Filing blind from another screen would produce a week that looks covered and is not.",
    ],
    expectedOutput: "A dated roster the school can print — each duty naming its person, its designation as the register held it at the moment of filing, its part of the day, and the login that assigned it — and a workspace panel on every staff login showing today's duties with the same names on them.",
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
    summary: "The routine for capturing the five assessment columns and the terminal examination for one class and subject, on the screen that files to the school's records.",
    prerequisites: [
      "A TEACHER (or EXAM_OFFICER / SUPER_ADMIN) sign-in — the server checks the mark against the session cookie, not against anything the browser claims",
      "The pupil on the register first: marks are filed against an admission number, so an unenrolled child has nowhere to be filed",
    ],
    procedureSteps: [
      "Navigate to Operations → Update CA (/operations/update-ca).",
      "The workspace starts on your assigned class and subject. Confirm the session and term named at the top before typing a number.",
      "For individual entry: type into the grid. The tier limits clamp what a cell accepts, and the grade and remark for each pupil are computed as you go.",
      "For batch entry: 'CSV Template' to get the column order, fill the sheet, then 'Upload Scores CSV' → check the preview → 'Import Score Records Now'. Rows the portal cannot place (no admission number, no recognisable pupil) are listed and skipped, not invented.",
      "Click 'Save & Sync Scores'. The button changes to 'Sent to the school records' when the server has taken the marks. If it did not, the screen says so — the marks stayed on this browser.",
      "Re-read the class in a fresh tab, or ask a colleague on another machine to open the same arm, when you need proof the marks are on the school's records.",
    ],
    safetyRules: [
      "Do not enter an examination score before the CBT and theory marks have been moderated.",
      "A pupil may have marks from an earlier session. The screen shows the column for the session and term you named; never read an old column as this term's work.",
    ],
    expectedOutput: "Marks held on the school's records for the named session, term, class and subject — the same on every machine that reads that arm.",
  },
  {
    id: "sop-3-2",
    code: "SOP-TCH-002",
    title: "Psychomotor & Affective Behavioral Domain Assessment (1-5 Scale)",
    role: "Form Master / Class Teacher",
    category: "Faculty / Teacher",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    minRoleTier: "TEACHER",
    summary: "How the Psychomotor Engine collects 1-5 trait ratings and remarks, and the one step that turns them from this machine's working form into the school's record.",
    prerequisites: [
      "The pupils are on the school's register (Operations → Students). A rating is filed against an admission number the school holds; a pupil it does not know is skipped and said so.",
      "The traits to rate come from Setup → Traits (/setup/traits) — the school's one rubric, read from its records; the built-in list starts with 'Punctuality & Regularity'",
      "supabase/traits_assessments.sql run on the project. Until then this screen cannot read or file an assessment and says so.",
    ],
    procedureSteps: [
      "Navigate to Operations → Traits Assessments (/operations/traits-assessments). The chip under the heading tells you which list you are looking at: 'Ratings read from the school's records' or 'This device's copy of the ratings'.",
      "The session and term filters open on the values the school's own Settings record names. Change them only to revisit a past term. The grid then loads only that class, term and session.",
      "There is no save button per row. Clicking a rating files it on this browser immediately and the notice reads 'Rating recorded on this browser' with the line 'Not yet in the school's records'. Attendance and the form teacher's remark behave the same way.",
      "When the class is rated, press the green 'File this class into the school's records'. It sends one record per pupil that has anything on it — a rating above zero, an attendance figure, or a word of remark — and answers with the count. 'Nothing was filed for … no pupil on this screen has a rating, an attendance figure or a remark yet.' is a real answer, not a failure.",
      "When the school takes all of them the banner reads '… are filed in the school's records. Every score card, every machine and the child's own family now read the same ratings.' If some are refused it names how many got through and why, instead of pretending the class is filed.",
      "The 'Principal / Head of School Endorsement' box is closed unless you are signed in as the super admin: the preset selector is disabled and the textarea is read-only, with the note 'This line is signed by the Head of School.' A card whose endorsement was never written prints 'Endorsement withheld — the Head of School has not written one for this term.' instead of a pair of empty quotes.",
      "Read the scale off the toolbar, which prints it exactly: 5 = Excellent / Exemplary, 4 = Very Good / Proficient, 3 = Good / Satisfactory, 2 = Fair / Developing, 1 = Poor / Needs Support.",
      "'Quick Batch:' offers 'All 5 (Excellent)' and 'All 4 (Very Good)'. Each asks first, then sets that rating for every pupil in the selected class — on this browser, until you file the class.",
      "'Configure Traits' opens /setup/traits to change which traits are rated; only the Head of School or the Exam Office may alter that list. 'Preview Terminal Score Cards →' opens the card that reads the ratings back.",
    ],
    safetyRules: [
      "Assessments must be objective and reflect constructive behavioral feedback.",
      "An unfiled rating exists only on the machine it was typed on. A card printed on another laptop reads 'No character assessment on file for this pupil' — file the class before the cards are expected to carry it.",
      "Filing rewrites that pupil's row for the named session and term; it does not append. Re-file after a correction and the card follows the newest one.",
      "An unassessed pupil shows no average. The engine refuses to count unset zeros as marks, so a blank row is not a low score, and a trait left unrated prints 'not rated' rather than 0 / 5.",
    ],
    expectedOutput: "Trait ratings, attendance and teacher remarks held on the school's records for that pupil, session and term — the same on the score card, on every other machine, and on the family's own view.",
  },
  {
    id: "sop-3-3",
    code: "SOP-TCH-003",
    title: "Class Score Card Inspection & Dossier Compilation",
    role: "Form Master / Teacher",
    category: "Faculty / Teacher",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    minRoleTier: "TEACHER",
    summary: "Procedure for inspecting an assigned class scorecard — single term or 3-term cumulative — and printing dossiers exactly as the screen holds them, with no invented marks.",
    prerequisites: [
      "Marks entered in Operations → Update CA Scores (/operations/update-ca) for the session and term shown in the filters",
      "The class's trait ratings filed into the school's records (SOP-TCH-002) if the card is expected to carry a character assessment",
    ],
    procedureSteps: [
      "Navigate to Operations → Score Card (/operations/score-card) — the sidebar entry is 'Score Card'.",
      "Your assigned class is pre-selected and a teacher sees only their own class arms; nobody can scroll into another form master's register.",
      "Under 'Scope:' choose between the two buttons as they are actually labelled: 'Single Term (CA + Exam)' and '3-Term Cumulative Annual'.",
      "Read the subject table, 'Terminal Average', 'Class Position' and the remarks. An average is 'Incomplete' rather than a fabricated percentage when the marks are missing.",
      "Where marks are absent the card says so: 'n of m subjects have no mark filed for {term}, {session}' and a dash in the cell. Nothing is estimated, because the printed card goes home with the family.",
      "'Promotional Standing' reads 'Not decided' until the school records the promotion at end of term. Do not read it as a failing pupil.",
      "Tick 'Print Newsletter' to attach the circular, or 'Batch Print All' for the whole class — the button then reads 'Print All (n) Dossiers' or, inside the batch banner, 'Trigger Print (n)'. One pupil at a time reads 'Print Official Report Card'.",
    ],
    safetyRules: [
      "Teachers cannot modify published results once the Exam Officer locks the gradebook (SOP-EXM-002).",
      "Batch Printing is hidden from parent and student logins; a parent prints only their own ward.",
      "If a card on this machine differs from one printed elsewhere, the marks did not both reach the school's records — check the gradebook save notice before releasing.",
    ],
    expectedOutput: "A printed A4 dossier per pupil exactly as this screen holds it, single-term or cumulative, with the newsletter attached when ticked and a visible warning for every subject with no mark filed.",
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
    summary: "Standard procedure for establishing termly fee components (Tuition, Levies, Laboratory, Examination) on the school's records and turning them into invoices.",
    prerequisites: [
      "A SUPER_ADMIN or ACCOUNTANT login — a parent or QA login is refused at the server and the billing buttons are not shown at all",
      "Active student register for the session and term set in Settings",
    ],
    procedureSteps: [
      "Navigate to Setup → Fees (/setup/fees). The chip reads 'On the school's records' when the schedule came from the school's fee_components table, and 'This device's copy only' when it could not be read — bill only from the first.",
      "Click 'Add Fee Component' → 'Fee Item Name' (e.g. Tuition Fee, ICT Lab Levy), 'Category' (Tuition, Levy, Examination, Laboratory, Extracurricular), 'Target Level / Class', 'Amount (₦ NGN)' and the 'Compulsory / Mandatory for all enrolled students' box.",
      "Click 'Save Fee Item'. The button reads 'Filing…' while it works and the item is saved onto the school's schedule under the session and term set in Settings. An item with the same name and target level already filed for that term has its amount replaced rather than doubled.",
      "On an empty schedule, 'Populate Standard Fee Schedule' lays in the usual items; 'Refresh' re-reads the list in case another machine changed it.",
      "Click 'Generate Invoices' to move to Accounts → Invoicing (/accounts/invoicing), then press 'Bill {n} Enrolled Pupils ({term})' — the button names how many pupils and which term it is about to bill.",
    ],
    safetyRules: [
      "Fee component edits must not be applied without prior formal circular dispatched to parents.",
      "Per-level items are priced by target level: an ICT levy for all classes and a science practical fee for SS only. Check the 'Target Level' before filing, because the bill is built from it.",
      "If the chip says 'This device's copy only', the schedule was not read and the totals on screen are this machine's old numbers, not the school's.",
    ],
    expectedOutput: "A fee schedule held on the school's records for the current session and term, and invoices priced from it for every enrolled pupil on the register.",
  },
  {
    id: "sop-4-2",
    code: "SOP-ACC-002",
    title: "Payment Reconciliation, Partial Billing & Instant Computerized Receipts",
    role: "Bursar / Accounts Officer",
    category: "Accounts / Bursary",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    minRoleTier: "ACCOUNTANT",
    summary: "Protocol for recording tellers, transfers, POS and cash against a pupil's invoice, and for printing only a receipt the school actually issued.",
    prerequisites: [
      "A SUPER_ADMIN or ACCOUNTANT login — on any other login the billing and payment controls are not shown, because /api/payments refuses them",
      "Valid bank payment teller, transfer receipt, or POS transaction slip",
      "Student Admission Number or Full Legal Name",
    ],
    procedureSteps: [
      "Navigate to Accounts → Invoicing (/accounts/invoicing). The chip must read 'Filed Ledger'; 'Schedule unread' means the price on screen is not confirmed against the school's schedule.",
      "Search by Name or Admission Number. Status is one of three labels only: 'Paid', 'Partial', 'Unpaid'.",
      "On an unpaid or part-paid row click 'Record Payment' → the 'Record School Fee Payment' overlay shows the pupil, the 'Invoice' number and 'Outstanding Due'.",
      "Enter 'Amount Received (₦)' — the server checks it against the balance it holds and refuses more than is owed. Choose the 'Payment Method' from the four channels the school recognises: 'Bank Direct Deposit / Teller', 'Electronic Bank Transfer', 'School Bursary POS', 'Cash Receipt'. Fill 'Bank Reference / Teller No' so the money can be matched to a slip later; leave it empty for cash and the printed slip reads 'Not noted'.",
      "Click 'Confirm & File Payment' (it reads 'Filing…' while it works). A success notice names the invoice, the receipt number issued and the new balance on the school's records. A refusal says the money was NOT filed and why — nothing has changed.",
      "Print from the 'Receipt to give the family' overlay with 'Print This Receipt'. If the server returns no receipt number, the notice tells you to give the family no slip until it is checked — do not write one by hand.",
      "To reprint an old payment use the row's 'Receipts' button, which lists what the school filed for that pupil, newest first.",
    ],
    safetyRules: [
      "Never issue a manual receipt without logging the electronic transaction in the portal.",
      "A payment is only real once the notice names a receipt number from the school's records. Clearing a child's fee status by hand is not reconciliation.",
      "If the family's copy and the portal disagree, the receipt number on the school's records wins — re-read with 'Receipts' before arguing from memory.",
    ],
    expectedOutput: "A receipt number from the school's records for every payment taken, an updated 'Paid'/'Partial' status and a printable slip — or a plain refusal notice and no slip at all.",
  },
  {
    id: "sop-4-3",
    code: "SOP-ACC-003",
    title: "Stores Register, Asset Ledger and Stock Movement Log",
    role: "Bursar / Accounts Officer",
    category: "Accounts / Bursary",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    minRoleTier: "ACCOUNTANT",
    summary: "Procedure for filing what the school owns and for changing the quantity on the shelf only through a recorded receipt or issue, so the register can be stood up beside a clipboard.",
    prerequisites: [
      "A SUPER_ADMIN or ACCOUNTANT login — a teacher, parent or QA login is refused at /api/inventory, and a QA login can read the register but not change it",
      "supabase/inventory.sql run on this project. Until it is, the screen says 'The stores register could not be read' and names that file; nothing on it is the school's stock",
    ],
    procedureSteps: [
      "Navigate to Accounts → Inventory (/accounts/inventory). The header names the school from its own Settings record, not from this browser.",
      "Click 'Add To The Register' and fill 'Item', the 'Label or asset number' (leave it blank if the school never painted one on it — two blank labels do not collide), 'Category', 'Unit', 'Opening quantity', 'Kept where', 'Custodian', 'Condition', 'Acquired on', 'Value paid' and 'Reorder level'.",
      "Only the 'Opening quantity' is a quantity. It is what the store held when the school began counting. Nothing on the screen accepts a current stock figure, so a line cannot be retyped to match a shelf.",
      "Click 'File on the school's register' (it reads 'Filing…'). The notice names the item and says it is on the register. A label the register already holds is refused with that label in the sentence, so two people counting the same generator cannot file it twice.",
      "On any row, click the movement button to 'Move {item}'. The form prints what is on the shelf first. Choose 'Issue out of stores' or 'Receive into stores', give the 'Quantity', the 'Issued to' / 'Received from' party, the 'Purpose' and, if it is not today, the 'Date moved' (a future date is refused). Then press 'File this movement' (it reads 'Filing…'). The notice ends with the quantity the school's own records now hold — the browser never works that sum out itself.",
      "An issue larger than the shelf is refused with the real figure: '{item} has {n} on the shelf. It cannot issue {m}. Correct the opening figure or receive more stock first.' Correct the opening figure only if the school genuinely mis-counted at the start; otherwise the refusal is the finding.",
      "The register lists 'On hand' with '+in / −out' beside it, flags items at or below their reorder level, and counts separately the items for which the school set no reorder level and the lines with no recorded value — a missing figure is not added in as zero.",
      "A row with any movement against it cannot be deleted: the server refuses, because removing the line would erase the log that proves where the stock went. Mark it 'Disposed', 'Lost' or 'Unusable' instead and the history stays readable.",
      "'Refresh' (it reads 'Reading…' while it works) re-reads the register and the log in case another machine filed something. 'Export This Register (CSV)' hands over exactly the rows the current search shows, and 'Only items to reorder' narrows the list to what the store needs ordered.",
    ],
    safetyRules: [
      "The quantity on this screen is derived, never declared. If it disagrees with the shelf, the difference is a movement that was not filed — file it, do not edit the figure.",
      "If the register could not be read, the screen lists nothing rather than this browser's last guess. An audit screen that filled in from memory would be reporting property nobody counted.",
      "Every movement carries the login that filed it, taken from the session and not from the form, so a colleague's name cannot be attached to a person's issue.",
    ],
    expectedOutput: "A register of what the school owns with the stock figure added up from its own movement log, and a log naming who moved what, when, and for what — the same on every machine that opens the screen.",
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
    summary: "Procedure for registering new intakes one at a time or from a CSV, and for telling apart a pupil the school accepted from one that only this browser remembers.",
    prerequisites: [
      "Completed Student Bio-data form, medical report, and parent/guardian contact details",
      "The class arm exists in Setup → Classes (/setup/classes) — the form will not pick a class the school has not listed",
      "A stated sports house (Sapphire, Ruby, Emerald, Topaz) and the pupil's gender; the portal no longer decides either of them for a child",
    ],
    procedureSteps: [
      "Navigate to Operations → Students (/operations/students).",
      "For one pupil: click 'Admit Student' → type the name, choose the class, 'Say whether the pupil is a boy or a girl', pick the sports house, add guardian name and phone → click 'Enroll Student' (it reads 'Enrolling…' while it works).",
      "The form refuses, before anything is filed, a missing name, an unstated gender, an unstated house or an unstated class — each with its own sentence. It stays open when the school's records reject the pupil, saying \"{name} is on this browser's list, but {reason}\" so the clerk fixes the cause and enrols again instead of moving on.",
      "For a batch: click 'CSV Template' to download the columns the portal reads (Full Name, Class, Gender, Guardian Name, Guardian Phone, Sports House, Fee Status) → fill offline → 'Bulk Upload CSV' → select the file.",
      "The preview names every row it will not take: a row with no name, a row with no class, a gender that is not Male or Female, a house outside the four. Read the skipped list before importing — a skipped row is not enrolled, silently, anywhere.",
      "Click 'Import {n} Students Now' (it reads 'Enrolling…'). The banner after it either says \"{n} pupils enrolled and filed on the school's records\" or, when the school refused, how many reached this browser's list and why — that warning stays on screen after the modal closes.",
      "Admission numbers are issued by the portal as RCA/STD/{session year}/{sequence}, skipping any number a pupil on the roll already holds. Never hand-write one: /api/students keys records on the admission number, so a duplicate takes over another child's marks and invoices.",
    ],
    safetyRules: [
      "Validate parent phone numbers to ensure emergency SMS broadcasts reach active guardians.",
      "Secondary classes strictly use unified single streams: JSS 1, JSS 2, JSS 3, SS 1, SS 2, SS 3. There are no 'A'/'B' arms in the portal.",
      "A pupil shown in the register but refused by the school's records must not be printed on a card, billed, or marked — the list on this browser is not the school's roll.",
    ],
    expectedOutput: "Bio-data on the school's records with a non-colliding admission number, feeding the class register, attendance and bursary billing list — with refusals and skipped rows stated out loud instead of quietly dropped.",
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
    summary: "How a guardian or pupil reaches a released terminal scorecard, what the card can honestly show before the exam office releases it, and why another family's child never appears.",
    prerequisites: [
      "The guardian login issued by the school — the password is shown once when it is made and is never printed again on any screen, slip or manual",
      "Your child linked to that login on the school's guardian-to-pupil table; a login with no link shows no card at all",
    ],
    procedureSteps: [
      "Sign in at /login with the guardian username or the ward's admission number.",
      "From the dashboard click 'View Terminal Score Card' ('Access official report card, grades, and teacher remarks'), or open Operations → Score Card (/operations/score-card).",
      "Only the children linked to your login are listed. The portal does not guess a ward from a surname and it will not show another family's pupil.",
      "Until the exam office releases the class, the screen reads 'This report card has not been released yet' and explains that the marks are already on the school's records; if the check itself fails it says the release could not be confirmed and shows nothing rather than a card that may still be under approval.",
      "Once released, the card shows the pupil's bio-data, each subject's CA breakdown and exam mark, totals out of 100, the grade, 'Terminal Average' and 'Class Position'. Below the marks it carries the character panel: each trait the school rates, the 1-5 score or 'not rated', the days present out of the days opened, and the form teacher's and Head of School's remarks. Where nobody entered a mark the cell is a dash with a line saying how many subjects have nothing filed — not a zero.",
      "'Promotional Standing' reads 'Not decided' until the school records the promotion at end of term.",
      "Switch 'Scope:' to '3-Term Cumulative Annual' for the whole-year view, then 'Print Official Report Card' for the A4 dossier.",
    ],
    safetyRules: [
      "Do not share your parent access passcode with unauthorized third parties.",
      "A printed card carries whatever the screen held. If a mark looks wrong, the class has been released on it — ask the Form Master or Exam Officer to correct the record and re-release.",
      "Character ratings, attendance and remarks reach the school's records only once the class teacher files that class. A panel reading 'No character assessment on file for this pupil' means none was filed for that term when you looked — it is not proof the teacher never rated the child, so ask the Form Master rather than assuming.",
    ],
    expectedOutput: "Your own children's released terminal report cards, single-term or cumulative, printable as an A4 dossier — with an explicit 'not released yet' or 'could not be confirmed' screen instead of a borrowed or invented result.",
  },
  {
    id: "sop-6-2",
    code: "SOP-PAR-002",
    title: "Taking Online Computer-Based Tests (CBT), Timed Assessments & Answer Submission",
    role: "Student / Candidate",
    category: "Parent / Student",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    minRoleTier: "STUDENT_PARENT",
    summary: "Instructions for sitting a computer-based test on this portal — what the engine really is, what the score means, and where it does and does not go.",
    prerequisites: [
      "A paper filed on the school's exam bank (Setup is not where it lives — the exam office sets questions on the CBT screen itself, under 'Set a paper'). The bank card above the launch button shows how many questions, marks and subjects the school actually holds.",
      "The pupil enrolled on the school's register (Operations → Students) — with no candidate the launch button reads 'Enroll a pupil before launching' and stays disabled",
      "The school's CBT switch open, or an office login that may preview while it is shut",
    ],
    procedureSteps: [
      "Navigate to the CBT Portal (/cbt). The chip beside the heading reads 'The paper comes from the school's records' when the bank was read from the database; if it reads 'Showing this browser's copy of the bank' the school's bank could not be reached and what is on screen is only this machine's leftover.",
      "Choose the candidate under 'Candidate Assigned for Assessment Session'. If the list is empty the portal says 'No pupil on the register' and tells you to enroll first — it will not invent a candidate to examine.",
      "'Exams & Question Bank' shows the filed paper and, for the Exam Officer or Super Admin, the 'Set a paper' desk to type questions or load a CSV. A candidate sees the count of questions but not the bank itself: the list marks which option each question counts, so a paper you could read is a paper already answered.",
      "'Launch Proctored Exam' (or 'Launch Proctored Session' on the bank card) opens the paper and asks for full screen. With an empty bank it refuses and says there is nothing to sit, rather than serving a paper out of its own source.",
      "Answer each objective question by selecting A, B, C or D. The 'Question Navigator' grid at the foot jumps between answered and unanswered items; the clock at the top counts down from the set duration.",
      "Press 'Submit and Show the Score'. The score and the figure scaled to 60 appear under 'This sitting is over', with a line that reads either 'Attempt filed on the school's records • not yet a mark' or 'Attempt NOT filed • this screen only', and the school's own sentence underneath.",
      "No letter grade, 'PASSED' or 'FAILED' is printed for a CBT attempt. The screen says so: 'No grade is given here. The letter and remark come from this class's grading scale when a teacher files the mark in CA Entry.'",
      "'Retake Exam' starts another sitting on this machine. Each sitting that ends files its own attempt — a retake does not delete the first one.",
      "Leaving full screen, switching tabs, losing window focus, or pressing a blocked shortcut (copy, paste, print-screen, right-click, F12) logs a strike; the panel says 'Max 2 Strikes' and a third ends the sitting and scores it 0.",
      "No camera, microphone, face or gaze check runs during a sitting — the portal never asks for that access. The strike list is what a browser detected, filed beside the attempt; it is not what an invigilator saw.",
    ],
    safetyRules: [
      "Do not refresh the browser or open external tabs during an active session; leaving full screen counts as a strike.",
      "An attempt is a record, not a mark. The exam column on the child's card stays as it was until a teacher or the Exam Officer enters it in Operations → Update CA Scores.",
      "The engine serves every question on the school's bank in one mixed paper — there is no per-subject or per-class selection. File one arm's paper at a time, and keep the bank to the paper you mean to set.",
      "The answers travel with the questions: marking happens in the browser, so the school's bank holds the correct option for every question. Only the roles that may read the bank are given the marked list, and the bank itself is writable by the Exam Officer and Super Admin alone.",
    ],
    expectedOutput: "An instantly graded paper whose attempt, question count, strikes and infractions are filed on the pupil's record for the session and term named on the screen — still not a CA mark, and never a grade until a person enters one.",
  },
  {
    id: "sop-6-3",
    code: "SOP-PAR-003",
    title: "Checking Termly Fee Invoices, Bank Payment Details & Inmail Desks",
    role: "Parent / Guardian",
    category: "Parent / Student",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    minRoleTier: "STUDENT_PARENT",
    summary: "How a guardian reads their own child's fees and receipts, and what Inmail is really worth as a channel of communication.",
    prerequisites: [
      "Authorized Parent Portal account linked to your ward on the school's guardian-to-pupil table",
    ],
    procedureSteps: [
      "Navigate to Accounts → Invoicing (/accounts/invoicing). You see only the invoices for children linked to your login — the server filters them, the page does not decide.",
      "Read 'Amount Billed', 'Amount Paid' and 'Outstanding' per invoice, and the status label 'Paid', 'Partial' or 'Unpaid'. Bills are priced from the fee schedule on the school's records for the session and term named at the top of the screen.",
      "There are no payment buttons on your copy of this screen. It says 'Reading only. Take your payment evidence to the Bursary' — recording a payment is the bursary's job because only their login is allowed to file one.",
      "Press a row's 'Receipts' to reprint what the school actually issued for that child, newest first. A receipt that is not in that list was never filed.",
      "Payment channels named on a receipt are one of: 'Bank Direct Deposit / Teller', 'Electronic Bank Transfer', 'School Bursary POS', 'Cash Receipt'. Where the teller number was left out the slip reads 'Not noted'.",
      "To write to the school, open Inmail Desk (/inmail) → 'Compose Inmail' → pick the recipient, add subject and body → 'Send Inmail'.",
      "Inmail is not email: the toast after sending reads 'Message saved on this browser only — no one else has received it, and other machines will not see it.' Use it to draft; send the school a real message by phone or letter.",
    ],
    safetyRules: [
      "Always verify school bank details against the official circular before executing wire transfers. The portal never displays account numbers it has not been given.",
      "Do not treat a browser-held Inmail as delivered evidence of an enquiry, and do not treat a CBT screen you cannot open as proof nothing was recorded.",
      "If your invoice and the bursary's copy disagree, ask for the receipt number and have it looked up on the school's records rather than argued from a screenshot.",
    ],
    expectedOutput: "Your own children's invoices, balances and filed receipts read straight from the school's records — plus the plain knowledge that Inmail has not left your machine.",
  },
];

// Role-to-permitted-categories mapping
const ROLE_ALLOWED_SOP_CATEGORIES: Record<string, string[]> = {
  SUPER_ADMIN: ["all", "Super Admin", "Exam Officer", "Faculty / Teacher", "Accounts / Bursary", "Administrative", "Parent / Student"],
  EXAM_OFFICER: ["all", "Exam Officer", "Faculty / Teacher", "Administrative", "Parent / Student"],
  TEACHER: ["all", "Faculty / Teacher", "Exam Officer", "Parent / Student"],
  ACCOUNTANT: ["all", "Accounts / Bursary", "Administrative", "Parent / Student"],
  STUDENT_PARENT: ["all", "Parent / Student"],
  // A QA login walks every workflow to prove the portal, so it reads every
  // procedure — including the head office's, which it cannot act on.
  TESTERS: ["all", "Super Admin", "Exam Officer", "Faculty / Teacher", "Accounts / Bursary", "Administrative", "Parent / Student"],
};

/**
 * A role this file has not been told about reads the family's procedures only.
 * It used to read the head office's whole manual, because an unmapped role fell
 * through to `SUPER_ADMIN` — the one branch that grants the most.
 */
const RESTRICTED_SOP_CATEGORIES = ["all", "Parent / Student"];

export default function SOPManualPage() {
  const { currentUser } = useRealtimeAuth();
  const currentRole = currentUser?.role ?? null;

  const allowedCategories = useMemo(() => {
    return currentRole ? ROLE_ALLOWED_SOP_CATEGORIES[currentRole] ?? RESTRICTED_SOP_CATEGORIES : [];
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

  // The labels used to read "Tier 1: Master Executive … Clearance" down to
  // "Tier 5", a clearance ladder this portal does not run. What a login may read
  // here is the category list above, so the badge names the role and nothing else.
  const getRoleBadge = (role: UserRole | null) => {
    switch (role) {
      case "SUPER_ADMIN":
        return { label: "Head office", color: "bg-purple-100 text-purple-800 border-purple-300" };
      case "EXAM_OFFICER":
        return { label: "Exam office", color: "bg-blue-100 text-blue-800 border-blue-300" };
      case "TEACHER":
        return { label: "Teaching staff", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
      case "ACCOUNTANT":
        return { label: "Bursary", color: "bg-amber-100 text-amber-800 border-amber-300" };
      case "STUDENT_PARENT":
        return { label: "Parent / Student desk", color: "bg-sky-100 text-sky-800 border-sky-200" };
      case "TESTERS":
        return { label: "QA test login", color: "bg-slate-100 text-slate-800 border-slate-300" };
      default:
        return { label: "No login read on this browser", color: "bg-slate-100 text-slate-800 border-slate-300" };
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
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
        <div className="bg-gradient-to-r from-blue-50/80 via-cyan-50/40 to-slate-50 border border-blue-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0000FF] text-white flex items-center justify-center font-bold shadow-sm">
              <UserCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Active Role Workspace: <strong className="text-[#0000FF]">{currentUser?.fullName || "No name on this login"}</strong> ({currentRole ?? "no role read on this browser"})
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
