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
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Users Online</h3>
            <p className="text-[11px] text-slate-500">Live active portal presence</p>
          </div>
        </div>

        <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-500" />
          {onlineCount} Online
        </span>
      </div>

      <div className="mt-3 flex-1 divide-y divide-slate-100 overflow-y-auto">
        {users.map((user) => (
          <div key={user.id} className="py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                user.isSelf ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">
                  {user.isSelf ? `${user.name} (You)` : user.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{user.role}</p>
              </div>
            </div>

            <div className="text-right flex-shrink-0 pl-2">
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                {user.status}
              </span>
              {user.staffId && (
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{user.staffId}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 mt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
        <span>{syncFailed ? "Presence not recorded — the server refused" : "Auto-synced via Realtime API"}</span>
        <span className="text-slate-500 font-mono text-[9px]">Last Sync: {lastSyncTime}</span>
      </div>
    </div>
  );
}
