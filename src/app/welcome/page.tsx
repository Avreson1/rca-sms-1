import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LogIn, MapPin, Navigation, School, ShieldCheck, Sparkles, BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { SCHOOL_INFO } from "@/lib/constants";
import { BLOG_POSTS, GALLERY_ITEMS, MAPS_DIRECTIONS_URL, MAPS_EMBED_URL } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: `${SCHOOL_INFO.name} | ${SCHOOL_INFO.motto}`,
  description: `${SCHOOL_INFO.name}, ${SCHOOL_INFO.address} — portal for admissions, academics, CBT examinations and bursary services.`,
};

const QUICK_FACTS = [
  { icon: School, label: "Class Range", value: "Pre-Play to SS 3" },
  { icon: BookOpen, label: "Assessment", value: "40:60 CA Structure" },
  { icon: Sparkles, label: "Grading", value: "4 Adjustable Tiers" },
  { icon: ShieldCheck, label: "Examinations", value: "CBT Engine" },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#060b19] text-slate-100">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#0000FF]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#00FFFF]/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure School Portal
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
              {SCHOOL_INFO.name}
              <span className="mt-2 block text-xl font-bold text-cyan-300 md:text-2xl">
                {SCHOOL_INFO.motto}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300">
              One portal for the whole school family — admissions and enrollment, gradebooks and
              published report cards, CBT examinations, and bursary invoices. {SCHOOL_INFO.portalName} keeps
              every record in one place, accessible only to authorized staff, students and parents.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2.5 rounded-2xl border border-cyan-400/50 bg-[#0000FF] px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-blue-800/40 transition-all hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-cyan-500/30"
              >
                <LogIn className="h-5 w-5 text-cyan-300" />
                Portal Login
                <ArrowRight className="h-4 w-4 text-cyan-300 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href={MAPS_DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-600 bg-white/5 px-6 py-3.5 text-sm font-bold text-slate-200 transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
              </a>
            </div>
            <p className="mt-4 text-[11px] text-slate-500">
              Staff, students &amp; parents: sign in with the credentials issued by the school office.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {QUICK_FACTS.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-blue-950 bg-[#0a1128]/80 p-5 backdrop-blur-md"
              >
                <fact.icon className="h-6 w-6 text-cyan-400" />
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{fact.label}</p>
                <p className="mt-1 text-sm font-extrabold text-white">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-blue-950/60 bg-[#0a1128]/60 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-black tracking-tight text-white">About the Academy</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-950 bg-[#060b19] p-6">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Early Years</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Creche, Play and Nursery classes learn through phonics, Montessori-inspired sensory
                work and early literacy — assessed on expectation-based descriptors, not raw marks.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-950 bg-[#060b19] p-6">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Basic Primary</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Primary 1 to 5 builds literacy, mathematics, basic science and civic values, with a
                40:60 continuous-assessment structure that tracks every pupil term by term.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-950 bg-[#060b19] p-6">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Secondary</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                JSS and SSS tracks prepare students for BECE, WAEC, NECO and JAMB — with CBT
                examinations and the national A1–F9 grading scale run through the portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visit / map */}
      <section id="visit" className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">Find Us in Rayfield, Jos</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <MapPin className="h-4 w-4 text-cyan-400" />
                {SCHOOL_INFO.address}, Nigeria
              </p>
            </div>
            <a
              href={MAPS_DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-cyan-300 transition-colors hover:bg-cyan-400/20 md:self-auto"
            >
              <Navigation className="h-4 w-4" />
              Directions on Google Maps
            </a>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-blue-950 shadow-2xl shadow-blue-950/40">
            <iframe
              src={MAPS_EMBED_URL}
              title={`Map showing ${SCHOOL_INFO.name}, ${SCHOOL_INFO.address}`}
              className="h-[380px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* Blog teaser */}
      <section id="news" className="border-t border-blue-950/60 bg-[#0a1128]/60 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-white">From the School Blog</h2>
            <Link
              href="/blog"
              className="group inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
            >
              All posts
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-2xl border border-blue-950 bg-[#060b19] p-6 transition-all hover:-translate-y-1 hover:border-cyan-400/40"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{post.tag}</p>
                <h3 className="mt-2 text-sm font-extrabold leading-snug text-white group-hover:text-cyan-200">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{post.excerpt}</p>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {new Date(post.date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery teaser */}
      <section id="life" className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-white">School Life in Pictures</h2>
            <Link
              href="/gallery"
              className="group inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
            >
              Full gallery
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {GALLERY_ITEMS.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href="/gallery"
                className={`group flex aspect-square flex-col justify-end rounded-2xl border border-blue-950 bg-gradient-to-br p-4 transition-transform hover:-translate-y-1 ${item.gradient}`}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">{item.category}</p>
                <p className="mt-1 text-xs font-extrabold leading-snug text-white">{item.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Login CTA band */}
      <section className="px-5 pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 rounded-3xl border border-cyan-400/30 bg-gradient-to-r from-[#0a1128] via-[#000033] to-[#0a1128] px-8 py-10 md:flex-row">
          <div>
            <h2 className="text-xl font-black text-white">Ready to enter the portal?</h2>
            <p className="mt-1 text-sm text-slate-300">
              Report cards, invoices, CBT exams and gradebooks are one login away.
            </p>
          </div>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2.5 rounded-2xl border border-cyan-400/50 bg-[#0000FF] px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-blue-800/40 transition-all hover:-translate-y-0.5 hover:bg-blue-600"
          >
            <LogIn className="h-5 w-5 text-cyan-300" />
            Portal Login
            <ArrowRight className="h-4 w-4 text-cyan-300 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
