"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { SyncStatusNotice } from "@/components/layout/sync-status-notice";
import { useRealtimeAuth } from "@/lib/realtime-store";
import { isRouteAllowed, rolesAllowedForPath } from "@/lib/rbac";
import { ShieldAlert, ArrowLeft, LogIn, Lock } from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
}

const DESKTOP_BREAKPOINT_PX = 1024;

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { currentUser } = useRealtimeAuth();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // The drawer is only reachable below the desktop breakpoint, so navigating
  // always dismisses it and a resize past the breakpoint closes it.
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) setSidebarOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // The guard used to read "role not known yet" as SUPER_ADMIN, so a browser whose
  // session had not loaded — or had just been handed over to the next person, or had
  // its storage cleared — painted every screen with an administrator's permissions.
  // An unknown role now paints a waiting line instead. The server refuses every data
  // call either way; this only decides what the screen pretends the visitor may do.
  const knownRole = mounted ? currentUser?.role ?? null : null;
  const isAllowed = knownRole !== null && isRouteAllowed(knownRole, pathname);
  const allowedRoles = knownRole === null ? [] : rolesAllowedForPath(pathname);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="animate-in fade-in fixed inset-0 z-40 bg-scrim/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <SyncStatusNotice />
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 sm:p-6 md:p-8">
          {isAllowed ? (
            children
          ) : knownRole === null ? (
            <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-hairline bg-surface p-8 shadow-sm">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
                  <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
                  This screen is waiting for your login
                </h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  The portal has not read a signed-in role on this browser yet, so it shows you nothing —
                  not even a menu. Nothing has been refused: every record on this page is still on the
                  school&apos;s server, and none of it was sent to this device. If this line does not clear
                  in a few seconds, sign in again from the link below.
                </p>
                <Link
                  href="/login"
                  className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 font-display text-[13px] font-bold tracking-tight text-white transition-colors duration-150 hover:bg-brand-700"
                >
                  <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Go to the login</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md space-y-5 rounded-2xl border border-hairline bg-surface p-8 shadow-lg">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 ring-1 ring-inset ring-accent-100">
                  <ShieldAlert className="h-6 w-6" strokeWidth={1.75} />
                </span>

                <div className="space-y-2">
                  <span className="inline-block rounded-full bg-accent-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-700 ring-1 ring-inset ring-accent-200">
                    Role boundary
                  </span>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">
                    Access restricted
                  </h2>
                  <p className="text-[13px] leading-relaxed text-muted">
                    The login on this browser has the role{" "}
                    <strong className="font-semibold text-ink">{knownRole.replace("_", " ")}</strong>, and this
                    portal does not open{" "}
                    <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-accent-700">
                      {pathname}
                    </code>{" "}
                    to it. Nothing is broken and no record was lost — the screen was simply never part of
                    this role.
                  </p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-hairline bg-slate-50 p-4 text-left">
                  <div className="flex items-center gap-2 font-display text-[13px] font-bold tracking-tight text-ink">
                    <Lock className="h-3.5 w-3.5 text-brand-600" strokeWidth={1.75} />
                    <span>Who does open this screen</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted">
                    {allowedRoles.map((role) => role.replace("_", " ")).join(", ")}. A super admin can issue a
                    login for the role your work needs from Settings → User Access; the login decides the
                    screen, not anything this browser can ask for.
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2.5 pt-1 sm:flex-row">
                  <Link
                    href="/"
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 font-display text-[13px] font-bold tracking-tight text-white transition-colors duration-150 hover:bg-brand-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Return to dashboard</span>
                  </Link>
                  <Link
                    href="/login"
                    className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface px-4 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-brand-700"
                  >
                    <LogIn className="h-3.5 w-3.5 text-brand-600" strokeWidth={2} />
                    <span>Switch login</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}