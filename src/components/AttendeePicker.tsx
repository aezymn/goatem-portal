"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface RosterMemberOption {
  id: string;
  robloxUsername: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
  rank: string | null;
}

interface AttendeePickerProps {
  roster: RosterMemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function AttendeePicker({
  roster,
  selectedIds,
  onChange,
  disabled = false,
}: AttendeePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedMembers = roster.filter((m) => selectedIds.includes(m.id));

  const filteredMembers = roster.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const roblox = (m.robloxUsername ?? "").toLowerCase();
    const discord = (m.discordUsername ?? "").toLowerCase();
    const rank = (m.rank ?? "").toLowerCase();
    return roblox.includes(q) || discord.includes(q) || rank.includes(q);
  });

  function toggleMember(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function removeMember(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Who attended? <span className="text-zinc-500 font-normal">({selectedIds.length} selected)</span>
        </label>
        {selectedIds.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Selected Chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 py-1">
          {selectedMembers.map((m) => {
            const name = m.robloxUsername ?? m.discordUsername ?? "Member";
            return (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-1 pr-2 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {m.discordAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.discordAvatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                )}
                <span>{name}</span>
                {m.rank && (
                  <span className="rounded bg-zinc-200 px-1 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {m.rank}
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeMember(m.id, e)}
                    className="ml-0.5 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-600 dark:hover:text-zinc-100"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Search & Droplist Trigger */}
      <div
        className={`relative flex items-center rounded-md border bg-white dark:bg-zinc-950 ${
          open
            ? "border-zinc-400 ring-1 ring-zinc-400 dark:border-zinc-600 dark:ring-zinc-600"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <Search className="ml-2.5 h-4 w-4 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search members to add attendee…"
          className="w-full bg-transparent px-2.5 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((prev) => !prev);
            if (!open) {
              inputRef.current?.focus();
            }
          }}
          className="mr-2 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          aria-label="Toggle attendee list"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Droplist Popover */}
      {open && (
        <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {filteredMembers.length === 0 ? (
            <p className="p-3 text-center text-xs text-zinc-500">
              No members found matching &quot;{query}&quot;
            </p>
          ) : (
            filteredMembers.map((m) => {
              const isSelected = selectedIds.includes(m.id);
              const name = m.robloxUsername ?? m.discordUsername ?? "Member";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>

                  {m.discordAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.discordAvatarUrl}
                      alt=""
                      className="h-5 w-5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  )}

                  <span className="min-w-0 flex-1 truncate">{name}</span>

                  {m.discordUsername && m.robloxUsername && (
                    <span className="truncate text-xs text-zinc-400">
                      @{m.discordUsername}
                    </span>
                  )}

                  {m.rank && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {m.rank}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
