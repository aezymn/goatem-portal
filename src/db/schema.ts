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

// Bug reports used to carry a fixed status enum. It's gone: "in progress"
// and "complete" turned out to be the same kind of thing as "high
// priority", so both live in bugTags now and there's one control instead
// of two competing ones. See drizzle/0009 for the migration that moved
// existing statuses across.

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

// Which release or phase a bug belongs to — "Pre-launch", "Update v1.01".
// One per report, ordered by `position` the way ranks are, and managed by
// admins so the list doesn't sprawl into near-duplicates.
export const bugCategories = pgTable("bug_categories", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A kind of tag — "Progress", "Priority". Grouping exists mainly so a
// group can be marked `exclusive`: a report is In progress OR Complete,
// never both, and that rule belongs to the group rather than being
// hardcoded against particular tag names.
export const bugTagGroups = pgTable("bug_tag_groups", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  exclusive: boolean("exclusive").notNull().default(false),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Free-form labels: workflow state ("In progress", "Complete") and
// priority ("High priority") are the same kind of thing, so they share
// one system rather than a status column competing with a tag list.
// `tone` names a colour from a fixed palette (src/lib/bugTaxonomy.ts)
// rather than storing a raw hex, so tags can never drift out of the
// design system or land unreadable in one of the two themes.
export const bugTags = pgTable("bug_tags", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  tone: text("tone").notNull().default("zinc"),
  // Applying a tag with this set closes the report: it locks the thread
  // and starts the archive clock. A property of the tag rather than a
  // hardcoded name, so "Complete" can be renamed — or a second closing
  // tag like "Won't fix" added — without touching code.
  locksReport: boolean("locks_report").notNull().default(false),
  // ON DELETE SET NULL: removing a group should ungroup its tags, never
  // delete labels that reports are still using.
  groupId: text("group_id").references(
    (): AnyPgColumn => bugTagGroups.id,
    { onDelete: "set null" }
  ),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bugReports = pgTable(
  "bug_reports",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    title: text("title").notNull(),
    description: text("description").notNull(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => members.id),
    // Which release or phase this bug belongs to ("Pre-launch",
    // "Update v1.01"). Nullable, and ON DELETE SET NULL: retiring a
    // category should never take reports down with it.
    categoryId: text("category_id").references(
      (): AnyPgColumn => bugCategories.id,
      { onDelete: "set null" }
    ),
    // Attachment URLs, in the order they were added. Links only — the
    // portal never hosts the media, it embeds it (Medal clips, YouTube,
    // images). A plain array is enough because nothing ever queries
    // across attachments; they're only ever read alongside their report.
    attachments: jsonb("attachments").$type<string[]>().notNull().default([]),
    // When a locking tag (normally "Complete") was applied. Doubles as
    // the lock — a completed report takes no new messages and nobody
    // joins or leaves it — and as the clock the 30-day auto-archive runs
    // off. Cleared the moment the locking tag comes off, so unlocking is
    // just untagging rather than a separate switch that can disagree.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Out of the way, not gone. Archived reports drop off the default
    // list and are still readable.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("bug_reports_category_id_idx").on(table.categoryId),
    index("bug_reports_completed_at_idx").on(table.completedAt),
    index("bug_reports_archived_at_idx").on(table.archivedAt),
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
    attachments: jsonb("attachments").$type<string[]>().notNull().default([]),
    // A direct reply to another message in the same thread. Self-FK, ON
    // DELETE SET NULL: deleting the message being answered leaves the
    // answer standing rather than taking it down too.
    replyToId: text("reply_to_id").references((): AnyPgColumn => comments.id, {
      onDelete: "set null",
    }),
    // Which stage was current when this was written. Null means it was
    // said before any stage existed, so it sits under the report itself.
    // ON DELETE SET NULL: removing a stage must not delete what people
    // said during it.
    stageId: text("stage_id").references((): AnyPgColumn => bugStages.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("comments_bug_report_id_idx").on(table.bugReportId)]
);

// Append-only. No code path in this app updates or deletes rows here —
// that's the whole point. See src/lib/audit.ts.
// The steps a bug moves through, in order — "Reproduced on staging",
// "Fix in review". Comments hang off whichever stage was current when
// they were written, so the thread reads as a record of what happened at
// each step rather than one long undifferentiated list.
//
// Stages belong to one report (they aren't a shared workflow) because
// what a bug goes through is particular to that bug.
export const bugStages = pgTable(
  "bug_stages",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => members.id),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("bug_stages_bug_report_id_idx").on(table.bugReportId)]
);

// Many-to-many, hard-deleted on purpose: unapplying a tag is not the
// kind of event the soft-delete rule exists to protect, and keeping
// tombstones here would make "which tags does this report have" a
// filtered query for no benefit. The audit log records the change.
export const bugReportTags = pgTable(
  "bug_report_tags",
  {
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => bugTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.bugReportId, table.tagId] }),
    index("bug_report_tags_tag_id_idx").on(table.tagId),
  ]
);

// Who is working on a report. Replaces the old single assignee: people
// join a report themselves and appear in its member list, the way a
// Discord channel shows who's in it, rather than being handed the bug by
// someone else.
export const bugParticipants = pgTable(
  "bug_participants",
  {
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bugReportId, table.memberId] }),
    index("bug_participants_member_id_idx").on(table.memberId),
  ]
);

// What someone changed in the game because of a bug report.
//
// Collected by prompting whoever worked the bug once it's closed, while
// they still remember — the change log is then written from what people
// actually said rather than from someone reading a thread weeks later.
// One note per person per report, editable, so the question has a single
// answer rather than a pile of them.
export const bugChanges = pgTable(
  "bug_changes",
  {
    bugReportId: text("bug_report_id")
      .notNull()
      .references(() => bugReports.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bugReportId, table.memberId] }),
    index("bug_changes_bug_report_id_idx").on(table.bugReportId),
  ]
);

// A change log post — one release, one date, one version.
//
// The version is stored BOTH as its display string and as its three
// numbers. The string is what people read and can hand-edit; the numbers
// are what ordering and "what comes next" arithmetic run on, because
// sorting "0.10" after "0.9" is only correct numerically and hopeless as
// text. patch is null for a plain release (0.9) and set for each
// continuation of it (0.9.0, 0.9.1, ...).
export const changelogPosts = pgTable(
  "changelog_posts",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    title: text("title").notNull(),
    version: text("version").notNull(),
    versionMajor: integer("version_major").notNull(),
    versionMinor: integer("version_minor").notNull(),
    versionPatch: integer("version_patch"),
    /** Optional preamble above the list of changes. */
    body: text("body"),
    // draft -> pending -> published. Publishing needs changelog.approve,
    // which is deliberately a different grant from writing: the person
    // who drafts a release note isn't automatically the person who
    // decides it goes out.
    status: text("status").notNull().default("draft"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => members.id),
    approvedById: text("approved_by_id").references(() => members.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("changelog_posts_status_idx").on(table.status),
    index("changelog_posts_version_idx").on(
      table.versionMajor,
      table.versionMinor,
      table.versionPatch
    ),
  ]
);

// One line of a post. Either it came from a bug report (and starts life
// pre-filled from that report's change notes) or somebody typed it — a
// custom field. Both end up as editable text, because a release note
// written for players rarely reads like what a dev wrote for the thread.
export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    postId: text("post_id")
      .notNull()
      .references(() => changelogPosts.id, { onDelete: "cascade" }),
    // ON DELETE SET NULL: deleting a bug report must not silently rewrite
    // a published release note.
    bugReportId: text("bug_report_id").references(() => bugReports.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("changelog_entries_post_id_idx").on(table.postId)]
);

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
  joinedReports: many(bugParticipants),
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
  category: one(bugCategories, {
    fields: [bugReports.categoryId],
    references: [bugCategories.id],
  }),
  comments: many(comments),
  tags: many(bugReportTags),
  participants: many(bugParticipants),
  stages: many(bugStages),
}));

export const bugCategoriesRelations = relations(bugCategories, ({ many }) => ({
  reports: many(bugReports),
}));

export const bugTagsRelations = relations(bugTags, ({ one, many }) => ({
  reports: many(bugReportTags),
  group: one(bugTagGroups, {
    fields: [bugTags.groupId],
    references: [bugTagGroups.id],
  }),
}));

export const bugTagGroupsRelations = relations(bugTagGroups, ({ many }) => ({
  tags: many(bugTags),
}));

export const changelogPostsRelations = relations(
  changelogPosts,
  ({ one, many }) => ({
    createdBy: one(members, {
      fields: [changelogPosts.createdById],
      references: [members.id],
      relationName: "changelogAuthored",
    }),
    approvedBy: one(members, {
      fields: [changelogPosts.approvedById],
      references: [members.id],
      relationName: "changelogApproved",
    }),
    entries: many(changelogEntries),
  })
);

export const changelogEntriesRelations = relations(
  changelogEntries,
  ({ one }) => ({
    post: one(changelogPosts, {
      fields: [changelogEntries.postId],
      references: [changelogPosts.id],
    }),
    report: one(bugReports, {
      fields: [changelogEntries.bugReportId],
      references: [bugReports.id],
    }),
  })
);

export const bugChangesRelations = relations(bugChanges, ({ one }) => ({
  report: one(bugReports, {
    fields: [bugChanges.bugReportId],
    references: [bugReports.id],
  }),
  member: one(members, {
    fields: [bugChanges.memberId],
    references: [members.id],
  }),
}));

export const bugStagesRelations = relations(bugStages, ({ one, many }) => ({
  report: one(bugReports, {
    fields: [bugStages.bugReportId],
    references: [bugReports.id],
  }),
  createdBy: one(members, {
    fields: [bugStages.createdById],
    references: [members.id],
  }),
  comments: many(comments),
}));

export const bugReportTagsRelations = relations(bugReportTags, ({ one }) => ({
  report: one(bugReports, {
    fields: [bugReportTags.bugReportId],
    references: [bugReports.id],
  }),
  tag: one(bugTags, {
    fields: [bugReportTags.tagId],
    references: [bugTags.id],
  }),
}));

export const bugParticipantsRelations = relations(bugParticipants, ({ one }) => ({
  report: one(bugReports, {
    fields: [bugParticipants.bugReportId],
    references: [bugReports.id],
  }),
  member: one(members, {
    fields: [bugParticipants.memberId],
    references: [members.id],
  }),
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
export type BugCategory = typeof bugCategories.$inferSelect;
export type BugTag = typeof bugTags.$inferSelect;
export type BugTagGroup = typeof bugTagGroups.$inferSelect;
export type BugStage = typeof bugStages.$inferSelect;
export type BugChange = typeof bugChanges.$inferSelect;
export type ChangelogPost = typeof changelogPosts.$inferSelect;
export type ChangelogEntry = typeof changelogEntries.$inferSelect;
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
