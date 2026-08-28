"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/ChangelogManager";

interface Entry {
  id: string;
  text: string;
  bugReportId: string | null;
  reportTitle: string | null;
}

/**
 * Editing one post: its version, title, intro and the list of changes.
 *
 * Everything stays editable after publishing — a release note that can't
 * be corrected is a release note with a typo in it forever.
 */
export function ChangelogPostEditor({
  post,
  entries,
  candidates,
  canApprove,
}: {
  post: {
    id: string;
    title: string;
    version: string;
    body: string | null;
    status: string;
    publishedAt: string | null;
  };
  entries: Entry[];
  candidates: { id: string; title: string; noteCount: number }[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [version, setVersion] = useState(post.version);
  const [body, setBody] = useState(post.body ?? "");
  const [newEntry, setNewEntry] = useState("");
  const [linkReport, setLinkReport] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(`/api/changelog/${post.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        version: version.trim(),
        body: body.trim() || null,
      }),
    });
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/changelog/manage"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Change log posts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            v{post.version}
          </h1>
          <StatusPill status={post.status} />
          {post.publishedAt && (
            <span className="text-xs text-zinc-400">
              published{" "}
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={saveDetails}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Version
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-28 rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Intro
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Optional, appears above the list of changes"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Saved
            </span>
          )}
        </div>
      </form>

      <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Changes
        </h2>

        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing listed yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                postId={post.id}
                entry={entry}
                busy={busy}
                onCall={call}
              />
            ))}
          </ul>
        )}

        <div className="mt-2 flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Add a change
          </span>
          <div className="flex flex-wrap gap-2">
            <input
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              placeholder="Custom line — type whatever players should read"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              disabled={busy || !newEntry.trim()}
              onClick={async () => {
                const ok = await call(`/api/changelog/${post.id}/entries`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ text: newEntry.trim() }),
                });
                if (ok) setNewEntry("");
              }}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <select
                value={linkReport}
                onChange={(e) => setLinkReport(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">…or pull in a closed bug report</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.noteCount > 0 ? ` (${c.noteCount} note${c.noteCount === 1 ? "" : "s"})` : ""}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !linkReport}
                onClick={async () => {
                  // "@auto" tells the server to fill the line from what
                  // the devs recorded on that report.
                  const ok = await call(`/api/changelog/${post.id}/entries`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      text: "@auto",
                      bugReportId: linkReport,
                    }),
                  });
                  if (ok) setLinkReport("");
                }}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                Pull in
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
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
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
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
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Submit for approval
          </button>
        )}
        {canApprove && (
          <button
            disabled={busy}
            onClick={() => {
              if (!confirm(`Delete v${post.version}?`)) return;
              void fetch(`/api/changelog/${post.id}`, { method: "DELETE" })
                .then(() => {
                  router.push("/changelog/manage");
                  router.refresh();
                })
                .catch(() => setError("Couldn't delete that."));
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-900 dark:hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  postId,
  entry,
  busy,
  onCall,
}: {
  postId: string;
  entry: Entry;
  busy: boolean;
  onCall: (path: string, init: RequestInit) => Promise<boolean>;
}) {
  const [text, setText] = useState(entry.text);
  const dirty = text !== entry.text;

  return (
    <li className="flex flex-wrap items-start gap-2 py-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={1}
        className="min-h-[2.25rem] min-w-0 flex-1 resize-y rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <span className="flex shrink-0 items-center gap-1.5">
        {entry.bugReportId && (
          <Link
            href={`/reports/${entry.bugReportId}`}
            title={entry.reportTitle ?? "the bug report"}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:underline dark:border-zinc-700"
          >
            report
          </Link>
        )}
        {dirty && (
          <button
            disabled={busy}
            onClick={() =>
              onCall(`/api/changelog/${postId}/entries/${entry.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ text: text.trim() }),
              })
            }
            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Save
          </button>
        )}
        <button
          disabled={busy}
          aria-label="Remove this change"
          onClick={() =>
            onCall(`/api/changelog/${postId}/entries/${entry.id}`, {
              method: "DELETE",
            })
          }
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-400 hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:text-red-400"
        >
          ✕
        </button>
      </span>
    </li>
  );
}
