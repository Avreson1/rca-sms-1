"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  School,
  ShieldCheck,
  UserCheck,
  Sparkles,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { SCHOOL_INFO, DRAFT_LOGIN_ACCOUNTS } from "@/lib/constants";
import { useRealtimeAuth } from "@/lib/realtime-store";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithRole } = useRealtimeAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter both username / staff ID and security access passcode.");
      setLoading(false);
      return;
    }

    // Match registered account credentials
    const matched = DRAFT_LOGIN_ACCOUNTS.find(
      (acc) =>
        acc.username.toLowerCase() === username.trim().toLowerCase() &&
        acc.password === password.trim()
    );

    if (!matched) {
      // Check if username matches a registered account with incorrect password
      const usernameExists = DRAFT_LOGIN_ACCOUNTS.some(
        (acc) => acc.username.toLowerCase() === username.trim().toLowerCase()
      );

      if (usernameExists) {
        setErrorMessage("Invalid security passcode. Please check your credentials.");
        setLoading(false);
        return;
      }

      if (password.trim().length < 4) {
        setErrorMessage("Invalid credentials. Please verify your Staff ID / Username and passcode.");
        setLoading(false);
        return;
      }
    }

    const targetRole = matched?.role || "SUPER_ADMIN";
    const user = loginWithRole(targetRole);

    setSuccessToast(`Authenticated successfully as ${user.fullName}`);
    setTimeout(() => {
      router.push("/");
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#060b19] text-slate-100 flex flex-col justify-between selection:bg-[#0000FF] selection:text-white relative overflow-hidden">
      {/* Background Decorative Mesh with Scheme 1 Colors */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0000FF]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-[#00FFFF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-[#FF0000]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="border-b border-blue-950/80 bg-[#0a1128]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#0000FF] p-2.5 rounded-2xl text-white shadow-lg shadow-blue-800/40 ring-1 ring-cyan-400/50">
            <School className="w-6 h-6 text-cyan-200" />
          </div>
          <div>
            <h1 className="font-black text-base text-white tracking-wider uppercase">
              {SCHOOL_INFO.shortName} <span className="text-cyan-400 font-bold">Portal</span>
            </h1>
            <p className="text-xs text-blue-200/70 font-medium">{SCHOOL_INFO.name} • {SCHOOL_INFO.motto}</p>
          </div>
        </div>
      </header>

      {/* Main Content Area: Centered Secure Login Card */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-12 flex flex-col justify-center z-10">
        
        {/* Toast Feedback */}
        {successToast && (
          <div className="fixed top-20 right-6 bg-[#0a1128] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-top-4 border border-cyan-400/60 ring-2 ring-cyan-400/20">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <span className="text-xs font-bold tracking-wide">{successToast}</span>
          </div>
        )}

        {/* Authentication Card */}
        <div className="bg-gradient-to-b from-[#0a1128] to-[#0d1838] border border-cyan-500/30 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-blue-950/80 relative">
          <div className="absolute -top-3.5 right-8 bg-[#0000FF] text-cyan-200 text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest border border-cyan-400/50 shadow-md flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
            <span>Security Gateway</span>
          </div>

          <div className="space-y-2 mb-7 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold mx-auto">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Unified Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Institutional Sign-In</h2>
            <p className="text-xs text-blue-200/70 max-w-sm mx-auto">
              Enter your authorized staff or student credentials to access your designated workspace.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-950/70 border border-[#FF0000]/50 rounded-xl flex items-center gap-2.5 text-rose-200 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#FF0000] flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Username / Staff ID / Admission No
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your authorized identifier"
                  className="w-full bg-[#060b19]/90 border border-blue-900 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                  required
                  autoComplete="username"
                />
                <UserCheck className="w-4 h-4 text-cyan-400/70 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Security Access Passcode
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#060b19]/90 border border-blue-900 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                  required
                  autoComplete="current-password"
                />
                <Lock className="w-4 h-4 text-cyan-400/70 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0000FF] hover:bg-blue-600 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-700/40 border border-cyan-400/40 transition-all flex items-center justify-center gap-2 text-sm tracking-wide cursor-pointer group disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Enter Workspace</span>
                    <ArrowRight className="w-4 h-4 text-cyan-300 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-blue-950/80 bg-[#0a1128]/80 px-6 py-4 text-center text-xs text-slate-400 z-10">
        <p className="font-medium">
          © {new Date().getFullYear()} {SCHOOL_INFO.name}. All Academic & Administrative Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
