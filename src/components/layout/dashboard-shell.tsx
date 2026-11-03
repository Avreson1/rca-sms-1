"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { useRealtimeAuth } from "@/lib/realtime-store";
import { isRouteAllowed } from "@/lib/rbac";
import { ShieldAlert, ArrowLeft, LogIn, Lock } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";

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

  const currentRole = (mounted ? currentUser?.role : null) || "SUPER_ADMIN";
  const isAllowed = isRouteAllowed(currentRole, pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 sm:p-6 md:p-8">
          {isAllowed ? (
            children
          ) : (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
              <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-8 shadow-xl shadow-rose-950/5 space-y-5">
                <div className="w-16 h-16 bg-rose-100 text-[#FF0000] rounded-2xl flex items-center justify-center mx-auto ring-8 ring-rose-50">
                  <ShieldAlert className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-rose-200">
                    RBAC Security Boundary
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Your current authenticated role (<strong>{currentRole.replace("_", " ")}</strong>) does not hold administrative authorization to access the route <code className="bg-slate-100 px-1.5 py-0.5 rounded text-rose-600 font-mono text-[11px]">{pathname}</code>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1 text-slate-600">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Authorized Clearance Level</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    This module is restricted to Tier 1 / Tier 2 governance staff. Please contact the Principal or Dean of Studies for privilege escalations.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                  <Link
                    href="/"
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Dashboard</span>
                  </Link>
                  <Link
                    href="/login"
                    className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-blue-200"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-600" />
                    <span>Switch Portal Login</span>
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
