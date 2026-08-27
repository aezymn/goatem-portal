// Goatem Studios staff portal — database schema (Drizzle ORM / Postgres)
//
// Design notes (full rationale in SETUP.md):
// - Nothing is ever hard-deleted through the app. Every deletable table has
//   `deletedAt`, and mutating routes set it instead of removing the row —
//   makes "someone wrecked stuff" recoverable by design, not just by hoping
//   a backup exists.
// - auditLog is append-only: no route in this app ever updates or deletes a
//   row in it. It exists purely so there's a record even if something else
//   goes wrong.
// - People are identified by Discord ID throughout, since login is Discord
//   OAuth gated to the studio's guild — see src/lib/auth.ts.

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const reportStatusEnum = pgEnum("report_status", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
]);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    robloxUsername: text("roblox_username").notNull().unique(),
    discordId: text("discord_id").unique(),
    rank: text("rank").notNull(),
    status: text("status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("members_deleted_at_idx").on(table.deletedAt)]
);

export const bugReports = pgTable(
  "bug_reports",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: reportStatusEnum("status").notNull().default("OPEN"),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => members.id),
    assigneeId: text("assignee_id").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_deleted_at_idx").on(table.deletedAt),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    body: text("body").notNull(),
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReports.id),
    authorId: text("author_id")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("comments_bug_report_id_idx").on(table.bugReportId)]
);

// Append-only. No code path in this app updates or deletes rows here —
// that's the whole point. See src/lib/audit.ts.
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    actorDiscordId: text("actor_discord_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_actor_discord_id_idx").on(table.actorDiscordId),
  ]
);

export const membersRelations = relations(members, ({ many }) => ({
  reportsFiled: many(bugReports, { relationName: "reportsFiled" }),
  reportsAssigned: many(bugReports, { relationName: "reportsAssigned" }),
  comments: many(comments),
}));

export const bugReportsRelations = relations(bugReports, ({ one, many }) => ({
  reporter: one(members, {
    fields: [bugReports.reporterId],
    references: [members.id],
    relationName: "reportsFiled",
  }),
  assignee: one(members, {
    fields: [bugReports.assigneeId],
    references: [members.id],
    relationName: "reportsAssigned",
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  bugReport: one(bugReports, {
    fields: [comments.bugReportId],
    references: [bugReports.id],
  }),
  author: one(members, {
    fields: [comments.authorId],
    references: [members.id],
  }),
}));

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
