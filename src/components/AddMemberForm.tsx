"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddMemberForm() {
  const router = useRouter();
  const [robloxUsername, setRobloxUsername] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [rank, setRank] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        robloxUsername,
        discordId: discordId.trim() || null,
        rank,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that member.");
      return;
    }

    setRobloxUsername("");
    setDiscordId("");
    setRank("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Roblox Username
        <input
          required
          value={robloxUsername}
          onChange={(e) => setRobloxUsername(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Rank
        <input
          required
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Discord ID (optional)
        <input
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          placeholder="18-19 digit ID"
          className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
