-- 0009: trigger-maintained listing counters + keyset indexes.
-- Replaces per-page COUNT(*) (O(total) rows scanned on every listing hit)
-- with O(1) single-row reads: stats (1 row, id = 1) for the global totals
-- and user.level_count / user.published_level_count for the per-user ones.
-- Every trigger below is incremental (+1/-1 on one PK row, zero SELECTs);
-- WHEN clauses mean no-op writes cost nothing. The UPDATE triggers use
-- guarded dual-UPDATE bodies (debit OLD side, credit NEW side) so any
-- transition — publish flip, owner change, both at once — stays exact.
-- Predicate mirror (must match server/utils/levels.ts or counters drift):
--   stats.published_levels      = level WHERE published = 1 AND id <> '2914'
--   stats.open_reports          = report WHERE status = 'open'
--   user.level_count            = level WHERE user_id = ? (any state, stock in)
--   user.published_level_count  = level WHERE user_id = ? AND published = 1 AND id <> '2914'
-- '2914' is STOCK_LEVEL_ID (the seeded row listings always exclude).
ALTER TABLE `user` ADD `level_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `published_level_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE `stats` (
	`id` integer PRIMARY KEY NOT NULL,
	`published_levels` integer NOT NULL DEFAULT 0,
	`open_reports` integer NOT NULL DEFAULT 0
);--> statement-breakpoint
INSERT INTO `stats` (`id`, `published_levels`, `open_reports`) SELECT 1, (SELECT COUNT(*) FROM `level` WHERE `published` = 1 AND `id` <> '2914'), (SELECT COUNT(*) FROM `report` WHERE `status` = 'open');--> statement-breakpoint
UPDATE `user` SET `level_count` = (SELECT COUNT(*) FROM `level` WHERE `level`.`user_id` = `user`.`id`), `published_level_count` = (SELECT COUNT(*) FROM `level` WHERE `level`.`user_id` = `user`.`id` AND `level`.`published` = 1 AND `level`.`id` <> '2914');--> statement-breakpoint
CREATE TRIGGER `level_ai_stats_pub` AFTER INSERT ON `level` WHEN NEW.`published` = 1 AND NEW.`id` <> '2914' BEGIN UPDATE `stats` SET `published_levels` = `published_levels` + 1 WHERE `id` = 1; END;--> statement-breakpoint
CREATE TRIGGER `level_ai_user_total` AFTER INSERT ON `level` BEGIN UPDATE `user` SET `level_count` = `level_count` + 1 WHERE `id` = NEW.`user_id`; END;--> statement-breakpoint
CREATE TRIGGER `level_ai_user_pub` AFTER INSERT ON `level` WHEN NEW.`published` = 1 AND NEW.`id` <> '2914' BEGIN UPDATE `user` SET `published_level_count` = `published_level_count` + 1 WHERE `id` = NEW.`user_id`; END;--> statement-breakpoint
CREATE TRIGGER `level_ad_stats_pub` AFTER DELETE ON `level` WHEN OLD.`published` = 1 AND OLD.`id` <> '2914' BEGIN UPDATE `stats` SET `published_levels` = `published_levels` - 1 WHERE `id` = 1; END;--> statement-breakpoint
CREATE TRIGGER `level_ad_user_total` AFTER DELETE ON `level` BEGIN UPDATE `user` SET `level_count` = `level_count` - 1 WHERE `id` = OLD.`user_id`; END;--> statement-breakpoint
CREATE TRIGGER `level_ad_user_pub` AFTER DELETE ON `level` WHEN OLD.`published` = 1 AND OLD.`id` <> '2914' BEGIN UPDATE `user` SET `published_level_count` = `published_level_count` - 1 WHERE `id` = OLD.`user_id`; END;--> statement-breakpoint
CREATE TRIGGER `level_au_stats_pub` AFTER UPDATE ON `level` WHEN NEW.`published` <> OLD.`published` OR NEW.`user_id` <> OLD.`user_id` OR NEW.`id` <> OLD.`id` BEGIN UPDATE `stats` SET `published_levels` = `published_levels` - 1 WHERE `id` = 1 AND OLD.`published` = 1 AND OLD.`id` <> '2914'; UPDATE `stats` SET `published_levels` = `published_levels` + 1 WHERE `id` = 1 AND NEW.`published` = 1 AND NEW.`id` <> '2914'; END;--> statement-breakpoint
CREATE TRIGGER `level_au_user_total` AFTER UPDATE ON `level` WHEN NEW.`user_id` <> OLD.`user_id` BEGIN UPDATE `user` SET `level_count` = `level_count` - 1 WHERE `id` = OLD.`user_id`; UPDATE `user` SET `level_count` = `level_count` + 1 WHERE `id` = NEW.`user_id`; END;--> statement-breakpoint
CREATE TRIGGER `level_au_user_pub` AFTER UPDATE ON `level` WHEN NEW.`published` <> OLD.`published` OR NEW.`user_id` <> OLD.`user_id` OR NEW.`id` <> OLD.`id` BEGIN UPDATE `user` SET `published_level_count` = `published_level_count` - 1 WHERE `id` = OLD.`user_id` AND OLD.`published` = 1 AND OLD.`id` <> '2914'; UPDATE `user` SET `published_level_count` = `published_level_count` + 1 WHERE `id` = NEW.`user_id` AND NEW.`published` = 1 AND NEW.`id` <> '2914'; END;--> statement-breakpoint
CREATE TRIGGER `report_ai_open` AFTER INSERT ON `report` WHEN NEW.`status` = 'open' BEGIN UPDATE `stats` SET `open_reports` = `open_reports` + 1 WHERE `id` = 1; END;--> statement-breakpoint
CREATE TRIGGER `report_ad_open` AFTER DELETE ON `report` WHEN OLD.`status` = 'open' BEGIN UPDATE `stats` SET `open_reports` = `open_reports` - 1 WHERE `id` = 1; END;--> statement-breakpoint
CREATE TRIGGER `report_au_open` AFTER UPDATE ON `report` WHEN NEW.`status` <> OLD.`status` BEGIN UPDATE `stats` SET `open_reports` = `open_reports` - 1 WHERE `id` = 1 AND OLD.`status` = 'open'; UPDATE `stats` SET `open_reports` = `open_reports` + 1 WHERE `id` = 1 AND NEW.`status` = 'open'; END;--> statement-breakpoint
CREATE INDEX `level_user_updated_idx` ON `level` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `level_user_pub_updated_idx` ON `level` (`user_id`,`published`,`updated_at`);
