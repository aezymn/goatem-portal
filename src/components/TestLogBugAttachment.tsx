"use client";

import { useState } from "react";
import { Bug, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { RosterMemberOption } from "./AttendeePicker";

export interface BugOption {
  id: string;
  title: string;
}

export interface AttachedBugItem {
  bugReportId: string;
  workedOnById: string | null;
}

interface TestLogBugAttachmentProps {
  availableBugs: BugOption[];
  roster: RosterMemberOption[];
  attachedBugs: AttachedBugItem[];
  onChange: (bugs: AttachedBugItem[]) => void;
  attendeeIds: string[];
  disabled?: boolean;
}

export function TestLogBugAttachment({
  availableBugs,
  roster,
  attachedBugs,
  onChange,
  attendeeIds,
  disabled = false,
}: TestLogBugAttachmentProps) {
  const [selectedBugId, setSelectedBugId] = useState("");

  const attachedBugIds = new Set(attachedBugs.map((b) => b.bugReportId));
  const unattachedBugs = availableBugs.filter((b) => !attachedBugIds.has(b.id));

  function handleAttach() {
    if (!selectedBugId || disabled) return;
    onChange([
      ...attachedBugs,
      {
        bugReportId: selectedBugId,
        workedOnById: attendeeIds.length === 1 ? attendeeIds[0] : null,
      },
    ]);
    setSelectedBugId("");
  }

  function handleDetach(bugReportId: string) {
    if (disabled) return;
    onChange(attachedBugs.filter((b) => b.bugReportId !== bugReportId));
  }

  function handleWorkerChange(bugReportId: string, workerId: string | null) {
    if (disabled) return;
    onChange(
      attachedBugs.map((b) =>
        b.bugReportId === bugReportId ? { ...b, workedOnById: workerId } : b
      )
    );
  }

  const attendeeMembers = roster.filter((m) => attendeeIds.includes(m.id));
  const otherMembers = roster.filter((m) => !attendeeIds.includes(m.id));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <Bug className="h-4 w-4 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Attach Bug Reports
        </span>
        <span className="text-xs text-zinc-400">
          (Optional — link bugs worked on during this session)
        </span>
      </div>

      {/* Attach Bug Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedBugId}
          disabled={disabled || unattachedBugs.length === 0}
          onChange={(e) => setSelectedBugId(e.target.value)}
          className="min-w-[15rem] flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">
            {unattachedBugs.length === 0
              ? "No available bugs to attach"
              : "Select a bug report to attach…"}
          </option>
          {unattachedBugs.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || !selectedBugId}
          onClick={handleAttach}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Attach Bug
        </button>
      </div>

      {/* Attached Bugs List */}
      {attachedBugs.length > 0 && (
        <ul className="flex flex-col gap-2 pt-1">
          {attachedBugs.map((item) => {
            const bug = availableBugs.find((b) => b.id === item.bugReportId);
            const title = bug?.title ?? `Bug #${item.bugReportId.slice(0, 8)}`;

            return (
              <li
                key={item.bugReportId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-2.5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex min-w-[12rem] flex-1 items-center gap-2">
                  <a
                    href={`/reports/${item.bugReportId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                  >
                    <span>{title}</span>
                    <ExternalLink className="h-3 w-3 text-zinc-400" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>Worked on by:</span>
                    <select
                      value={item.workedOnById ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        handleWorkerChange(
                          item.bugReportId,
                          e.target.value ? e.target.value : null
                        )
                      }
                      className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="">Unassigned / Group effort</option>
                      {attendeeMembers.length > 0 && (
                        <optgroup label="Session Attendees">
                          {attendeeMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.robloxUsername ?? m.discordUsername ?? "Member"}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherMembers.length > 0 && (
                        <optgroup label="Other Roster Members">
                          {otherMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.robloxUsername ?? m.discordUsername ?? "Member"}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>

                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleDetach(item.bugReportId)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                      title="Detach bug"
                      aria-label="Detach bug"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
