"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  School,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GraduationCap,
  Receipt,
  Laptop,
  MapPin,
  LifeBuoy,
  ArrowUpRight,
} from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth } from "@/lib/realtime-store";

const WHAT_THE_PORTAL_HOLDS = [
  {
    icon: GraduationCap,
    title: "Assessment & report cards",
    body: "Continuous assessment, affective and psychomotor traits, and the term result the exam office publishes.",
  },
  {
    icon: Receipt,
    title: "Bursary & inventory",
    body: "Invoices, payments and receipts kept on the school's own ledger, with the store inventory beside them.",
  },
  {
    icon: Laptop,
    title: "CBT examinations",
    body: "One question bank filed by the exam office and sat on any machine in the computer room.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginWithRole } = useRealtimeAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // Reveals only what this person is typing at this moment. Nothing here can
  // show a stored password: the database keeps a salted hash, which is not a
  // password, and no route hands one back.
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter both username / staff ID and security access passcode.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result?.error || "Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      const user = loginWithRole(result.user.role, result.user);
      setSuccessToast(`Authenticated successfully as ${user.fullName}`);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 700);
    } catch {
      setErrorMessage("Unable to reach the authentication service. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-brand-950 font-sans text-white">
      {/* The campus, drawn for this portal. */}
      <div aria-hidden="true" className="campus-backdrop absolute inset-0" />

      {/* Egyptian Blue laid over the image at 40% opacity — the overlay is 60%
          transparent, so the photograph still reads through it. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[#1034a6]/40" />

      {/* A second, directional scrim. It is not the blue overlay: it only keeps
          the left-hand copy and the card edge legible over the bright sky. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-brand-950/94 via-brand-950/72 to-brand-950/30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-brand-950/88 via-transparent to-brand-950/40"
      />
      <div
        aria-hidden="true"
        className="texture-grain pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Link
            href="/welcome"
            className="group flex min-w-0 items-center gap-3 rounded-xl transition-colors duration-150"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/25 backdrop-blur-sm transition-colors duration-150 group-hover:bg-white/16">
              <School className="h-5 w-5 text-white" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-extrabold uppercase tracking-[0.16em] text-white">
                {SCHOOL_INFO.shortName}
                <span className="ml-2 font-semibold normal-case tracking-normal text-accent-300">Portal</span>
              </span>
              <span className="mt-0.5 block truncate text-xs font-medium text-white/70">
                {SCHOOL_INFO.name}
              </span>
            </span>
          </Link>

          <Link
            href="/welcome"
            className="hidden items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/85 backdrop-blur-sm transition-colors duration-150 hover:border-white/35 hover:bg-white/12 hover:text-white sm:inline-flex"
          >
            <span>School website</span>
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </header>

        <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-center gap-10 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-12 lg:gap-14 lg:px-12 lg:pb-16">
          {/* Left: what this door opens onto. */}
          <section className="rise-in lg:col-span-7 lg:pr-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              {SCHOOL_INFO.portalName}
            </p>

            <h1 className="mt-6 max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              Every mark, every fee, every term —
              <span className="text-accent-300"> on one school record.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/78">
              {SCHOOL_INFO.motto}. Sign in with the identifier the school office issued you; the
              portal opens only the screens your role is meant to see.
            </p>

            <ul className="mt-9 max-w-xl divide-y divide-white/12 border-y border-white/12">
              {WHAT_THE_PORTAL_HOLDS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4 py-4">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/18">
                    <Icon className="h-4 w-4 text-accent-300" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold tracking-tight text-white">
                      {title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-white/68">{body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-white/62">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-white/45" strokeWidth={1.75} />
                {SCHOOL_INFO.address}
              </span>
              <span className="hidden h-3 w-px bg-white/20 sm:block" />
              <span className="font-mono tabular-nums">
                {SCHOOL_INFO.currentSession} · {SCHOOL_INFO.currentTerm}
              </span>
            </div>
          </section>

          {/* Right: the sign-in card. */}
          <section className="rise-in lg:col-span-5" style={{ animationDelay: "90ms" }}>
            <div className="relative overflow-hidden rounded-2xl bg-surface text-ink shadow-2xl ring-1 ring-black/5">
              <div aria-hidden="true" className="h-1 w-full bg-accent-600" />

              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
                    <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
                      Sign in to the portal
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-muted">Staff · Student · Parent</p>
                  </div>
                </div>

                <p className="mt-5 max-w-md text-[13px] leading-relaxed text-muted">
                  Enter the username and security passcode issued by the school office to reach your
                  workspace.
                </p>

                {errorMessage && (
                  <div
                    role="alert"
                    className="animate-in fade-in mt-5 flex items-start gap-2.5 rounded-xl border border-accent-200 bg-accent-50 p-3.5 text-[13px] font-medium leading-relaxed text-accent-800"
                  >
                    <AlertCircle className="mt-px h-4 w-4 flex-shrink-0 text-accent-600" strokeWidth={2} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleManualLogin} className="mt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="login-username"
                      className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"
                    >
                      Username / Staff ID / Admission No
                    </label>
                    <div className="relative">
                      <input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. RCA/STF/014"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-11 font-mono text-sm text-ink outline-none transition-colors duration-150 placeholder:font-sans placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/18"
                        required
                        autoComplete="username"
                      />
                      <UserCheck
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300"
                        strokeWidth={1.75}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-passcode"
                      className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"
                    >
                      Security Access Passcode
                    </label>
                    <div className="relative">
                      <input
                        id="login-passcode"
                        type={showPasscode ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your passcode"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 font-mono text-sm text-ink outline-none transition-colors duration-150 placeholder:font-sans placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/18"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasscode((visible) => !visible)}
                        aria-label={showPasscode ? "Hide the passcode" : "Show the passcode you typed"}
                        aria-pressed={showPasscode}
                        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-brand-600"
                      >
                        {showPasscode ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 font-display text-sm font-bold tracking-tight text-white shadow-sm transition-colors duration-150 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        <span>Verifying credentials…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in to your workspace</span>
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                          strokeWidth={2}
                        />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 flex items-start gap-2.5 border-t border-hairline pt-5 text-[12px] leading-relaxed text-muted">
                  <LifeBuoy className="mt-px h-4 w-4 flex-shrink-0 text-brand-600" strokeWidth={1.75} />
                  <p>
                    Lost your passcode? The school office can issue a new one from{" "}
                    <span className="font-semibold text-ink">Settings → User Access</span>. This browser
                    never keeps the passcode you type.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 px-1 text-center text-[11px] font-medium text-white/55 lg:text-left">
              Protected by role-based access. Every record stays on the school&apos;s server.
            </p>
          </section>
        </main>

        <footer className="border-t border-white/12 px-5 py-5 sm:px-8 lg:px-12">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-3 text-[11px] font-medium text-white/55 sm:flex-row">
            <p>
              © {new Date().getFullYear()} {SCHOOL_INFO.name}. All academic &amp; administrative rights
              reserved.
            </p>
            <nav className="flex items-center gap-1">
              <Link href="/welcome" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 transition-colors duration-150 hover:bg-white/10 hover:text-white">
                School site
              </Link>
              <Link href="/blog" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 transition-colors duration-150 hover:bg-white/10 hover:text-white">
                News
              </Link>
              <Link href="/gallery" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 transition-colors duration-150 hover:bg-white/10 hover:text-white">
                Gallery
              </Link>
            </nav>
          </div>
        </footer>
      </div>

      {successToast && (
        <div
          role="status"
          className="animate-in slide-in-from-top-4 fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-emerald-200 bg-surface px-4 py-3.5 text-ink shadow-xl sm:right-6 sm:top-6"
        >
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" strokeWidth={2} />
          <span className="text-[13px] font-semibold">{successToast}</span>
        </div>
      )}
    </div>
  );
}