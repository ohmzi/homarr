CREATE TABLE `uptime_daily` (
	`source_id` text NOT NULL,
	`monitor_id` text NOT NULL,
	`monitor_name` text NOT NULL,
	`date` text NOT NULL,
	`up_seconds` integer DEFAULT 0 NOT NULL,
	`down_seconds` integer DEFAULT 0 NOT NULL,
	`last_beat_at` integer,
	PRIMARY KEY(`source_id`, `monitor_id`, `date`)
);
--> statement-breakpoint
CREATE INDEX `uptime_daily__date_idx` ON `uptime_daily` (`date`);