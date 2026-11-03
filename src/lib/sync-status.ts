"use client";

export type SyncState = "idle" | "saved" | "failed";

export interface SyncSnapshot {
  state: SyncState;
  message: string;
  /** Changes on every report so listeners re-render even for identical text. */
  at: number;
}

const IDLE: SyncSnapshot = { state: "idle", message: "", at: 0 };

let snapshot = IDLE;
const listeners = new Set<() => void>();

function emit(next: SyncSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeToSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}

export function reportSyncSaved(message: string) {
  if (snapshot.state !== "failed") emit({ state: "saved", message, at: Date.now() });
}

/**
 * Failures outrank successes and stay on screen until dismissed: a school
 * record that did not reach the database must not look like one that did.
 */
export function reportSyncFailure(message: string) {
  emit({ state: "failed", message, at: Date.now() });
}

export function dismissSyncNotice() {
  emit(IDLE);
}
