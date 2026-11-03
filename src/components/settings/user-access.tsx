"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

interface Account {
  id: string;
  username: string;
  display_name: string;
  role: string;
  staff_id: string;
  email: string;
  status: string;
  created_by: string;
  created_at: string;
  last_login_at: string | null;
  password?: string; // present only right after create or reset
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  EXAM_OFFICER: "Exam Officer",
  TEACHER: "Teacher",
  ACCOUNTANT: "Bursar / Accountant",
  STUDENT_PARENT: "Student / Parent",
  TESTERS: "QA Tester",
};

const ROLE_ORDER = ["TEACHER", "EXAM_OFFICER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS", "SUPER_ADMIN"];

export function UserAccess() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [freshCredentials, setFreshCredentials] = useState<Account | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (response.status === 401) {
        setLoadError("Only the super admin can manage portal logins.");
        setLoaded(true);
        return;
      }
      const payload = await response.json();
      if (!response.ok) {
        setLoadError(payload?.error || "Could not load accounts.");
      } else {
        setAccounts(payload.data ?? []);
        setLoadError(null);
      }
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearForm = () => {
    setFullName("");
    setUsername("");
    setStaffId("");
    setEmail("");
  };

  const createAccount = async () => {
    setActionError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: fullName,
          username: username || undefined,
          role,
          staffId: staffId || undefined,
          email: email || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload?.error || "Failed to create the account.");
        return;
      }
      setFreshCredentials(payload.data);
      clearForm();
      setCopied(false);
      await load();
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setActionError(null);
    setBusyId(id);
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload?.error || "That change did not save.");
        return;
      }
      if (payload.data?.password) setFreshCredentials(payload.data);
      await load();
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionError(payload?.error || "Failed to delete the account.");
        return;
      }
      if (freshCredentials?.id === id) setFreshCredentials(null);
      await load();
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  const copyCredentials = async () => {
    if (!freshCredentials) return;
    const text = `Portal: ${location.origin}/login\nUsername: ${freshCredentials.username}\nPassword: ${freshCredentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setActionError("Copy failed — select the password and copy it manually.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-5xl">
      <div className="p-5 border-b border-slate-100 flex items-center gap-2.5 flex-wrap">
        <div className="bg-blue-50 p-2 rounded-xl border border-blue-200">
          <KeyRound className="w-4 h-4 text-[#0000FF]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">User Access</h2>
          <p className="text-xs text-slate-500">
            Create logins for staff and students here instead of editing server variables. Passwords are generated
            automatically and shown only once. Suspending an account signs it out of the portal immediately.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {loadError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs font-bold">
            {loadError}
          </div>
        )}
        {actionError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-bold">
            {actionError}
          </div>
        )}

        {freshCredentials?.password && (
          <div className="bg-[#0a1128] text-white rounded-xl p-4 border border-cyan-400/60 space-y-2">
            <p className="text-xs font-black text-cyan-300 uppercase tracking-wider">
              New credentials — copy now, this password will not be shown again
            </p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <span className="text-slate-400">username:</span>
              <span className="font-bold">{freshCredentials.username}</span>
              <span className="text-slate-400 ml-3">password:</span>
              <span className="font-bold text-cyan-300">{freshCredentials.password}</span>
              <button
                onClick={copyCredentials}
                className="ml-auto flex items-center gap-1.5 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/50 text-cyan-200 rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name (e.g. Mrs. Grace Adams)"
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF]"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (optional — auto-generated)"
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF] min-w-0 max-w-full"
          >
            {ROLE_ORDER.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="Staff / admission ID"
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF] min-w-0"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF] min-w-0"
            />
          </div>
        </div>

        <button
          onClick={createAccount}
          disabled={creating || !fullName.trim()}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#0000FF] hover:bg-blue-600 text-white text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          {creating ? "Creating..." : "Create Login"}
        </button>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            App-managed accounts ({accounts.length})
          </div>
          {!loaded ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : accounts.length === 0 ? (
            <p className="text-xs text-slate-400">
              No accounts yet. Anyone created here signs in on the same login page as the server accounts.
            </p>
          ) : (
            accounts.map((account) => {
              const suspended = account.status !== "Active";
              return (
                <div
                  key={account.id}
                  className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 bg-slate-50/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {account.display_name || account.username}
                      <span
                        className={
                          suspended
                            ? "ml-2 text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded"
                            : "ml-2 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded"
                        }
                      >
                        {suspended ? "Suspended" : "Active"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      {account.username} · {ROLE_LABELS[account.role] ?? account.role}
                      {account.last_login_at
                        ? ` · last login ${new Date(account.last_login_at).toLocaleDateString()}`
                        : " · never logged in"}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => patch(account.id, { resetPassword: true })}
                      disabled={busyId === account.id}
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:border-[#0000FF] hover:text-[#0000FF] rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      New Password
                    </button>
                    <button
                      onClick={() => patch(account.id, { status: suspended ? "Active" : "Suspended" })}
                      disabled={busyId === account.id}
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:border-amber-400 hover:text-amber-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {suspended ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      {suspended ? "Restore" : "Suspend"}
                    </button>
                    <button
                      onClick={() => remove(account.id)}
                      disabled={busyId === account.id}
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
