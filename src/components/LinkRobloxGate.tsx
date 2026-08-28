"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

/**
 * Shown when the database says this account IS linked but the token claim
 * that routed them here still says otherwise — linked on another device,
 * or the claim simply hasn't caught up.
 *
 * It refreshes the token and then navigates, rather than the server
 * redirecting: a redirect would bounce straight off the stale claim in
 * the proxy and come back here forever.
 */
export function AlreadyLinked() {
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await update();
      if (!cancelled) {
        router.replace("/reports");
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once: this is a one-shot handoff, not something to re-run when
    // the session object identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <p className="pt-10 text-center text-sm text-zinc-500">
      You&apos;re already linked — taking you through…
    </p>
  );
}

/**
 * First sign-in: the Roblox username, before anything else.
 *
 * Deliberately a gate rather than a dismissible prompt — group access,
 * alt accounts and testing logs are all keyed to who someone is in-game,
 * so an unlinked account can't do anything useful anyway. There's no
 * skip, and the proxy sends them back here if they navigate away.
 */
export function LinkRobloxGate({ onRoster }: { onRoster: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/me/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ robloxUsername: username.trim() }),
    }).catch(() => null);

    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "Couldn't link that username. Try again.");
      setBusy(false);
      return;
    }

    // Refresh the token's `linked` claim before navigating, or the proxy
    // bounces them straight back here on the next request.
    await update();
    router.replace("/reports");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          One thing first
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          What&apos;s your Roblox username? Everything here is tied to your
          in-game account — group access, the alt accounts you test with,
          the sessions you log — so the portal needs it before you go on.
        </p>
      </div>

      {!onRoster && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          You&apos;re signed in but not on the roster yet. Ask an admin to
          add you, or to bind your Discord role on the Ranks page.
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Roblox username
          <input
            autoFocus
            required
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            placeholder="exact username, not display name"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !username.trim() || !onRoster}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Link my account"}
        </button>

        <p className="text-xs text-zinc-500">
          It&apos;s checked against Roblox, so it has to be the exact
          username. You can add alt accounts later from the roster page.
        </p>
      </form>
    </div>
  );
}
