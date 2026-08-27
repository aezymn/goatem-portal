import { z } from "zod";

// Every field a person can type into has a length cap — not just to keep
// the database tidy, but as a basic defense against someone trying to
// stuff huge payloads through the API directly (bypassing the UI, which
// obviously can't be relied on to enforce anything).

export const createReportSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(5000),
});

export const updateReportSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
  assigneeId: z.string().max(64).nullable().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const createMemberSchema = z.object({
  robloxUsername: z.string().trim().min(3).max(50),
  discordId: z
    .string()
    .trim()
    .regex(/^\d{15,25}$/, "must be a numeric Discord ID")
    .nullable()
    .optional(),
  rank: z.string().trim().min(1).max(50),
  status: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateMemberSchema = createMemberSchema.partial();
