"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  reportId: string;
  currentStatus: string;
  currentAssigneeId: string | null;
  canTriage: boolean;
  canDelete: boolean;
  /** Pre-resolved display names — a roster row may have no Roblox
   * username yet (see displayNameFor in src/lib/members.ts). */
  members: { id: string; name: string }[];
}

export function ReportActions({
  reportId,
  currentStatus,
  currentAssigneeId,
  canTriage,
  canDelete,
  members,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this report? It can be restored from the database if needed, but not from the UI.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/reports");
      router.refresh();
    } else {
      setError("Delete failed.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      {canTriage && (
        <>
          <label className="flex items-center gap-2 text-sm">
            Status
            <select
              defaultValue={currentStatus}
              disabled={busy}
              onChange={(e) => patch({ status: e.target.value })}
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            Assignee
            <select
              defaultValue={currentAssigneeId ?? ""}
              disabled={busy}
              onChange={(e) => patch({ assigneeId: e.target.value || null })}
              className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {canDelete && (
        <button
          onClick={onDelete}
          disabled={busy}
          className="ml-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete report
        </button>
      )}

      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
