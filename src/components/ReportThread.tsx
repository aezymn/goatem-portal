"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCommentAction } from "@/app/actions/comments";
import { AttachmentView } from "@/components/AttachmentView";
import { AttachmentFields } from "@/components/AttachmentFields";
import { SafeHtml } from "@/components/SafeHtml";
import { useLiveReport } from "@/components/useLiveReport";
import type { StageRow, TimelineEntry } from "@/lib/reports";

interface ReportBody {
  description: string;
  attachments: string[];
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

/**
 * The bug and everything that happened to it, as one vertical timeline.
 *
 * The report's description is the first node and is NOT a message — it's
 * the bug itself. Each stage after it is a marker on the line, with the
 * replies written during that stage sitting underneath it, so the thread
 * reads as "here's the bug, here's what we did next, here's what people
 * said while we did it".
 */
export function ReportThread({
  reportId,
  body,
  stages,
  entries,
  meMemberId,
  canReply,
  canAddStage,
  canRemoveStage,
  locked,
  version,
}: {
  reportId: string;
  body: ReportBody;
  stages: StageRow[];
  entries: TimelineEntry[];
  meMemberId: string | null;
  canReply: boolean;
  canAddStage: boolean;
  /** Whether the viewer may remove ANY stage; their own is always theirs
   * to remove and is decided per-stage below. */
  canRemoveStage: boolean;
  /** Completed reports take no new messages and no new stages. */
  locked: boolean;
  version: string;
}) {
  // Everyone looking at this report sees each other's messages, stages and
  // tag changes appear without touching anything.
  useLiveReport(reportId, version);

  const [replyTo, setReplyTo] = useState<TimelineEntry | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleStage(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const byStage = new Map<string | null, TimelineEntry[]>();
  for (const entry of entries) {
    const key = entry.stageId ?? null;
    byStage.set(key, [...(byStage.get(key) ?? []), entry]);
  }
  // A stage that was soft-deleted leaves its comments with a stageId
  // pointing nowhere; those fall back under the report rather than
  // disappearing from the page.
  const known = new Set(stages.map((s) => s.id));
  const orphaned = [...byStage.entries()]
    .filter(([key]) => key !== null && !known.has(key))
    .flatMap(([, list]) => list);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* One continuous line behind every node — drawn once on the
          container rather than per-node, so it never breaks at the seams
          between stages. */}
      <div className="relative flex flex-col gap-6">
        <span
          aria-hidden
          className="absolute bottom-2 left-[7px] top-3 w-px bg-zinc-200 dark:bg-zinc-800"
        />

        <Node
          marker="filed"
          title="Reported"
          count={(byStage.get(null) ?? []).length + orphaned.length}
          meta={
            <>
              <Link
                href={`/members/${body.authorId}`}
                className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
              >
                {body.authorName}
              </Link>{" "}
              · {formatWhen(body.createdAt)}
            </>
          }
        >
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
            <SafeHtml 
              html={body.description} 
              className="whitespace-pre-wrap break-words text-sm" 
            />
            {body.attachments.length > 0 && (
              <AttachmentView urls={body.attachments} />
            )}
          </div>

          <Messages
            entries={[...(byStage.get(null) ?? []), ...orphaned]}
            meMemberId={meMemberId}
            onReply={locked ? undefined : setReplyTo}
          />
        </Node>

        {stages.map((stage) => (
          <Node
            key={stage.id}
            marker="stage"
            title={stage.title}
            count={(byStage.get(stage.id) ?? []).length}
            collapsed={collapsed.has(stage.id)}
            onToggle={() => toggleStage(stage.id)}
            meta={
              <>
                <Link
                  href={`/members/${stage.createdById}`}
                  className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                >
                  {stage.createdByName}
                </Link>{" "}
                · {formatWhen(stage.createdAt)}
              </>
            }
            action={
              (canRemoveStage || stage.createdById === meMemberId) && (
                <RemoveStage reportId={reportId} stageId={stage.id} />
              )
            }
          >
            {stage.note && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {stage.note}
              </p>
            )}
            <Messages
              entries={byStage.get(stage.id) ?? []}
              meMemberId={meMemberId}
              onReply={locked ? undefined : setReplyTo}
            />
          </Node>
        ))}
      </div>

      {canAddStage && !locked && <AddStage reportId={reportId} />}

      {locked ? (
        <p className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            className="h-4 w-4 shrink-0"
          >
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <rect x="4" y="11" width="16" height="10" rx="2" />
          </svg>
          This report is complete, so the thread is locked. Nothing new can
          be posted and nobody can join or leave. Take the completed tag off
          in Settings to reopen it.
        </p>
      ) : canReply ? (
        <Composer
          reportId={reportId}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      ) : (
        <p className="border-t border-zinc-200 pt-3 text-sm text-zinc-500 dark:border-zinc-800">
          You need to be on the roster to reply.
        </p>
      )}
    </div>
  );
}

/** One point on the line: the marker, its heading, and whatever sits
 * under it. */
function Node({
  marker,
  title,
  meta,
  action,
  count,
  collapsed,
  onToggle,
  children,
}: {
  marker: "filed" | "stage";
  title: string;
  meta: React.ReactNode;
  action?: React.ReactNode;
  count?: number;
  collapsed?: boolean;
  /** Given only for stages — the report node isn't collapsible, since
   * hiding the bug itself would leave the page saying nothing. */
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const Heading = onToggle ? "button" : "div";
  return (
    <section className="relative pl-7">
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-zinc-50 dark:ring-black ${
          marker === "filed"
            ? "bg-zinc-300 dark:bg-zinc-700"
            : "bg-indigo-500"
        }`}
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Heading
          {...(onToggle
            ? {
                onClick: onToggle,
                "aria-expanded": !collapsed,
                className:
                  "flex items-center gap-1.5 text-left transition hover:opacity-70",
              }
            : { className: "flex items-center gap-1.5" })}
        >
          {onToggle && (
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${
                collapsed ? "" : "rotate-90"
              }`}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          )}
          <h3 className="text-sm font-semibold">{title}</h3>
        </Heading>
        <span className="text-xs text-zinc-400">{meta}</span>
        {collapsed && count !== undefined && count > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 py-px text-[10px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {count}
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {!collapsed && (
        <div className="mt-2 flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}

function Messages({
  entries,
  meMemberId,
  onReply,
}: {
  entries: TimelineEntry[];
  meMemberId: string | null;
  /** Absent on a locked thread — there's nothing to reply into. */
  onReply?: (entry: TimelineEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry, i) => {
        const mine = meMemberId !== null && entry.authorId === meMemberId;
        const runsOn = i > 0 && entries[i - 1].authorId === entry.authorId;

        return (
          <li
            key={entry.id}
            id={`m-${entry.id}`}
            className={`group/msg flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
          >
            <div className="w-8 shrink-0">
              {!runsOn && <Avatar entry={entry} />}
            </div>

            <div
              className={`flex min-w-0 max-w-[min(38rem,88%)] flex-col gap-1.5 ${
                mine ? "items-end" : "items-start"
              }`}
            >
              {!runsOn && (
                <p
                  className={`flex items-baseline gap-2 text-xs ${
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
                    {formatWhen(entry.createdAt)}
                  </span>
                </p>
              )}

              {/* What this answers, if anything — a quoted stub that
                  jumps to the original, the way a chat client does it. */}
              {entry.replyTo && (
                <a
                  href={`#m-${entry.replyTo.id}`}
                  className={`flex max-w-full items-center gap-1.5 truncate rounded-md border-l-2 border-zinc-300 bg-zinc-50 py-0.5 pl-2 pr-2.5 text-xs text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-900 ${
                    mine ? "flex-row-reverse text-right" : ""
                  }`}
                >
                  <span className="shrink-0 font-medium">
                    {entry.replyTo.authorName}
                  </span>
                  <span className="truncate">{entry.replyTo.excerpt}</span>
                </a>
              )}

              {entry.body && (
                <div
                  className={`flex w-full items-center gap-1.5 ${
                    mine ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`w-fit max-w-full rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "rounded-br-sm bg-indigo-600 text-white"
                        : "rounded-bl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    <SafeHtml html={entry.body} className="whitespace-pre-wrap break-words" />
                  </div>
                  {onReply && (
                    <ReplyButton onClick={() => onReply(entry)} />
                  )}
                </div>
              )}

              {/* Attachments sit OUTSIDE the bubble with a width of their
                  own. Inside a w-fit bubble a player has no width to be a
                  percentage of, so its 16:9 padding-bottom resolved to
                  zero and an attachment-only message rendered as a sliver
                  — which is exactly what happened to the first Medal clip
                  posted here. */}
              {entry.attachments.length > 0 && (
                <div
                  className={`flex w-full items-center gap-1.5 ${
                    mine ? "flex-row-reverse" : ""
                  }`}
                >
                  <div className="w-[26rem] max-w-full">
                    <AttachmentView urls={entry.attachments} />
                  </div>
                  {onReply && !entry.body && (
                    <ReplyButton onClick={() => onReply(entry)} />
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Only visible on hover (and always for keyboard focus), so forty
 * messages don't come with forty buttons competing for attention. */
function ReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Reply to this message"
      title="Reply"
      className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 group-hover/msg:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="M9 17 4 12l5-5" />
        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
      </svg>
    </button>
  );
}

function AddStage({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${reportId}/stages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim(), note: note.trim() || null }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(
        (await res?.json().catch(() => null))?.error ?? "Couldn't add that."
      );
      return;
    }
    setTitle("");
    setNote("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="ml-7 w-fit rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
      >
        + Add stage
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="ml-7 flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="What's the new stage? e.g. “Fix in review”"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        placeholder="Optional note"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add stage"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </form>
  );
}

function RemoveStage({
  reportId,
  stageId,
}: {
  reportId: string;
  stageId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (
          !confirm(
            "Remove this stage?\n\nAnything said during it moves back under the report."
          )
        )
          return;
        setBusy(true);
        await fetch(`/api/reports/${reportId}/stages/${stageId}`, {
          method: "DELETE",
        }).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
      className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      Remove
    </button>
  );
}

function Composer({
  reportId,
  replyTo,
  onClearReply,
}: {
  reportId: string;
  replyTo: TimelineEntry | null;
  onClearReply: () => void;
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

    const res = await createCommentAction(reportId, {
      body: body.trim(),
      attachments,
      replyToId: replyTo?.id ?? null,
    });

    setBusy(false);
    if (res.error) {
      setError(res.error ?? "Couldn't post that. Try again.");
      return;
    }

    setBody("");
    setAttachments([]);
    setShowAttach(false);
    onClearReply();
    // Server action already revalidates path, but we can refresh router just in case
    router.refresh();
  }

  return (
    <form
      onSubmit={send}
      className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 pb-2 pt-3 dark:border-zinc-800 dark:bg-black"
    >
      {replyTo && (
        <div className="flex items-center gap-2 rounded-md border-l-2 border-indigo-500 bg-zinc-100 py-1.5 pl-2.5 pr-2 text-xs dark:bg-zinc-900">
          <span className="shrink-0 text-zinc-400">Replying to</span>
          <span className="shrink-0 font-medium">{replyTo.authorName}</span>
          <span className="min-w-0 flex-1 truncate text-zinc-500">
            {replyTo.body.trim() || "(attachment)"}
          </span>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
      )}

      {showAttach && (
        <AttachmentFields urls={attachments} onChange={setAttachments} compact />
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
          // Enter sends, shift+Enter makes a new line — chat conventions,
          // because this is a chat.
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

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
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
  if (d.toDateString() === now.toDateString()) {
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
