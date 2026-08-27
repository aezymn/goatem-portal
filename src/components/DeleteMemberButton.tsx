"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Remove this person from the roster?")) return;
    setBusy(true);
    const res = await fetch(`/api/roster/${memberId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      Remove
    </button>
  );
}
