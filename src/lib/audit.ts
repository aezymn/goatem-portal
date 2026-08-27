import { db } from "@/db";
import { auditLog } from "@/db/schema";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

interface AuditEntry {
  actorDiscordId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an audited action. Call this INSIDE the same db.transaction()
 * as the mutation it's describing (pass `tx` as the first argument) so the
 * two can never drift apart — either both happen or neither does.
 *
 * Also mirrors the entry to a private Discord webhook, if configured, as a
 * second copy that lives outside this app entirely — nobody with even the
 * highest access level in the app can edit or clear it, since there is no
 * update/delete route for audit_log anywhere in this codebase. The webhook
 * post is best-effort: if it fails, the database record (the source of
 * truth) is unaffected.
 */
export async function logAudit(dbOrTx: DbOrTx, entry: AuditEntry) {
  await dbOrTx.insert(auditLog).values({
    actorDiscordId: entry.actorDiscordId,
    actorName: entry.actorName,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
  });

  mirrorToWebhook(entry).catch((err) => {
    console.error("audit webhook mirror failed (db record still saved):", err);
  });
}

async function mirrorToWebhook(entry: AuditEntry) {
  const url = process.env.AUDIT_WEBHOOK_URL;
  if (!url) return;

  const lines = [
    `**${entry.action}** by ${entry.actorName} (\`${entry.actorDiscordId}\`)`,
    `Target: ${entry.targetType}${entry.targetId ? ` \`${entry.targetId}\`` : ""}`,
  ];
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    lines.push("```json\n" + JSON.stringify(entry.metadata, null, 2) + "\n```");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: lines.join("\n").slice(0, 2000) }),
  });

  if (!res.ok) {
    throw new Error(`webhook responded ${res.status}`);
  }
}
