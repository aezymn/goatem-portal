"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagChip } from "@/components/TagChip";
import { TAG_TONES, type TagTone } from "@/lib/tagTones";

interface Entry {
  id: string;
  name: string;
  tone?: string;
  reportCount: number;
}

/**
 * Managing the two curated lists. Both are the same shape of thing, so
 * they're the same component with a `kind` — the only real difference is
 * that a tag also carries a colour.
 */
export function BugTaxonomyBoard({
  kind,
  entries,
}: {
  kind: "categories" | "tags";
  entries: Entry[];
}) {
  const router = useRouter();
  const singular = kind === "categories" ? "category" : "tag";

  const [name, setName] = useState("");
  const [tone, setTone] = useState<TagTone>("zinc");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  async function call(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, init).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "That didn't work.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await call(`/api/admin/bug-taxonomy/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        kind === "tags" ? { name: name.trim(), tone } : { name: name.trim() }
      ),
    });
    if (ok) setName("");
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold uppercase tracking-wider">
        {kind === "categories" ? "Categories" : "Tags"}
      </h2>
      <p className="-mt-2 text-sm text-zinc-500">
        {kind === "categories"
          ? "Which release or phase a bug belongs to. A report has one."
          : "State and priority. A report can carry as many as it needs."}
      </p>

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {entries.length === 0 && (
          <li className="py-3 text-sm text-zinc-500">Nothing here yet.</li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
            {editing === entry.id ? (
              <>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  disabled={busy}
                  onClick={async () => {
                    const ok = await call(
                      `/api/admin/bug-taxonomy/${kind}/${entry.id}`,
                      {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ name: draftName.trim() }),
                      }
                    );
                    if (ok) setEditing(null);
                  }}
                  className="rounded-md bg-indigo-600 px-2.5 py-1 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm dark:border-zinc-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {kind === "tags" ? (
                  <TagChip tag={{ name: entry.name, tone: entry.tone ?? "zinc" }} />
                ) : (
                  <span className="text-sm font-medium">{entry.name}</span>
                )}

                <span className="text-xs text-zinc-400">
                  {entry.reportCount}{" "}
                  {entry.reportCount === 1 ? "report" : "reports"}
                </span>

                {kind === "tags" && (
                  <select
                    value={entry.tone ?? "zinc"}
                    disabled={busy}
                    onChange={(e) =>
                      call(`/api/admin/bug-taxonomy/tags/${entry.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ tone: e.target.value }),
                      })
                    }
                    className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {TAG_TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}

                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditing(entry.id);
                      setDraftName(entry.name);
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    Rename
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const consequence =
                        kind === "categories"
                          ? `${entry.reportCount} report(s) will become uncategorised.`
                          : `It'll be removed from ${entry.reportCount} report(s).`;
                      if (
                        !confirm(`Delete “${entry.name}”?\n\n${consequence}`)
                      )
                        return;
                      void call(
                        `/api/admin/bug-taxonomy/${kind}/${entry.id}`,
                        { method: "DELETE" }
                      );
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            kind === "categories" ? "Update v1.02" : "Needs repro"
          }
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {kind === "tags" && (
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as TagTone)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {TAG_TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Add {singular}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
