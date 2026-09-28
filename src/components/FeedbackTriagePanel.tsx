"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowUpRight, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import type { FeedbackReport } from "@/db/schema";

interface FeedbackTriagePanelProps {
  items: FeedbackReport[];
}

const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  escalated: "Escalated",
  dismissed: "Dismissed",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  reviewed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  escalated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  dismissed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

export function FeedbackTriagePanel({ items: initial }: FeedbackTriagePanelProps) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<string>("new");
  const [isPending, startTransition] = useTransition();
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  const visible = items.filter((i) =>
    filter === "all" ? true : i.status === filter
  );

  function mutate(id: string, patch: Partial<FeedbackReport>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function handleStatus(id: string, status: "reviewed" | "dismissed") {
    startTransition(async () => {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        mutate(id, data.feedback);
        toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}.`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Action failed.");
      }
    });
  }

  function handleEscalate(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/feedback/${id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        mutate(id, { status: "escalated", escalatedToReportId: data.report.id });
        toast.success("Escalated to a bug report.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Escalation failed.");
      }
      setEscalatingId(null);
    });
  }

  const filterOptions = [
    { value: "new", label: "New" },
    { value: "reviewed", label: "Reviewed" },
    { value: "escalated", label: "Escalated" },
    { value: "dismissed", label: "Dismissed" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {filterOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => setFilter(o.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === o.value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {o.label}
            {o.value !== "all" && (
              <span className="ml-1 opacity-60">
                ({items.filter((i) => i.status === o.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No {filter === "all" ? "" : STATUS_LABEL[filter]?.toLowerCase() + " "}
          feedback reports.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-snug">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    @{item.submitterDiscordUsername} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      SEVERITY_COLOR[item.severity] ?? ""
                    }`}
                  >
                    {SEVERITY_LABEL[item.severity] ?? item.severity}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLOR[item.status] ?? ""
                    }`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 line-clamp-4">
                {item.description}
              </p>

              {item.stepsToReproduce && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                    Steps to reproduce
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                    {item.stepsToReproduce}
                  </pre>
                </details>
              )}

              {item.attachments && item.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.attachments.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Attachment
                    </a>
                  ))}
                </div>
              )}

              {item.status === "escalated" && item.escalatedToReportId && (
                <a
                  href={`/reports/${item.escalatedToReportId}`}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  View bug report
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}

              {item.status !== "escalated" && item.status !== "dismissed" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {escalatingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        Escalate to a bug report?
                      </span>
                      <button
                        disabled={isPending}
                        onClick={() => handleEscalate(item.id)}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {isPending ? "Creating…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setEscalatingId(null)}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        disabled={isPending}
                        onClick={() => setEscalatingId(item.id)}
                        className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Escalate to bug report
                      </button>
                      {item.status !== "reviewed" && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStatus(item.id, "reviewed")}
                          className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Mark reviewed
                        </button>
                      )}
                      <button
                        disabled={isPending}
                        onClick={() => handleStatus(item.id, "dismissed")}
                        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
