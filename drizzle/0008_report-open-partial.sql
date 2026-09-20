DROP INDEX `report_open_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `report_open_unique` ON `report` (`level_id`,`reporter_id`) WHERE `status` = 'open';