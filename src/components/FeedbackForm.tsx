"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, ChevronDown } from "lucide-react";

interface FeedbackFormProps {
  canSubmit: boolean;
}

export function FeedbackForm({ canSubmit }: FeedbackFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [attachments, setAttachments] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  if (!canSubmit) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
        You need the <strong>Beta Tester</strong> role in the Discord server to
        submit feedback. If you believe this is a mistake, please contact a QA
        member.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/60">
        <p className="font-medium text-emerald-800 dark:text-emerald-300">
          Feedback submitted — thank you!
        </p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          The QA team will review your report and escalate it if needed. You can
          track it in the list below.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setTitle("");
            setDescription("");
            setStepsToReproduce("");
            setSeverity("medium");
            setAttachments("");
          }}
          className="mt-3 text-sm font-medium text-emerald-700 underline hover:no-underline dark:text-emerald-400"
        >
          Submit another report
        </button>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const attachmentList = attachments
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          stepsToReproduce: stepsToReproduce || undefined,
          severity,
          attachments: attachmentList,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        // Trigger a page refresh so the list updates.
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to submit feedback.");
      }
    });
  }

  const severityOptions: { value: typeof severity; label: string; color: string }[] = [
    { value: "low", label: "Low", color: "text-zinc-500" },
    { value: "medium", label: "Medium", color: "text-blue-600 dark:text-blue-400" },
    { value: "high", label: "High", color: "text-amber-600 dark:text-amber-400" },
    { value: "critical", label: "Critical", color: "text-red-600 dark:text-red-400" },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary of the issue"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in as much detail as you can."
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Steps to reproduce</label>
        <textarea
          maxLength={5000}
          rows={3}
          value={stepsToReproduce}
          onChange={(e) => setStepsToReproduce(e.target.value)}
          placeholder={`1. Open the game\n2. Go to...\n3. Notice that...`}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Severity</label>
        <div className="relative">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            className="w-full appearance-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {severityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Attachment links{" "}
          <span className="font-normal text-zinc-500">(one URL per line)</span>
        </label>
        <textarea
          maxLength={20000}
          rows={2}
          value={attachments}
          onChange={(e) => setAttachments(e.target.value)}
          placeholder="https://medal.tv/... or https://youtu.be/..."
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {isPending ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}
