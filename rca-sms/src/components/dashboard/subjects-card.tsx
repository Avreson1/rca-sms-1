import React from "react";
import Link from "next/link";
import { BookOpen, ArrowRight, Users, Sparkles } from "lucide-react";

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
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Subjects Taught</h3>
            <p className="text-[11px] text-slate-500">Currently assigned teaching workloads</p>
          </div>
        </div>
        <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full border border-blue-100">
          {subjects.length} Assigned
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {subjects.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl hover:border-blue-300 hover:bg-blue-50/20 transition-all"
          >
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {item.className}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  {item.studentsCount} Students Enrolled
                </span>
                <span>•</span>
                <span className={item.caSubmitted ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                  {item.caSubmitted ? "CA Scores Submitted" : "CA Entry Pending"}
                </span>
              </div>
            </div>

            <Link
              href="/operations/update-ca"
              className="inline-flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-xs self-start sm:self-center"
            >
              Enter CA Scores
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
