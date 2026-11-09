"use client";

import { TriangleAlert } from "lucide-react";

/**
 * Said out loud on every screen whose Save button only reaches this browser.
 *
 * What is left in localStorage is the memo draft pad at /inmail (a writing pad,
 * not a mailbox), the marking of a CBT sitting
 * before it is filed as an attempt, and the copies a screen falls back to when
 * the school's records cannot be read. Each of those is described here as what it
 * is: a second machine never sees it, and clearing the browser's data loses it.
 * Rather than leave each screen inventing its own reassuring sentence, they
 * point at the same fact.
 *
 * What the school's records DO hold: pupils, staff and their logins, the class
 * arms, the subject list and the subject packages, the fee schedule, filed CA
 * marks, what each tier's assessment is made of, invoices and the receipts filed
 * against them, the grading scales, the current session and term, which classes
 * have had results released, which terms are signed off, the trait rubric, the
 * colour scheme the cards are printed in, the circular filed for each session and
 * term, what the school owns and every unit of stock issued or received, the
 * timetable for the session and term it is labelled with, what each member of
 * staff is designated as and who is on duty on a given day, the CBT question
 * bank, the sittings filed as attempts and the switch that opens or shuts the
 * module, the term calendar with its milestones and the activity blueprints the
 * office schedules from, the identity card filed for a pupil or a member of
 * staff with the photograph the office chose for it, and — once the form teacher
 * files them from Operations → Traits & Psychomotor — the character, psychomotor
 * and attendance ratings that fill the other half of a child's card.
 */
export function DeviceOnlyNotice({ what, className = "" }: { what: string; className?: string }) {
  return (
    <div
      className={`bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] leading-snug text-amber-950 flex items-start gap-2 print:hidden ${className}`}
    >
      <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
      <p>
        <strong>{what} is kept on this browser only.</strong> Another machine will not see it, and clearing this
        browser&apos;s data loses it. What the school&apos;s own records hold: pupils, staff and their logins, the class
        arms, the subject list and the subject packages, the fee schedule, filed CA marks, what each tier&apos;s
        assessment is made of, invoices and the receipts filed against them, the grading scales, the current session and
        term, released results, closed terms, the trait rubric, the colour scheme the cards are printed in, the circular
        filed for each session and term, the stores register with its stock movements, the timetable once it is filed,
        who is on duty on a given day, the CBT questions, the sittings and the open/close switch, the term&apos;s
        milestones and the activity blueprints once they are filed, the identity cards with their photographs once they
        are filed, and the character assessments once they are filed.
      </p>
    </div>
  );
}
