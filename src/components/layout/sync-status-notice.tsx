"use client";

import React from "react";
import { CheckCircle2, CloudOff, X } from "lucide-react";
import { dismissSyncNotice, getSyncSnapshot, subscribeToSync } from "@/lib/sync-status";

const SUCCESS_VISIBLE_MS = 5000;

export function SyncStatusNotice() {
  const snapshot = React.useSyncExternalStore(subscribeToSync, getSyncSnapshot, getSyncSnapshot);
  const [hiddenSince, setHiddenSince] = React.useState(0);

  React.useEffect(() => {
    if (snapshot.state !== "saved") return;
    const timer = setTimeout(() => setHiddenSince(snapshot.at), SUCCESS_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [snapshot.state, snapshot.at]);

  if (snapshot.state === "idle") return null;
  if (snapshot.state === "saved" && hiddenSince === snapshot.at) return null;

  const failed = snapshot.state === "failed";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md ${
        failed ? "border-accent-200 bg-accent-50/96 text-accent-900" : "border-emerald-200 bg-emerald-50/96 text-emerald-900"
      }`}
    >
      <div className="flex items-start gap-3">
        {failed ? <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">{failed ? "Not saved to the server" : "Saved"}</p>
          <p className="text-xs font-semibold leading-relaxed break-words">{snapshot.message}</p>
        </div>
        {failed && (
          <button
            type="button"
            aria-label="Dismiss this warning"
            onClick={dismissSyncNotice}
            className="-mr-1 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-accent-600 transition-colors hover:bg-accent-100 hover:text-accent-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
