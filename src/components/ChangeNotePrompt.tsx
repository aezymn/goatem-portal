"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Edit3, Sparkles } from "lucide-react";

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
  const [editing, setEditing] = useState(!existing);
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
      setError("Couldn't save that note.");
      return;
    }
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What did you change for this bug?
          </h2>
        </div>
        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          Used to generate Change Log patch notes
        </span>
      </div>

      <p className="-mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        One line while it&apos;s fresh. QA leadership pulls these into public release notes when updates ship.
      </p>

      {/* If the user already has a saved note and is not in edit mode */}
      {existing && !editing && (
        <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-white/90 p-3 shadow-xs dark:border-indigo-900/40 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-300">
                You
              </span>
              <span>Your recorded fix note:</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Saved
              </span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Edit3 className="h-3 w-3" />
                Edit
              </button>
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {existing}
          </p>
        </div>
      )}

      {/* Editing Form */}
      {editing && (
        <form onSubmit={save} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="e.g. Fixed collision mesh on spawn barriers and prevented player phasing."
              className="min-h-[2.5rem] min-w-0 flex-1 resize-y rounded-md border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            {existing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBody(existing);
                  setEditing(false);
                }}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? "Saving…" : existing ? "Update fix note" : "Save fix note"}
            </button>
          </div>
        </form>
      )}

      {/* Other Teammates' notes */}
      {otherNotes.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Other notes on this bug:
          </span>
          <ul className="flex flex-col gap-1.5 rounded-lg border border-zinc-200/60 bg-white/70 p-2.5 text-xs dark:border-zinc-800/60 dark:bg-zinc-900/50">
            {otherNotes.map((n, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="shrink-0 font-semibold text-zinc-800 dark:text-zinc-200">
                  {n.author}:
                </span>
                <span className="min-w-0 text-zinc-600 dark:text-zinc-400">
                  {n.body}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saved && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          ✓ Fix note saved successfully! It will be available when composing patch notes.
        </p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
