"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, MapPin, ShieldCheck, User, LogOut, CheckCircle2 } from "lucide-react";
import { SCHOOL_INFO } from "@/lib/constants";
import { useRealtimeAuth } from "@/lib/realtime-store";

export function Navbar() {
  const router = useRouter();
  const { currentUser, logout } = useRealtimeAuth();
  const [mounted, setMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggedOutToast, setLoggedOutToast] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "EXAM_OFFICER":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "TEACHER":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "ACCOUNTANT":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "STUDENT_PARENT":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      default:
        return "bg-purple-100 text-purple-800 border-purple-300";
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
    setLoggedOutToast(true);
    setTimeout(() => {
      router.push("/login");
    }, 1000);
  };

  const activeUser = (mounted ? currentUser : null) || {
    username: "dominic370",
    fullName: "Dr. Dominic Mark",
    role: "SUPER_ADMIN" as const,
    staffId: "RCA/PERS/025",
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.substring(0, 2) || "DM").toUpperCase();
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs select-none">
        {/* Left: Location & School indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-[#0000FF] flex-shrink-0" />
          <span className="font-extrabold text-slate-900 hidden sm:inline tracking-tight">{SCHOOL_INFO.name}</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-slate-500 text-[11px] truncate max-w-[200px] md:max-w-none">
            Rayfield Academic Complex, Jos
          </span>
        </div>

        {/* Right: Authenticated User, Role Indicator & Logout */}
        <div className="flex items-center gap-3">
          
          {/* Role Badge (Live Active Session Indicator) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0000FF]" />
            <span className="font-bold text-slate-900 hidden md:inline text-[11px]">Role:</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border ${getRoleBadgeStyle(activeUser.role)}`}>
              {activeUser.role}
            </span>
          </div>

          {/* Notification Bell */}
          <button 
            type="button"
            aria-label="Notifications"
            className="relative p-2 rounded-xl text-slate-500 hover:bg-blue-50 hover:text-[#0000FF] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF0000] rounded-full ring-2 ring-white" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0000FF] to-blue-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-blue-500/20 ring-1 ring-cyan-400/50">
              {getInitials(activeUser.fullName)}
            </div>
            <div className="text-xs hidden sm:block">
              <p className="font-bold text-slate-900 leading-tight truncate max-w-[140px]">{activeUser.fullName}</p>
              <p className="text-slate-500 text-[10px] font-mono font-medium">{activeUser.staffId}</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-[#FF0000] hover:text-white border border-rose-200 hover:border-transparent rounded-xl transition-all shadow-2xs cursor-pointer ml-1 group"
            title="Log Out of Session"
          >
            <LogOut className="w-3.5 h-3.5 text-[#FF0000] group-hover:text-white transition-colors" />
            <span className="hidden md:inline">Log Out</span>
          </button>

        </div>
      </header>

      {/* Toast Notification */}
      {loggedOutToast && (
        <div className="fixed bottom-6 right-6 bg-[#0a1128] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-in slide-in-from-bottom-5 border border-cyan-400/40">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold">Successfully logged out. Redirecting to login portal...</span>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-[#FF0000] flex items-center justify-center mx-auto shadow-sm">
              <LogOut className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Sign Out of RCA Portal?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to end active session for <strong>{activeUser.fullName}</strong> ({activeUser.role})?
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-bold text-white bg-[#FF0000] hover:bg-red-700 rounded-xl transition-colors shadow-md shadow-red-500/20 cursor-pointer"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
