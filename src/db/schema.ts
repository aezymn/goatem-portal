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
  integer,
  boolean,
  date,
  primaryKey,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const reportStatusEnum = pgEnum("report_status", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
]);

// The rank ladder. `position` is the authority order an admin sets by
// dragging ranks around on the Ranks page (lower number = higher
// authority — position 0 is the top of the list). `discordRoleId` binds
// the rank to a live Discord role: holding that role is what puts someone
// on the roster at that rank (see src/lib/rosterSync.ts). It still plays
// no part in permission resolution — what a rank can DO is only ever
// rankActionPermissions below.
//
// A rank granting no rows in rankActionPermissions grants nothing beyond
// the baseline every roster member gets (view roster, file/view/comment
// on reports). See src/lib/permissions.ts for the full access model,
// including why full portal-admin access is deliberately NOT one of these
// per-rank actions.
export const ranks = pgTable("ranks", {
  name: text("name").primaryKey(),
  position: integer("position").notNull(),
  discordRoleId: text("discord_role_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Which specific actions a rank grants to anyone holding it — e.g.
// "reports.triage". See RANK_ACTIONS in src/lib/permissions.ts for the
// fixed catalog of valid action strings. Deliberately a loose text
// column rather than a pg enum: adding a new grantable action later is
// then just a code change, no migration.
export const rankActionPermissions = pgTable(
  "rank_action_permissions",
  {
    // ON UPDATE CASCADE so renaming a rank carries its permissions with
    // it automatically. members.rank has no foreign key (it's plain
    // text), so a rename has to update that side explicitly — see
    // renameRank in src/lib/ranks.ts, which does both in one transaction
    // precisely so the two can never disagree.
    rank: text("rank")
      .notNull()
      .references(() => ranks.name, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    action: text("action").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.rank, table.action] }),
    index("rank_action_permissions_rank_idx").on(table.rank),
  ]
);

// How a roster row came to exist. Matters for sync: rows sourced from
// Discord are owned by the sync (it can remove them when someone loses
// the bound role), while manual and alt rows are never touched by it.
export const memberSourceEnum = pgEnum("member_source", [
  "discord",
  "manual",
  "alt",
]);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    // Nullable: people now land on the roster from Discord BEFORE they've
    // ever signed in, so there's no Roblox username to record yet. They
    // supply it themselves on first sign-in (see /api/me/link). Still
    // unique — Postgres allows many NULLs under a unique constraint, so
    // any number of unlinked people coexist, but no two can claim the
    // same username.
    robloxUsername: text("roblox_username").unique(),
    // Resolved from the username via Roblox's API at link time, and kept
    // because usernames can change while the numeric ID never does.
    robloxUserId: text("roblox_user_id"),
    discordId: text("discord_id").unique(),
    // The account's real @username, not their server nickname — cached
    // from the bot on each sync, purely for display. The ID above remains
    // the identity.
    discordUsername: text("discord_username"),
    // Also cached at sync time rather than fetched per page render: a
    // roster of 40 people would otherwise mean 40 Discord lookups every
    // time someone opens the page.
    discordAvatarUrl: text("discord_avatar_url"),
    rank: text("rank").notNull(),
    // "EU" | "NA" | "APAC", derived from Discord roles on each sync (see
    // src/lib/regions.ts). Deliberately plain text rather than a pg enum:
    // adding a fourth region should be a one-line config change, not a
    // migration. Null means they hold no region role.
    region: text("region"),
    notes: text("notes"),
    source: memberSourceEnum("source").notNull().default("manual"),
    // Set on alt/testing accounts, pointing at the roster row of the
    // person who added them.
    parentMemberId: text("parent_member_id").references(
      (): AnyPgColumn => members.id
    ),
    // Whether this person has ever actually logged into the portal —
    // distinct from being on the roster, which now happens without them.
    hasSignedIn: boolean("has_signed_in").notNull().default(false),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    // Presence, kept as two separate facts because "away" needs both.
    // lastSeenAt is the last heartbeat from an open, visible tab; it says
    // the portal is in front of them. lastActiveAt is the last time they
    // actually did something — moved, typed, clicked, changed page.
    // Fresh seen + stale active is exactly what AFK-on-the-site means,
    // and one column alone can't tell that apart from having closed the
    // tab. See src/lib/presence.ts.
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    // Roblox group membership => can they get into the game. Null means
    // "not checked yet" and is deliberately distinct from false ("checked,
    // and they can't") — the roster shows those differently.
    hasGameAccess: boolean("has_game_access"),
    gameAccessCheckedAt: timestamp("game_access_checked_at", {
      withTimezone: true,
    }),
    // Full portal-admin access, independent of rank entirely. Can ONLY be
    // set true/false by the CREATOR (see src/lib/permissions.ts) via the
    // Admin Access panel, never through the regular roster edit form and
    // never derivable from a rank. This is the one guard against "whoever
    // hands out ranks/Discord roles can hand out full access".
    isPortalAdmin: boolean("is_portal_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("members_deleted_at_idx").on(table.deletedAt),
    index("members_parent_member_id_idx").on(table.parentMemberId),
  ]
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

// A notice, not a request: nobody approves these. Someone says when they
// go and when they're back, and the studio can see it. `returnDate` is
// the first day they're AVAILABLE again, not their last day away — the
// distinction matters when reading "who's around this week", so it's
// named for what it means rather than left ambiguous.
export const absences = pgTable(
  "absences",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    leaveDate: date("leave_date").notNull(),
    returnDate: date("return_date").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("absences_member_id_idx").on(table.memberId),
    index("absences_leave_date_idx").on(table.leaveDate),
  ]
);

// A record of testing done — the counterpart to a bug report. Bug reports
// capture individual defects; these capture the effort, so someone who
// tested thoroughly and found nothing still has something to show for it.
export const testLogs = pgTable(
  "test_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    area: text("area").notNull(),
    findings: text("findings").notNull(),
    minutesSpent: integer("minutes_spent"),
    testedAt: date("tested_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("test_logs_member_id_idx").on(table.memberId),
    index("test_logs_tested_at_idx").on(table.testedAt),
  ]
);

export const membersRelations = relations(members, ({ one, many }) => ({
  reportsFiled: many(bugReports, { relationName: "reportsFiled" }),
  reportsAssigned: many(bugReports, { relationName: "reportsAssigned" }),
  comments: many(comments),
  absences: many(absences),
  testLogs: many(testLogs),
  parent: one(members, {
    fields: [members.parentMemberId],
    references: [members.id],
    relationName: "altAccounts",
  }),
  altAccounts: many(members, { relationName: "altAccounts" }),
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
export type Rank = typeof ranks.$inferSelect;
export type RankActionPermission = typeof rankActionPermissions.$inferSelect;
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export const absencesRelations = relations(absences, ({ one }) => ({
  member: one(members, {
    fields: [absences.memberId],
    references: [members.id],
  }),
}));

export const testLogsRelations = relations(testLogs, ({ one }) => ({
  member: one(members, {
    fields: [testLogs.memberId],
    references: [members.id],
  }),
}));

export type Absence = typeof absences.$inferSelect;
export type NewAbsence = typeof absences.$inferInsert;
export type TestLog = typeof testLogs.$inferSelect;
export type NewTestLog = typeof testLogs.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
