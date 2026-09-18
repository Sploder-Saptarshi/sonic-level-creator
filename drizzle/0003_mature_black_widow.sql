ALTER TABLE `level` ADD `published` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `level_published_idx` ON `level` (`published`);