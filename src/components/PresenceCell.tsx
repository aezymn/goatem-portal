"use client";

import { useSyncExternalStore } from "react";
import { Capsule, type CapsuleTone } from "@/components/RosterStatusCell";
import { presenceFor, type PresenceInput } from "@/lib/presence";

const TICK_MS = 30_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

/**
 * A clock that re-renders on its own, so a roster left open on a second
 * monitor doesn't keep insisting everyone is still online.
 *
 * useSyncExternalStore rather than an effect: React uses the server
 * snapshot both when rendering on the server AND while hydrating, so the
 * server's clock and the browser's can disagree without producing a
 * hydration mismatch. Snapping to 30-second buckets keeps getSnapshot
 * returning a stable value between ticks, which the store contract
 * requires.
 */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => serverNow
  );
}

const TONES: Record<string, CapsuleTone> = {
  online: "positive",
  away: "warning",
  offline: "muted",
  never: "muted",
};

export function PresenceCell({
  member,
  now,
}: {
  member: PresenceInput;
  now: number;
}) {
  const presence = presenceFor(member, now);
  return (
    <Capsule
      tone={TONES[presence.state] ?? "muted"}
      dot={presence.state === "online" || presence.state === "away"}
      title={presence.title}
    >
      {presence.label}
    </Capsule>
  );
}
