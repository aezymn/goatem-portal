"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Shown to a signed-in person so they can claim their own Roblox account,
 * and register alt/testing accounts against themselves. Everyone lands on
 * the roster from Discord without a Roblox username, so this is how that
 * gap gets filled — by the person themselves, not by an admin guessing.
 */
export function LinkRobloxPanel({
  linkedUsername,
  alts,
}: {
  linkedUsername: string | null;
  alts: { id: string; robloxUsername: string | null }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isLinking = !linkedUsername;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const res = await fetch(isLinking ? "/api/me/link" : "/api/me/alts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ robloxUsername: value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const access = data.member?.hasGameAccess;
    setNotice(
      access === true
        ? "Linked — that account is in the Roblox group."
        : access === false
          ? "Linked — but that account isn't in the Roblox group, so it won't have game access."
          : "Linked. Group membership couldn't be checked right now."
    );
    setValue("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">
        {isLinking ? "Link your Roblox account" : "Your Roblox accounts"}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {isLinking
          ? "Enter your Roblox username so the roster can show whether you have access to the game."
          : "Add alternate accounts you test with — each one is checked for group membership separately."}
      </p>

      {!isLinking && (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">
            {linkedUsername} <span className="text-xs text-zinc-500">main</span>
          </li>
          {alts.map((a) => (
            <li
              key={a.id}
              className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"
            >
              {a.robloxUsername} <span className="text-xs text-zinc-500">alt</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {isLinking ? "Roblox username" : "Add an alt account"}
          <input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="exact username"
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Checking…" : isLinking ? "Link account" : "Add alt"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{notice}</p>
      )}
    </div>
  );
}
