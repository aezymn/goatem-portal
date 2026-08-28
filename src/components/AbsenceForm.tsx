"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AbsenceForm() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [leaveDate, setLeaveDate] = useState(today);
  const [returnDate, setReturnDate] = useState(today);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveDate, returnDate, reason: reason.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't post that notice.");
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1 text-sm">
        First day away
        <input
          type="date"
          required
          value={leaveDate}
          onChange={(e) => setLeaveDate(e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Back and available
        <input
          type="date"
          required
          value={returnDate}
          min={leaveDate}
          onChange={(e) => setReturnDate(e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        Reason (optional)
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="exams, holiday, …"
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Posting…" : "Post notice"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
