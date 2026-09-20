"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttendeePicker, type RosterMemberOption } from "@/components/AttendeePicker";
import {
  TestLogBugAttachment,
  type AttachedBugItem,
  type BugOption,
} from "@/components/TestLogBugAttachment";

interface TestLogFormProps {
  currentMemberId?: string;
  rosterMembers: RosterMemberOption[];
  availableBugs: BugOption[];
}

export function TestLogForm({
  currentMemberId,
  rosterMembers,
  availableBugs,
}: TestLogFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [area, setArea] = useState("");
  const [findings, setFindings] = useState("");
  const [minutes, setMinutes] = useState("");
  const [testedAt, setTestedAt] = useState(today);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    currentMemberId ? [currentMemberId] : []
  );
  const [attachedBugs, setAttachedBugs] = useState<AttachedBugItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/test-logs", {
      method: "POST",
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
      setError(data.error ?? "Couldn't save that log.");
      return;
    }
    setArea("");
    setFindings("");
    setMinutes("");
    setAttendeeIds(currentMemberId ? [currentMemberId] : []);
    setAttachedBugs([]);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-900">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Log a Testing Session
          </h2>
          <p className="text-xs text-zinc-500">
            Record what was tested, who attended, summary findings, and linked bugs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm font-medium">
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
        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>Date</span>
          <input
            type="date"
            required
            value={testedAt}
            onChange={(e) => setTestedAt(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700"
          />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm font-medium">
          <span>Minutes</span>
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

      {/* Searchable Multi-Select Attendees Picker */}
      <AttendeePicker
        roster={rosterMembers}
        selectedIds={attendeeIds}
        onChange={setAttendeeIds}
        disabled={busy}
      />

      {/* General TL;DR */}
      <label className="flex flex-col gap-1 text-sm font-medium">
        <span>General TL;DR of what happened</span>
        <textarea
          required
          rows={3}
          value={findings}
          maxLength={5000}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="Findings, clean passes, broken flows, or notes worth recording for the team…"
          className="rounded-md border border-zinc-300 bg-transparent p-3 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700"
        />
      </label>

      {/* Bug Reports Attachment & Worker Designation */}
      <TestLogBugAttachment
        availableBugs={availableBugs}
        roster={rosterMembers}
        attachedBugs={attachedBugs}
        onChange={setAttachedBugs}
        attendeeIds={attendeeIds}
        disabled={busy}
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Log testing"}
        </button>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </form>
  );
}
