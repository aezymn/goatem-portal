"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/components/ConfirmAction";
import { X, RefreshCw, Unlink } from "lucide-react";

/**
 * Shown to a signed-in person so they can claim their own Roblox account,
 * change their username, unlink, and register/remove alt testing accounts.
 */
export function LinkRobloxPanel({
  linkedUsername,
  alts,
  verificationCode,
}: {
  linkedUsername: string | null;
  alts: { id: string; robloxUsername: string | null }[];
  verificationCode: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isChangingMain, setIsChangingMain] = useState(false);

  const isLinking = !linkedUsername || isChangingMain;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const endpoint = isLinking ? "/api/me/link" : "/api/me/alts";
    const res = await fetch(endpoint, {
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
        ? `${isChangingMain ? "Username updated" : "Linked"} — account is in the Roblox group.`
        : access === false
          ? `${isChangingMain ? "Username updated" : "Linked"} — but account is not in the Roblox group.`
          : `${isChangingMain ? "Username updated" : "Linked"}. Group membership couldn't be checked right now.`
    );
    setValue("");
    setIsChangingMain(false);
    router.refresh();
  }

  async function removeAlt(altId: string, username: string | null) {
    setBusy(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/me/alts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to remove alt account.");
      return;
    }

    setNotice(`Removed alt account ${username ?? ""}.`);
    router.refresh();
  }

  async function unlinkAccount() {
    setBusy(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/me/link", {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to unlink account.");
      return;
    }

    setNotice("Unlinked your Roblox account.");
    setIsChangingMain(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">
        {!linkedUsername
          ? "Link your Roblox account"
          : isChangingMain
            ? "Change your Roblox username"
            : "Your Roblox accounts"}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {!linkedUsername
          ? "Enter your Roblox username so the roster can show whether you have access to the game."
          : isChangingMain
            ? "Enter your new Roblox username. Make sure to update your profile About with the verification code."
            : "Manage your linked account and alternate accounts you test with."}
      </p>

      <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
        <p className="font-medium mb-1">Verification Required</p>
        <p className="text-xs">
          To prove account ownership, please paste the following code into your Roblox profile&apos;s <strong>About</strong> section before linking or changing:
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="rounded bg-white px-2 py-1 font-mono text-sm shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
            {verificationCode}
          </code>
        </div>
      </div>

      {linkedUsername && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium dark:bg-zinc-900">
              <span>{linkedUsername}</span>
              <span className="text-xs text-zinc-500">(main)</span>
            </span>

            <button
              type="button"
              onClick={() => {
                setIsChangingMain((prev) => !prev);
                setValue("");
                setError(null);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="h-3 w-3" />
              {isChangingMain ? "Cancel change" : "Change username"}
            </button>

            <ConfirmAction
              title="Unlink Roblox account?"
              description={`Are you sure you want to unlink ${linkedUsername}? You can re-link at any time.`}
              onConfirm={unlinkAccount}
            >
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                <Unlink className="h-3 w-3" />
                Unlink
              </button>
            </ConfirmAction>
          </div>

          {alts.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Alt accounts ({alts.length})
              </span>
              <ul className="mt-1.5 flex flex-wrap gap-2 text-sm">
                {alts.map((a) => (
                  <li
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 pl-3 pr-1.5 py-1 dark:bg-zinc-900"
                  >
                    <span>{a.robloxUsername}</span>
                    <span className="text-xs text-zinc-500">alt</span>
                    <ConfirmAction
                      title="Remove alt account?"
                      description={`Remove ${a.robloxUsername ?? "this alt"} from your account and roster?`}
                      onConfirm={() => removeAlt(a.id, a.robloxUsername)}
                    >
                      <button
                        type="button"
                        disabled={busy}
                        title={`Remove ${a.robloxUsername}`}
                        aria-label={`Remove ${a.robloxUsername}`}
                        className="rounded-full p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </ConfirmAction>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {!linkedUsername
            ? "Roblox username"
            : isChangingMain
              ? "New Roblox username"
              : "Add an alt account"}
          <input
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="exact username"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy
            ? "Checking…"
            : !linkedUsername
              ? "Link account"
              : isChangingMain
                ? "Update username"
                : "Add alt"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{notice}</p>
      )}
    </div>
  );
}
