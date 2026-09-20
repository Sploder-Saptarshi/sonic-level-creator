CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`level_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`level_id`) REFERENCES `level`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `report_level_id_idx` ON `report` (`level_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_open_unique` ON `report` (`level_id`,`reporter_id`,`status`);