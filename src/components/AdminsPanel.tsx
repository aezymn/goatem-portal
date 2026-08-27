"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MemberRow {
  id: string;
  robloxUsername: string;
  rank: string;
}

export function AdminsPanel({ initialAdmins }: { initialAdmins: MemberRow[] }) {
  const router = useRouter();
  const [admins, setAdmins] = useState(initialAdmins);
  // Adjusts local state when the server hands us fresh props (e.g. after
  // a router.refresh()) — done during render, not in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitialAdmins, setPrevInitialAdmins] = useState(initialAdmins);
  if (initialAdmins !== prevInitialAdmins) {
    setPrevInitialAdmins(initialAdmins);
    setAdmins(initialAdmins);
  }

  const [query, setQuery] = useState("");
  // Raw results from the last completed fetch, and the query they're for
  // — both derived values below (candidates, searching) come from
  // comparing these against the live `query`, so nothing needs a direct
  // setState call in the effect body itself (only inside the async
  // timeout callback, once the debounce actually fires).
  const [fetchedCandidates, setFetchedCandidates] = useState<MemberRow[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmedQuery = query.trim();
  const candidates = trimmedQuery ? fetchedCandidates : [];
  const searching = trimmedQuery !== "" && trimmedQuery !== debouncedQuery;

  // Debounced search — waits for a pause in typing before hitting the API.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timeout = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/admins?search=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFetchedCandidates(data.candidates ?? []);
      }
      setDebouncedQuery(trimmed);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function addAdmin(member: MemberRow) {
    if (
      !confirm(
        `Give ${member.robloxUsername} full admin access to the portal? This includes managing the roster, ranks, and everything else — are you sure?`
      )
    ) {
      return;
    }
    setBusyId(member.id);
    setError(null);
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that admin.");
      return;
    }
    setQuery("");
    router.refresh();
  }

  async function removeAdmin(member: MemberRow) {
    if (
      !confirm(
        `Remove ${member.robloxUsername}'s admin access? They'll fall back to whatever their rank grants.`
      )
    ) {
      return;
    }
    setBusyId(member.id);
    setError(null);
    const res = await fetch(`/api/admin/admins/${member.id}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (!res.ok) {
      setError("Couldn't remove that admin.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 font-medium">Current admins</h2>
        <ul className="flex flex-col gap-2">
          {admins.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
            >
              <div>
                <span className="font-medium">{m.robloxUsername}</span>
                <span className="ml-2 text-xs text-zinc-500">{m.rank}</span>
              </div>
              <button
                onClick={() => removeAdmin(m)}
                disabled={busyId === m.id}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
          {admins.length === 0 && (
            <li className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No admins yet besides you.
            </li>
          )}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 font-medium">Add an admin</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the roster by Roblox username…"
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {searching && (
          <p className="mt-2 text-xs text-zinc-500">Searching…</p>
        )}
        {!searching && query.trim() && candidates.length === 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            No matching roster members (or they&rsquo;re already an admin).
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {candidates.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
              >
                <div>
                  <span className="font-medium">{m.robloxUsername}</span>
                  <span className="ml-2 text-xs text-zinc-500">{m.rank}</span>
                </div>
                <button
                  onClick={() => addAdmin(m)}
                  disabled={busyId === m.id}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
