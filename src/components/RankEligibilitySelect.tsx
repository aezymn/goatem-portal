"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GrantableTier = "STAFF" | "ADMIN";

export function RankEligibilitySelect({
  rank,
  eligibleTier,
}: {
  rank: string;
  eligibleTier: GrantableTier | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(value: string) {
    const eligibleTier = value === "NONE" ? null : (value as GrantableTier);
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/rank-permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank, eligibleTier }),
    });

    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't update that rank.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        defaultValue={eligibleTier ?? "NONE"}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="NONE">Not eligible</option>
        <option value="STAFF">Staff</option>
        <option value="ADMIN">Admin</option>
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
