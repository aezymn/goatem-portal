"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentView } from "@/components/AttachmentView";
import { AttachmentFields } from "@/components/AttachmentFields";
import type { TimelineEntry } from "@/lib/reports";

/**
 * The report as a conversation rather than a header plus a comment list.
 *
 * The first entry IS the report's description — the person who filed it
 * said the first thing, and everything after is a reply. Your own
 * messages sit on the right, everyone else's on the left, which is the
 * one arrangement that lets you follow who's talking without reading
 * every name.
 */
export function ReportTimeline({
  reportId,
  entries,
  meMemberId,
  canReply,
}: {
  reportId: string;
  entries: TimelineEntry[];
  meMemberId: string | null;
  canReply: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && attachments.length === 0) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/reports/${reportId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: body.trim(), attachments }),
    }).catch(() => null);

    setBusy(false);
    if (!res || !res.ok) {
      setError(
        (await res?.json().catch(() => null))?.error ??
          "Couldn't post that. Try again."
      );
      return;
    }

    setBody("");
    setAttachments([]);
    setShowAttach(false);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {entries.map((entry, i) => {
          const mine = meMemberId !== null && entry.authorId === meMemberId;
          // Consecutive messages from the same person drop the repeated
          // avatar and name, so a back-and-forth reads as a conversation
          // instead of a stack of identical headers.
          const runsOn =
            i > 0 &&
            entries[i - 1].authorId === entry.authorId &&
            // ...unless the first entry, which is the report itself and
            // always deserves its own header.
            i !== 1;

          return (
            <li
              key={entry.id}
              className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
            >
              <div className="w-8 shrink-0">
                {!runsOn && <Avatar entry={entry} />}
              </div>

              <div
                className={`flex min-w-0 max-w-[min(42rem,85%)] flex-col ${
                  mine ? "items-end" : "items-start"
                }`}
              >
                {!runsOn && (
                  <p
                    className={`mb-1 flex items-baseline gap-2 text-xs ${
                      mine ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Link
                      href={`/members/${entry.authorId}`}
                      className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                    >
                      {entry.authorName}
                    </Link>
                    <span className="text-zinc-400">
                      {i === 0 && "filed this · "}
                      {formatWhen(entry.createdAt)}
                    </span>
                  </p>
                )}

                <div
                  className={`w-fit max-w-full rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-indigo-600 text-white"
                      : "rounded-bl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  {entry.body && (
                    <p className="whitespace-pre-wrap break-words">
                      {entry.body}
                    </p>
                  )}
                  {entry.attachments.length > 0 && (
                    <div className={entry.body ? "" : "-mt-2"}>
                      <AttachmentView urls={entry.attachments} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {canReply ? (
        <form
          onSubmit={send}
          className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 pt-3 dark:border-zinc-800 dark:bg-black"
        >
          {showAttach && (
            <AttachmentFields
              urls={attachments}
              onChange={setAttachments}
              compact
            />
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowAttach((v) => !v)}
              aria-label="Attach a link"
              aria-expanded={showAttach}
              className={`shrink-0 rounded-md border p-2 transition ${
                showAttach || attachments.length > 0
                  ? "border-indigo-300 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400"
                  : "border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48" />
              </svg>
            </button>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={1}
              placeholder="Add to the thread…"
              // Enter sends, shift+Enter makes a new line — chat
              // conventions, because this is a chat.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e);
                }
              }}
              className="max-h-40 min-h-[2.5rem] flex-1 resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />

            <button
              type="submit"
              disabled={busy || (!body.trim() && attachments.length === 0)}
              className="shrink-0 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </form>
      ) : (
        <p className="border-t border-zinc-200 pt-3 text-sm text-zinc-500 dark:border-zinc-800">
          You need to be on the roster to reply.
        </p>
      )}
    </div>
  );
}

function Avatar({ entry }: { entry: TimelineEntry }) {
  if (!entry.authorAvatarUrl) {
    return (
      <Link
        href={`/members/${entry.authorId}`}
        className="block h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800"
        aria-label={entry.authorName}
      />
    );
  }
  return (
    <Link href={`/members/${entry.authorId}`} aria-label={entry.authorName}>
      {/* eslint-disable-next-line @next/next/no-img-element -- cached Discord CDN avatar */}
      <img
        src={entry.authorAvatarUrl}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
      />
    </Link>
  );
}

/** Today shows a time, this year a date, anything older the year too —
 * enough to place a message without a full timestamp on every line. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
