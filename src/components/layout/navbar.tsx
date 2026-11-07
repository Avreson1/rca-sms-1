"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Menu, ShieldCheck, LogOut, CheckCircle2 } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";
import { useSchoolConfig } from "@/lib/school-config";
import { useRealtimeAuth } from "@/lib/realtime-store";

interface NavbarProps {
  onMenuClick: () => void;
}

// Six roles, six tones, all inside the portal's palette: brand and azure for the
// two administrative offices, the semantic green and amber for teaching and
// money, neutral for families, and scarlet for a QA login that is not a real user.
const ROLE_TONES: Record<string, string> = {
  SUPER_ADMIN: "bg-brand-50 text-brand-700 ring-brand-200",
  EXAM_OFFICER: "bg-azure-50 text-azure-700 ring-azure-200",
  TEACHER: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACCOUNTANT: "bg-amber-50 text-amber-700 ring-amber-200",
  STUDENT_PARENT: "bg-slate-100 text-slate-600 ring-slate-200",
  TESTERS: "bg-accent-50 text-accent-700 ring-accent-200",
};

export function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const { currentUser, logout } = useRealtimeAuth();
  const { config: school } = useSchoolConfig();
  const [mounted, setMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggedOutToast, setLoggedOutToast] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showLogoutModal) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowLogoutModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showLogoutModal]);

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
    setLoggedOutToast(true);
    setTimeout(() => {
      router.push("/login");
    }, 1000);
  };

  // The server session names the signed-in person; until it resolves the header
  // used to show a super admin who may never have signed in.
  const activeUser = mounted ? currentUser : null;

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.substring(0, 2) || "—").toUpperCase();
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 select-none items-center justify-between gap-3 border-b border-hairline bg-surface/92 px-3 backdrop-blur-md sm:px-4 md:px-6">
        {/* Location & school */}
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="-ml-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-600 lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <MapPin className="hidden h-3.5 w-3.5 flex-shrink-0 text-brand-600 sm:block" strokeWidth={1.75} />
          <span className="hidden truncate font-display text-[13px] font-extrabold tracking-tight text-ink md:inline">
            {school?.school_name || SCHOOL_INFO.name}
          </span>
          <span aria-hidden="true" className="hidden text-slate-300 md:inline">
            •
          </span>
          <span className="hidden max-w-[220px] truncate text-[11px] font-medium text-muted sm:inline lg:max-w-none">
            {school?.address?.trim() || "No address on the school's record — set it in Settings"}
          </span>
        </div>

        {/* Session */}
        <div className="flex flex-shrink-0 items-center gap-2 lg:gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-hairline bg-slate-50 px-3 py-2 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" strokeWidth={1.75} />
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 md:inline">
              Role
            </span>
            {activeUser ? (
              <span
                className={`rounded-md px-2 py-1 font-mono text-[10px] font-bold tabular-nums ring-1 ring-inset ${
                  ROLE_TONES[activeUser.role] ?? "bg-slate-100 text-slate-600 ring-slate-200"
                }`}
              >
                {activeUser.role}
              </span>
            ) : (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-200">
                Signing in…
              </span>
            )}
          </div>

          {/* The bell used to hang a permanent red dot over an icon that opened
              nothing — an unread notice that was never a notice. The portal sends no
              email or SMS and holds no notification table, so there is nothing to
              report as unread yet. */}

          <div className="flex items-center gap-2.5 border-l border-hairline pl-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-display text-xs font-extrabold text-white ring-1 ring-inset ring-white/20">
              {activeUser ? getInitials(activeUser.fullName) : "—"}
            </div>
            <div className="hidden text-xs xl:block">
              <p className="max-w-[150px] truncate font-display text-[13px] font-bold leading-tight tracking-tight text-ink">
                {activeUser?.fullName || "Signing in…"}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-slate-400">
                {activeUser?.staffId || "—"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="group ml-1 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface px-2.5 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 sm:px-3"
            title="Log out of this session"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden md:inline">Log out</span>
          </button>
        </div>
      </header>

      {loggedOutToast && (
        <div
          role="status"
          className="animate-in slide-in-from-bottom-5 fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3 text-ink shadow-xl sm:bottom-6 sm:right-6"
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" strokeWidth={2} />
          <span className="text-xs font-semibold">Signed out. Returning to the login…</span>
        </div>
      )}

      {showLogoutModal && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="animate-in zoom-in-95 w-full max-w-sm rounded-2xl border border-hairline bg-surface p-6 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-100">
              <LogOut className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h3 id="logout-title" className="mt-4 font-display text-lg font-extrabold tracking-tight text-ink">
              Sign out of the RCA portal?
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {activeUser ? (
                <>
                  This ends the active session for <strong className="font-semibold text-ink">{activeUser.fullName}</strong>{" "}
                  ({activeUser.role}). Any draft still open on this machine stays on this machine.
                </>
              ) : (
                "The server has not named the signed-in user yet, so this would end an unidentified session."
              )}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="min-h-11 rounded-xl border border-hairline bg-surface px-4 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-ink"
              >
                Stay signed in
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-11 rounded-xl bg-accent-600 px-4 font-display text-[13px] font-bold tracking-tight text-white transition-colors duration-150 hover:bg-accent-700"
              >
                Yes, sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}