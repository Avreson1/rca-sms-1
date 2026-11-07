import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  LogIn,
  MapPin,
  Navigation,
  School,
  ShieldCheck,
  BookOpen,
  Laptop,
  Layers,
  Clock,
  Mail,
  Phone,
} from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { SCHOOL_INFO } from "@/lib/constants";
import { BLOG_POSTS, GALLERY_ITEMS, MAPS_DIRECTIONS_URL, MAPS_EMBED_URL } from "@/lib/landing/content";

export const metadata: Metadata = {
  title: `${SCHOOL_INFO.name} | ${SCHOOL_INFO.motto}`,
  description: `${SCHOOL_INFO.name}, ${SCHOOL_INFO.address} — portal for admissions, academics, CBT examinations and bursary services.`,
};

const QUICK_FACTS = [
  { icon: School, label: "Class range", value: "Pre-Play to SS 3" },
  { icon: BookOpen, label: "Assessment", value: "40:60 CA structure" },
  { icon: Layers, label: "Grading", value: "4 adjustable tiers" },
  { icon: Laptop, label: "Examinations", value: "CBT engine" },
];

const STAGES = [
  {
    index: "01",
    title: "Early Years",
    body: "Creche, Play and Nursery classes learn through phonics, Montessori-inspired sensory work and early literacy — assessed on expectation-based descriptors, not raw marks.",
  },
  {
    index: "02",
    title: "Basic Primary",
    body: "Primary 1 to 5 builds literacy, mathematics, basic science and civic values, with a 40:60 continuous-assessment structure that tracks every pupil term by term.",
  },
  {
    index: "03",
    title: "Secondary",
    body: "JSS and SSS tracks prepare students for BECE, WAEC, NECO and JAMB — with CBT examinations and the national A1–F9 grading scale run through the portal.",
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      {/* Hero */}
      <section className="texture-grid relative overflow-hidden border-b border-hairline">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] rounded-full bg-brand-100/70 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-12 lg:py-20">
          <div className="rise-in lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Secure school portal
            </p>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]">
              {SCHOOL_INFO.name}
              <span className="mt-3 block font-display text-xl font-bold tracking-tight text-accent-600 sm:text-2xl">
                {SCHOOL_INFO.motto}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
              One portal for the whole school family — admissions and enrollment, gradebooks and
              published report cards, CBT examinations, and bursary invoices. {SCHOOL_INFO.portalName}{" "}
              keeps every record in one place, accessible only to authorized staff, students and
              parents.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="group inline-flex min-h-12 items-center gap-2.5 rounded-xl bg-accent-600 px-6 font-display text-sm font-bold tracking-tight text-white shadow-sm transition-colors duration-150 hover:bg-accent-700"
              >
                <LogIn className="h-4 w-4" strokeWidth={2} />
                Portal login
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>
              <a
                href={MAPS_DIRECTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-hairline bg-surface px-5 text-sm font-semibold text-slate-600 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                <Navigation className="h-4 w-4" strokeWidth={1.75} />
                Get directions
              </a>
            </div>
            <p className="mt-4 text-[12px] font-medium text-slate-400">
              Staff, students &amp; parents: sign in with the credentials issued by the school office.
            </p>
          </div>

          <div className="rise-in lg:col-span-5" style={{ animationDelay: "90ms" }}>
            <figure className="relative overflow-hidden rounded-2xl bg-brand-950 shadow-xl ring-1 ring-inset ring-black/5">
              <div className="campus-backdrop aspect-[4/3] w-full" />
              <div aria-hidden="true" className="absolute inset-0 bg-[#1034a6]/25" />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-night-900/90 to-transparent"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4 text-[11px] font-semibold text-white/85">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-accent-300" strokeWidth={2} />
                Rayfield, Jos South LGA · Plateau State
              </figcaption>
            </figure>
          </div>
        </div>

        {/* Quick facts */}
        <div className="relative mx-auto max-w-6xl px-5 pb-14">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_FACTS.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-hairline bg-surface p-4 shadow-2xs transition-colors duration-150 hover:border-brand-200"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                  <fact.icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {fact.label}
                </p>
                <p className="mt-1 font-display text-sm font-extrabold tracking-tight text-ink">
                  {fact.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-b border-hairline bg-surface px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-600">
              About the academy
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">
              Three stages, one continuous record
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              A pupil joins in Creche and leaves after SS 3. The portal keeps the same child in view
              the whole way — every term&apos;s marks, traits, invoices and published results.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STAGES.map((stage) => (
              <article
                key={stage.index}
                className="group rounded-2xl border border-hairline bg-canvas p-6 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="font-mono text-xs font-bold tabular-nums text-accent-600">
                  {stage.index}
                </span>
                <h3 className="mt-3 font-display text-lg font-extrabold tracking-tight text-ink">
                  {stage.title}
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{stage.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Visit / map */}
      <section id="visit" className="border-b border-hairline px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="relative h-[380px] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm">
                {/* Behind the live embed: if this browser cannot reach Google,
                    the address and a working directions link still show. */}
                <div className="texture-grid absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-50 p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-2xs">
                    <MapPin className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <p className="font-display text-lg font-extrabold tracking-tight text-ink">{SCHOOL_INFO.name}</p>
                  <p className="max-w-sm text-[13px] leading-relaxed text-muted">{SCHOOL_INFO.address}, Nigeria</p>
                  <a
                    href={MAPS_DIRECTIONS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors duration-150 hover:bg-brand-700"
                  >
                    <Navigation className="h-4 w-4" strokeWidth={2} />
                    Open the map in Google Maps
                  </a>
                  <p className="text-[11px] text-slate-400">The live map loads from Google when this browser can reach it.</p>
                </div>
                <iframe
                  src={MAPS_EMBED_URL}
                  title={`Map showing ${SCHOOL_INFO.name}, ${SCHOOL_INFO.address}`}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-600">
                  Visit us
                </p>
                <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">
                  Find us in Rayfield, Jos
                </h2>
                <ul className="mt-5 space-y-4 text-[13px] leading-relaxed text-muted">
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                    {SCHOOL_INFO.address}, Nigeria
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                    Monday to Friday, 7:30am — 4:00pm
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                    <a href={`tel:${SCHOOL_INFO.phone.replace(/\s/g, "")}`} className="inline-flex min-h-6 items-center font-mono tabular-nums transition-colors duration-150 hover:text-brand-700">
                      {SCHOOL_INFO.phone}
                    </a>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                    <a href={`mailto:${SCHOOL_INFO.email}`} className="flex min-h-6 items-center break-all transition-colors duration-150 hover:text-brand-700">
                      {SCHOOL_INFO.email}
                    </a>
                  </li>
                </ul>
                <a
                  href={MAPS_DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-display text-[13px] font-bold tracking-tight text-white transition-colors duration-150 hover:bg-brand-700"
                >
                  <Navigation className="h-4 w-4" strokeWidth={2} />
                  Directions on Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog teaser */}
      <section id="news" className="border-b border-hairline bg-surface px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-600">
                Notices
              </p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">
                From the school blog
              </h2>
            </div>
            <Link
              href="/blog"
              className="group inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-hairline px-4 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              All posts
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-2xl border border-hairline bg-canvas p-6 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50/40"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600">
                  {post.tag}
                </p>
                <h3 className="mt-3 font-display text-base font-extrabold leading-snug tracking-tight text-ink transition-colors duration-150 group-hover:text-brand-700">
                  {post.title}
                </h3>
                <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted">
                  {post.excerpt}
                </p>
                <p className="mt-5 border-t border-hairline pt-4 font-mono text-[10px] font-medium tabular-nums text-slate-400">
                  {new Date(post.date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery teaser */}
      <section id="life" className="border-b border-hairline px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-600">
                School life
              </p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink">
                The academy in pictures
              </h2>
            </div>
            <Link
              href="/gallery"
              className="group inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-hairline bg-surface px-4 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              Full gallery
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {GALLERY_ITEMS.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href="/gallery"
                className={`group texture-grid-light relative flex aspect-square flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ring-inset ring-white/12 transition-transform duration-150 hover:-translate-y-0.5 ${item.gradient}`}
              >
                {item.image && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
                    style={{ backgroundImage: `url("${item.image}")` }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-night-900/85 via-night-900/20 to-transparent"
                />
                <p className="relative text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">
                  {item.category}
                </p>
                <p className="relative mt-1.5 font-display text-sm font-extrabold leading-snug tracking-tight text-white">
                  {item.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Login CTA band */}
      <section className="px-5 py-16">
        <div className="texture-grid-light relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-night-900 px-6 py-10 ring-1 ring-inset ring-white/12 sm:px-10 md:flex-row">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent-600/20 blur-3xl"
          />
          <div className="relative">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
              Ready to enter the portal?
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
              Report cards, invoices, CBT exams and gradebooks are one login away.
            </p>
          </div>
          <Link
            href="/login"
            className="group relative inline-flex min-h-12 flex-shrink-0 items-center gap-2.5 rounded-xl bg-accent-600 px-6 font-display text-sm font-bold tracking-tight text-white transition-colors duration-150 hover:bg-accent-700"
          >
            <LogIn className="h-4 w-4" strokeWidth={2} />
            Portal login
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}