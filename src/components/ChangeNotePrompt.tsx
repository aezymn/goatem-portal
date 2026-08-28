"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Asked of whoever worked a bug, once it's closed: what did you actually
 * change?
 *
 * It sits on a locked report on purpose. Locking ends the conversation,
 * but this is the one thing still wanted afterwards, and it's what the
 * change log gets written from — collected while people still remember,
 * rather than reconstructed from a thread weeks later.
 */
export function ChangeNotePrompt({
  reportId,
  existing,
  otherNotes,
}: {
  reportId: string;
  existing: string | null;
  otherNotes: { author: string; body: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState(existing ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${reportId}/change-note`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't save that.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 dark:border-indigo-900 dark:bg-indigo-950/20">
      <h2 className="text-sm font-semibold">
        What did you change for this?
      </h2>
      <p className="-mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        One line while it&apos;s fresh. This is what the change log gets
        written from — you can edit it any time.
      </p>

      {otherNotes.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md bg-white/70 p-2 text-xs dark:bg-black/30">
          {otherNotes.map((n, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="shrink-0 font-medium">{n.author}</span>
              <span className="min-w-0 text-zinc-600 dark:text-zinc-400">
                {n.body}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={save} className="flex flex-wrap gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          maxLength={2000}
          placeholder="e.g. Reduced Force Push knockback from 120 to 45."
          className="min-h-[2.25rem] min-w-0 flex-1 resize-y rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : existing ? "Update" : "Save"}
        </button>
        {saved && (
          <span className="self-center text-sm text-emerald-600 dark:text-emerald-400">
            Saved
          </span>
        )}
      </form>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
