"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AttendeePicker, type RosterMemberOption } from "@/components/AttendeePicker";
import {
  TestLogBugAttachment,
  type AttachedBugItem,
  type BugOption,
} from "@/components/TestLogBugAttachment";
import type { DetailedTestLog } from "@/lib/activity";

interface EditTestLogDialogProps {
  log: DetailedTestLog;
  rosterMembers: RosterMemberOption[];
  availableBugs: BugOption[];
}

export function EditTestLogDialog({
  log,
  rosterMembers,
  availableBugs,
}: EditTestLogDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState(log.area);
  const [testedAt, setTestedAt] = useState(log.testedAt);
  const [minutes, setMinutes] = useState(
    log.minutesSpent ? String(log.minutesSpent) : ""
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    log.attendees.map((a) => a.memberId)
  );
  const [findings, setFindings] = useState(log.findings);
  const [attachedBugs, setAttachedBugs] = useState<AttachedBugItem[]>(
    log.bugs.map((b) => ({
      bugReportId: b.bugReportId,
      workedOnById: b.workedOnById,
    }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetToLog() {
    setArea(log.area);
    setTestedAt(log.testedAt);
    setMinutes(log.minutesSpent ? String(log.minutesSpent) : "");
    setAttendeeIds(log.attendees.map((a) => a.memberId));
    setFindings(log.findings);
    setAttachedBugs(
      log.bugs.map((b) => ({
        bugReportId: b.bugReportId,
        workedOnById: b.workedOnById,
      }))
    );
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/test-logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: area.trim(),
        findings: findings.trim(),
        minutesSpent: minutes ? Number(minutes) : null,
        testedAt,
        attendeeIds,
        bugs: attachedBugs,
      }),
    });

    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update test log.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          resetToLog();
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          title="Edit testing log"
          aria-label="Edit testing log"
          className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Test Session</DialogTitle>
          <DialogDescription>
            Update session title, attendees, TL;DR findings, and linked bug reports.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Title / Area */}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Session Title / Focus Area</span>
            <input
              required
              value={area}
              maxLength={120}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Lobby matchmaking & party sync"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700"
            />
          </label>

          {/* Date & Minutes */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm font-medium">
              <span>Date</span>
              <input
                type="date"
                required
                value={testedAt}
                onChange={(e) => setTestedAt(e.target.value)}
                className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700"
              />
            </label>

            <label className="flex w-36 flex-col gap-1.5 text-sm font-medium">
              <span>Minutes Spent</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="optional"
                className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700"
              />
            </label>
          </div>

          {/* Attendee Multi-Select */}
          <AttendeePicker
            roster={rosterMembers}
            selectedIds={attendeeIds}
            onChange={setAttendeeIds}
            disabled={busy}
          />

          {/* General TL;DR */}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>General TL;DR of what happened</span>
            <textarea
              required
              rows={4}
              value={findings}
              maxLength={5000}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Summary of testing results, bugs observed, clean passes, or blocker notes."
              className="rounded-md border border-zinc-300 bg-transparent p-3 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700"
            />
          </label>

          {/* Attach Bugs */}
          <TestLogBugAttachment
            availableBugs={availableBugs}
            roster={rosterMembers}
            attachedBugs={attachedBugs}
            onChange={setAttachedBugs}
            attendeeIds={attendeeIds}
            disabled={busy}
          />

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <DialogFooter className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
