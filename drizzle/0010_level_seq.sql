-- 0010: atomic level id sequencer for POST /api/levels.
-- Replaces the racy MAX(CAST(id AS INT))+1 SELECT/INSERT loop with a single
-- row UPDATE ... RETURNING that SQLite serializes. Seeded from the live MAX
-- so existing numeric ids (2914 stock + 2915..) stay contiguous; next alloc
-- is MAX+1. Single row (id=1), never INSERTed outside this migration.
CREATE TABLE `level_seq` (
	`id` integer PRIMARY KEY NOT NULL,
	`next_id` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `level_seq` (`id`, `next_id`) SELECT 1, COALESCE(MAX(CAST(`id` AS INTEGER)), 2914) FROM `level`;
