"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL, type PostStatus } from "@/lib/changelogStatus";
import { Plus, X } from "lucide-react";

interface PostRow {
  id: string;
  title: string;
  version: string;
  status: string;
  entryCount: number;
  publishedAt: string | null;
}

interface Candidate {
  id: string;
  title: string;
  noteCount: number;
}

/**
 * Writing and releasing change log posts.
 *
 * A new post starts from the completed bugs nobody has written up yet:
 * tick the ones this release covers and each becomes an entry, pre-filled
 * with what the devs said they changed. Version numbers are offered
 * rather than typed — "new update" and "continuation" show the number
 * each would produce, so the choice is between two concrete answers.
 */
export function ChangelogManager({
  posts,
  versions,
  candidates,
  canApprove,
}: {
  posts: PostRow[];
  versions: { update: string; continuation: string };
  candidates: Candidate[];
  canApprove: boolean;
}) {
  // Nothing has shipped yet, so there's nothing to continue — offering
  // "continuation" here would just show the same number twice.
  const kinds =
    posts.length === 0
      ? (["update"] as const)
      : (["update", "continuation"] as const);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"update" | "continuation">("update");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [customLines, setCustomLines] = useState<string[]>([]);
  const [newLineText, setNewLineText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCustomLine() {
    const trimmed = newLineText.trim();
    if (!trimmed) return;
    setCustomLines((prev) => [...prev, trimmed]);
    setNewLineText("");
  }

  function removeCustomLine(index: number) {
    setCustomLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function call(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, init).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const b = await res?.json().catch(() => null);
      setError(b?.error ?? "That didn't work.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const ok = await call("/api/changelog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        kind,
        body: body.trim() || null,
        reportIds: [...picked],
        customLines: customLines.filter((l) => l.trim().length > 0),
      }),
    });
    if (ok) {
      setTitle("");
      setBody("");
      setPicked(new Set());
      setCustomLines([]);
      setNewLineText("");
    }
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Change log posts
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Drafts, posts waiting on approval, and everything already out.
          </p>
        </div>
        <Link
          href="/changelog"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          View the log
        </Link>
      </div>

      <form
        onSubmit={create}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          New post
        </h2>

        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition ${
                kind === k
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              <span className="text-sm font-medium">
                {k === "update" ? "New update" : "Continuation"}
              </span>
              <span className="font-mono text-xs text-zinc-500">
                v{k === "update" ? versions.update : versions.continuation}
              </span>
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="What to call this release"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={2}
          placeholder="Optional intro, above the list of changes"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Custom changes & notes ({customLines.length})
          </span>

          <div className="flex gap-2">
            <input
              value={newLineText}
              onChange={(e) => setNewLineText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomLine();
                }
              }}
              placeholder="Add a custom note (e.g. New feature, performance boost)..."
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={addCustomLine}
              disabled={!newLineText.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add line
            </button>
          </div>

          {customLines.length > 0 && (
            <ul className="flex flex-col gap-1.5 rounded-md border border-zinc-200 p-2 dark:border-zinc-800 max-h-48 overflow-y-auto">
              {customLines.map((line, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm bg-zinc-50 dark:bg-zinc-900/50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-400 font-bold">•</span>
                    <span className="truncate">{line}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustomLine(idx)}
                    className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Remove note"
                    aria-label="Remove note"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Bugs closed since the last release — {candidates.length}
          </span>
          {candidates.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nothing completed is waiting to be written up.
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={picked.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{c.title}</span>
                      <span className="text-xs text-zinc-400">
                        {c.noteCount > 0
                          ? `${c.noteCount} change note${c.noteCount === 1 ? "" : "s"} — will pre-fill`
                          : "nobody said what they changed"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Creating…" : `Create v${kind === "update" ? versions.update : versions.continuation}`}
        </button>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          All posts
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-500">No posts yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
              >
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold dark:bg-zinc-900">
                  v{post.version}
                </span>
                <Link
                  href={`/changelog/manage/${post.id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {post.title}
                </Link>
                <StatusPill status={post.status} />
                <span className="shrink-0 text-xs text-zinc-400">
                  {post.entryCount}{" "}
                  {post.entryCount === 1 ? "change" : "changes"}
                </span>

                {post.status !== "published" && canApprove && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      call(`/api/changelog/${post.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ status: "published" }),
                      })
                    }
                    className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {post.status === "draft" && !canApprove && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      call(`/api/changelog/${post.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ status: "pending" }),
                      })
                    }
                    className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
                  >
                    Submit for approval
                  </button>
                )}
                {post.status === "published" && canApprove && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      call(`/api/changelog/${post.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ status: "draft" }),
                      })
                    }
                    className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 dark:border-zinc-700"
                  >
                    Unpublish
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = status as PostStatus;
  const tones: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
    pending:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    published:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        tones[s] ?? tones.draft
      }`}
    >
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}
