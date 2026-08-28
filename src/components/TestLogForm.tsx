"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TestLogForm() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [area, setArea] = useState("");
  const [findings, setFindings] = useState("");
  const [minutes, setMinutes] = useState("");
  const [testedAt, setTestedAt] = useState(today);
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
        area,
        findings,
        minutesSpent: minutes ? Number(minutes) : null,
        testedAt,
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
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
          What did you test?
          <input
            required
            value={area}
            maxLength={120}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. lobby matchmaking"
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            required
            value={testedAt}
            onChange={(e) => setTestedAt(e.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          Minutes
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="optional"
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        What did you find?
        <textarea
          required
          rows={3}
          value={findings}
          maxLength={5000}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="Findings, or “nothing broken” — a clean pass is still worth recording."
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Log testing"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
