-- Renaming a rank has to carry its permission rows along. Without ON
-- UPDATE CASCADE, changing ranks.name is rejected outright by the
-- foreign key, so a rename would mean delete-and-recreate — losing the
-- rank's granted actions in the process.
--
-- members.rank is deliberately still plain text with no key of its own
-- (people can hold a rank that predates the ladder), so the rename also
-- updates that column explicitly, in the same transaction. See
-- renameRank in src/lib/ranks.ts.
ALTER TABLE "rank_action_permissions" DROP CONSTRAINT "rank_action_permissions_rank_ranks_name_fk";
--> statement-breakpoint
ALTER TABLE "rank_action_permissions" ADD CONSTRAINT "rank_action_permissions_rank_ranks_name_fk" FOREIGN KEY ("rank") REFERENCES "public"."ranks"("name") ON DELETE cascade ON UPDATE cascade;
