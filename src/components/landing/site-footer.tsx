import { Mail, Phone, MapPin } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-blue-950/80 bg-[#060b19] px-5 py-10 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-white">
            {SCHOOL_INFO.shortName} <span className="text-cyan-400">Portal</span>
          </p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-400">
            {SCHOOL_INFO.name} — {SCHOOL_INFO.motto}. A single portal for admissions, academics,
            continuous assessment, CBT examinations and bursary services.
          </p>
        </div>
        <div className="space-y-2.5 text-xs">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reach the school</p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
            {SCHOOL_INFO.address}, Nigeria
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            {SCHOOL_INFO.phone}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            {SCHOOL_INFO.email}
          </p>
        </div>
        <div className="space-y-2.5 text-xs">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Portal</p>
          <p className="text-slate-400">
            Access is by invitation only. Staff, student and parent credentials are issued by the
            school office — there is no public registration.
          </p>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-blue-950/60 pt-5 text-center text-[11px] text-slate-500">
        © {new Date().getFullYear()} {SCHOOL_INFO.name}. All Academic & Administrative Rights Reserved.
      </p>
    </footer>
  );
}
