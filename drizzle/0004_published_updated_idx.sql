DROP INDEX `level_published_idx`;--> statement-breakpoint
CREATE INDEX `level_published_updated_idx` ON `level` (`published`,`updated_at`);