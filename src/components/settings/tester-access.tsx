"use client";

import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, Copy, Check, Trash2, RefreshCw, KeyRound, Users } from "lucide-react";

interface TesterAccount {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_by: string;
  created_at: string;
  last_login_at: string | null;
  password?: string; // present only right after create/regenerate
}

export function TesterAccess() {
  const [accounts, setAccounts] = useState<TesterAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [freshCredentials, setFreshCredentials] = useState<TesterAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/testers", { cache: "no-store" });
      if (response.status === 401) {
        setLoadError("Only the super admin can manage tester accounts.");
        setLoaded(true);
        return;
      }
      const payload = await response.json();
      if (!response.ok) {
        setLoadError(payload?.error || "Could not load tester accounts.");
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

  const createAccount = async () => {
    setActionError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/testers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username: username || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload?.error || "Failed to create the account.");
        return;
      }
      setFreshCredentials(payload.data);
      setDisplayName("");
      setUsername("");
      setCopied(false);
      await load();
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  };

  const regenerate = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      const response = await fetch(`/api/testers/${id}`, { method: "PATCH" });
      const payload = await response.json();
      if (!response.ok) {
        setActionError(payload?.error || "Failed to regenerate the password.");
        return;
      }
      setFreshCredentials(payload.data);
      setCopied(false);
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (id: string) => {
    setActionError(null);
    setBusyId(id);
    try {
      const response = await fetch(`/api/testers/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        setActionError(payload?.error || "Failed to revoke the account.");
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
      <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="bg-blue-50 p-2 rounded-xl border border-blue-200">
          <KeyRound className="w-4 h-4 text-[#0000FF]" />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight">Tester Access</h2>
          <p className="text-xs text-slate-500">
            Create QA logins with the TESTERS role. Passwords are generated automatically and shown only once.
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

        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tester's name (e.g. Mr. John Doe QA)"
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF]"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (optional — auto-generated)"
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[#0000FF]"
          />
          <button
            onClick={createAccount}
            disabled={creating || !displayName.trim()}
            className="px-5 py-2.5 bg-[#0000FF] hover:bg-blue-600 text-white text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {creating ? "Creating..." : "Generate Login"}
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            Active tester accounts ({accounts.length})
          </div>
          {!loaded ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : accounts.length === 0 ? (
            <p className="text-xs text-slate-400">No tester accounts yet.</p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 bg-slate-50/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{account.display_name || account.username}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    {account.username}
                    {account.last_login_at
                      ? ` · last login ${new Date(account.last_login_at).toLocaleDateString()}`
                      : " · never logged in"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => regenerate(account.id)}
                    disabled={busyId === account.id}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 hover:border-[#0000FF] hover:text-[#0000FF] rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    New Password
                  </button>
                  <button
                    onClick={() => revoke(account.id)}
                    disabled={busyId === account.id}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
