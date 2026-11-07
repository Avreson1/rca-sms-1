"use client";

import React, { useState, useEffect } from "react";
import { Radio } from "lucide-react";

interface OnlineUser {
  id: string;
  name: string;
  role: string;
  staffId?: string;
  isSelf?: boolean;
  status: "Active now" | "Idle (2m)" | "Active (5m)";
}

export function UsersOnlineWidget() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Connecting...");
  const [syncFailed, setSyncFailed] = useState(false);

  const syncPresence = async () => {
    try {
      // Nothing about who is sending the heartbeat: the server reads that from
      // the signed session cookie, so a browser cannot claim another identity.
      const heartbeat = await fetch("/api/presence", { method: "POST" });
      const res = await fetch("/api/presence");
      if (!heartbeat.ok || !res.ok) {
        setUsers([]);
        setOnlineCount(0);
        setLastSyncTime("Not recorded");
        setSyncFailed(true);
        return;
      }

      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
        setOnlineCount(data.onlineCount);
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncFailed(false);
      }
    } catch (err) {
      console.error("Presence sync failed:", err);
      setUsers([]);
      setOnlineCount(0);
      setLastSyncTime("Not recorded");
      setSyncFailed(true);
    }
  };

  useEffect(() => {
    syncPresence();
    const interval = setInterval(syncPresence, 5000); // 5s real-time heartbeat
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="flex flex-col rounded-2xl border border-hairline bg-surface p-5 shadow-2xs lg:min-h-0 lg:flex-1">
      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-70 motion-safe:animate-ping ${
                syncFailed ? "bg-accent-500" : "bg-emerald-500"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                syncFailed ? "bg-accent-600" : "bg-emerald-600"
              }`}
            />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[13px] font-bold tracking-tight text-ink">Users Online</h3>
            <p className="text-[11px] leading-relaxed text-muted">Live active portal presence</p>
          </div>
        </div>

        <span
          className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums ${
            syncFailed
              ? "border-accent-100 bg-accent-50 text-accent-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          <Radio className="h-3 w-3" strokeWidth={2} />
          {onlineCount} Online
        </span>
      </div>

      <div className="mt-3 flex-1 divide-y divide-hairline overflow-y-auto">
        {users.length === 0 && (
          <p className="py-4 text-[12px] leading-relaxed text-muted">
            {syncFailed
              ? "Presence could not be recorded, so this list is empty rather than guessed."
              : "No one is recorded on the portal right now. Your own heartbeat is filed every five seconds."}
          </p>
        )}
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-inset ${
                user.isSelf
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-brand-50 text-brand-700 ring-brand-100"
              }`}>
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[12px] font-bold tracking-tight text-ink">
                  {user.isSelf ? `${user.name} (You)` : user.name}
                </p>
                <p className="truncate text-[10px] text-muted">{user.role}</p>
              </div>
            </div>

            <div className="flex-shrink-0 pl-2 text-right">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                user.status === "Active now" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}>
                {user.status}
              </span>
              {user.staffId && (
                <p className="mt-0.5 font-mono text-[9px] tabular-nums text-slate-400">{user.staffId}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-hairline pt-3 text-[10px]">
        <span className={syncFailed ? "font-semibold text-accent-700" : "text-muted"}>
          {syncFailed ? "Presence not recorded — the server refused" : "Auto-synced via Realtime API"}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-slate-400">Last Sync: {lastSyncTime}</span>
      </div>
    </section>
  );
}
