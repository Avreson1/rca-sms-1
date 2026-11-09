"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// The idle window and the heartbeat live here as well as on the server so the
// browser can return a person to the sign-in door the moment five minutes pass
// without an action, rather than waiting for them to click something that the
// proxy would then refuse.
const IDLE_MS = 5 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Mounted once in the root layout. It watches the signed-in session, slides the
 * server's idle window forward while the person is active, and sends the browser
 * to /login?reason=idle when the window lapses. The cookie is browser-session
 * only, so closing the browser ends the session regardless of this timer.
 */
export function IdleGuard() {
  const pathname = usePathname();
  const signedIn = useRef(false);
  const lastTouch = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waking = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };

    const signOut = () => {
      stop();
      signedIn.current = false;
      // A full document load, not a soft navigation: it wipes every in-memory
      // store and localStorage claim so no stale signed-in state survives the
      // timeout. The absolute URL keeps this a hard load of an internal page.
      window.location.assign(new URL("/login?reason=idle", window.location.origin).href);
    };

    // null means the network failed: never punish an offline machine.
    const alive = async (): Promise<boolean | null> => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        return Boolean(data?.success && data?.user);
      } catch {
        return null;
      }
    };

    const arm = () => {
      stop();
      timer.current = setTimeout(async () => {
        if (cancelled) return;
        const state = await alive();
        if (cancelled) return;
        // Another tab may have kept the session warm; only sign out when the
        // server agrees it is gone. Otherwise keep waiting.
        if (state === false) signOut();
        else arm();
      }, IDLE_MS);
    };

    const touch = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastTouch.current < TOUCH_EVERY_MS) return;
      lastTouch.current = now;
      try {
        const res = await fetch("/api/auth/touch", { method: "POST", cache: "no-store" });
        if (res.status === 401 && !cancelled && signedIn.current) signOut();
      } catch {
        // Offline: the idle check and the proxy catch up when the network does.
      }
    };

    const onActivity = () => {
      if (cancelled || !signedIn.current) return;
      arm();
      void touch();
    };

    const onWake = () => {
      if (cancelled || !signedIn.current || waking.current) return;
      if (document.visibilityState !== "visible") return;
      waking.current = true;
      void (async () => {
        const state = await alive();
        waking.current = false;
        if (cancelled) return;
        if (state === false) signOut();
        else if (state === true) {
          arm();
          void touch(true);
        }
      })();
    };

    const detach = () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };

    // Re-runs on navigation because the root layout persists across routes: a
    // guard that mounted on the public sign-in page must wake up once login
    // lands the person inside the portal.
    void (async () => {
      const state = await alive();
      if (cancelled) return;
      if (state !== true) {
        signedIn.current = false;
        stop();
        return;
      }
      signedIn.current = true;
      arm();
      void touch();
      for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
      window.addEventListener("focus", onWake);
      document.addEventListener("visibilitychange", onWake);
    })();

    return () => {
      cancelled = true;
      stop();
      detach();
    };
  }, [pathname]);

  return null;
}