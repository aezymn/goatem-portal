"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 5000;

/**
 * Keeps an open report in step with everyone else's without a refresh.
 *
 * Polls a tiny version endpoint rather than opening a socket: this runs
 * on Vercel's serverless functions, where a long-lived connection per
 * open tab is the expensive thing and a five-second poll of one row is
 * not. When the token differs from the one this render was built with,
 * router.refresh() re-renders the server components in place — no full
 * reload, and anything half-typed in the composer survives it.
 *
 * There's deliberately nothing to remember between polls: `version` is
 * whatever the page currently shows, so comparing against it is the same
 * question as "is what I'm looking at out of date". Once the refresh
 * lands, a new version arrives as a prop and the comparison settles.
 *
 * Polling pauses while the tab is hidden, so a wall of forgotten tabs
 * costs nothing, and fires once immediately on becoming visible again.
 */
export function useLiveReport(reportId: string, version: string) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/reports/${reportId}/version`, {
          cache: "no-store",
        });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as { version?: string };
        if (next.version && next.version !== version) router.refresh();
      } catch {
        // A dropped poll costs at most one interval of staleness, and
        // there's nothing useful to tell anyone about it.
      }
    }

    const timer = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reportId, version, router]);
}
