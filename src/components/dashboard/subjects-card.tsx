import React from "react";
import Link from "next/link";
import { BookOpen, ArrowRight, Users } from "lucide-react";

interface SubjectItem {
  id: string;
  name: string;
  className: string;
  studentsCount: number;
  caSubmitted: boolean;
}

interface SubjectsCardProps {
  subjects: SubjectItem[];
}

export function SubjectsCard({ subjects }: SubjectsCardProps) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-2xs">
      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[13px] font-bold tracking-tight text-ink">Subjects Taught</h3>
            <p className="text-[11px] leading-relaxed text-muted">Currently assigned teaching workloads</p>
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-brand-700">
          {subjects.length} Assigned
        </span>
      </div>

      {subjects.length === 0 ? (
        <p className="mt-4 rounded-xl border border-hairline bg-canvas p-4 text-[12px] leading-relaxed text-muted">
          No subject is assigned to this login. The office records teaching workloads in Operations → Staff Register;
          once one is filed against your name, it appears here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {subjects.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-hairline bg-canvas p-4 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/50 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display text-[13px] font-bold tracking-tight text-ink">{item.name}</h4>
                  <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {item.className}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <Users className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                    {item.studentsCount} Students Enrolled
                  </span>
                  <span aria-hidden="true" className="text-slate-300">•</span>
                  <span className={item.caSubmitted ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                    {item.caSubmitted ? "CA Scores Submitted" : "CA Entry Pending"}
                  </span>
                </div>
              </div>

              <Link
                href="/operations/update-ca"
                className="inline-flex min-h-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition-colors duration-150 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 self-start sm:self-center"
              >
                Enter CA Scores
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}