"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { HEARTBEAT_MS, IDLE_AFTER_MS } from "@/lib/presence";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "scroll",
  "mousemove",
  "touchstart",
] as const;

/**
 * Tells the server this person is here, about once a minute, and whether
 * they've touched anything lately.
 *
 * Renders nothing and holds no state — just a ref and an interval — so it
 * can sit in the root layout on every page without causing a single
 * re-render of the tree beneath it.
 *
 * It only checks in while the tab is actually visible. A backgrounded tab
 * isn't someone sitting at the portal, so letting them lapse to "active
 * 10m ago" is the honest answer, not "away".
 */
export function PresenceBeacon() {
  const { status } = useSession();
  const pathname = usePathname();
  // Starts at 0 rather than the clock: reading Date.now() during render
  // is impure, and the effect below sets a real value before anything
  // reads it.
  const lastInteraction = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Arriving on a page is itself activity — Tom's definition counts
    // page swapping, not just mouse and keyboard.
    lastInteraction.current = Date.now();

    const touch = () => {
      lastInteraction.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true });
    }

    const send = () => {
      if (document.visibilityState !== "visible") return;
      const idle = Date.now() - lastInteraction.current >= IDLE_AFTER_MS;
      // Failures are ignored on purpose: a missed heartbeat costs at most
      // one minute of precision on a status pill, and there is nothing
      // useful to tell the person about it.
      void fetch("/api/me/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idle }),
        keepalive: true,
      }).catch(() => {});
    };

    send();
    const timer = setInterval(send, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastInteraction.current = Date.now();
        send();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch);
      }
    };
  }, [status, pathname]);

  return null;
}
