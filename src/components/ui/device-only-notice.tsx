"use client";

import { TriangleAlert } from "lucide-react";

/**
 * Said out loud on every screen whose Save button only reaches this browser.
 *
 * Much of the portal's configuration — the subject list, the class arms, the
 * calendar, the timetable, the CBT questions and the terminal newsletter — is
 * written to localStorage and was described on screen as saved, synchronised or
 * broadcast to the school. It is none of those: a second machine never sees it,
 * and clearing the browser's data loses it. Rather than leave ten screens each
 * inventing their own reassuring sentence, they point at the same fact.
 *
 * What the school's records DO hold: pupils, staff and their logins, the fee
 * schedule, filed CA marks, invoices and the receipts filed against them, the
 * grading scales, the session and term, which classes have had results released,
 * which terms are signed off, the trait rubric, and — once the form teacher files
 * them from Operations → Traits & Psychomotor — the character, psychomotor and
 * attendance ratings that fill the other half of a child's card.
 */
export function DeviceOnlyNotice({ what, className = "" }: { what: string; className?: string }) {
  return (
    <div
      className={`bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] leading-snug text-amber-950 flex items-start gap-2 print:hidden ${className}`}
    >
      <TriangleAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
      <p>
        <strong>{what} is kept on this browser only.</strong> Another machine will not see it, and clearing this
        browser&apos;s data loses it. What the school&apos;s own records hold: pupils, staff and their logins, the fee
        schedule, filed CA marks, invoices and the receipts filed against them, the grading scales, the current session
        and term, released results, closed terms, the trait rubric and the character assessments once they are filed.
      </p>
    </div>
  );
}
