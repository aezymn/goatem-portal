"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GrantableTier = "STAFF" | "ADMIN";

export function GrantToggle({
  memberId,
  grantedTier,
  eligibleTier,
}: {
  memberId: string;
  grantedTier: GrantableTier | null;
  eligibleTier: GrantableTier | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A rank with no configured eligibility can't grant anything — the
  // toggle is disabled rather than hidden, so it's obvious this person
  // simply isn't eligible yet rather than looking like a missing feature.
  if (!eligibleTier) {
    return (
      <span
        className="text-xs text-zinc-400"
        title="Set this rank's eligibility on the Permissions page first."
      >
        Not eligible
      </span>
    );
  }

  const granted = grantedTier === eligibleTier;

  async function onToggle() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/roster/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grantedTier: granted ? null : eligibleTier }),
    });

    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't update access.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={granted}
          disabled={busy}
          onChange={onToggle}
          className="h-4 w-4"
        />
        {granted ? `${eligibleTier} access` : "Grant access"}
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
