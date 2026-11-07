import { Mail, Phone, MapPin } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer id="contact" className="relative border-t border-white/10 bg-night-900 px-5 py-12 text-white/72">
      <div aria-hidden="true" className="texture-grid-light pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        <div>
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.14em] text-white">
            {SCHOOL_INFO.shortName} <span className="text-accent-400">Portal</span>
          </p>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/62">
            {SCHOOL_INFO.name} — {SCHOOL_INFO.motto}. A single portal for admissions, academics,
            continuous assessment, CBT examinations and bursary services.
          </p>
        </div>
        <div className="space-y-3 text-[13px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Reach the school</p>
          <p className="flex items-start gap-2.5 leading-relaxed">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-300" strokeWidth={1.75} />
            {SCHOOL_INFO.address}, Nigeria
          </p>
          <p className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 flex-shrink-0 text-brand-300" strokeWidth={1.75} />
            <a href={`tel:${SCHOOL_INFO.phone.replace(/\s/g, "")}`} className="inline-flex min-h-11 items-center font-mono tabular-nums transition-colors duration-150 hover:text-white">
              {SCHOOL_INFO.phone}
            </a>
          </p>
          <p className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 flex-shrink-0 text-brand-300" strokeWidth={1.75} />
            <a href={`mailto:${SCHOOL_INFO.email}`} className="inline-flex min-h-11 items-center break-all transition-colors duration-150 hover:text-white">
              {SCHOOL_INFO.email}
            </a>
          </p>
        </div>
        <div className="space-y-3 text-[13px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Portal</p>
          <p className="leading-relaxed text-white/62">
            Access is by invitation only. Staff, student and parent credentials are issued by the
            school office — there is no public registration.
          </p>
        </div>
      </div>
      <p className="relative mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6 text-center text-[11px] font-medium text-white/45">
        © {new Date().getFullYear()} {SCHOOL_INFO.name}. All academic &amp; administrative rights reserved.
      </p>
    </footer>
  );
}