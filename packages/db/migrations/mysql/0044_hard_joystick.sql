CREATE TABLE `uptime_daily` (
	`source_id` varchar(64) NOT NULL,
	`monitor_id` varchar(64) NOT NULL,
	`monitor_name` varchar(256) NOT NULL,
	`date` varchar(10) NOT NULL,
	`up_seconds` int NOT NULL DEFAULT 0,
	`down_seconds` int NOT NULL DEFAULT 0,
	`last_beat_at` timestamp,
	CONSTRAINT `uptime_daily_source_id_monitor_id_date_pk` PRIMARY KEY(`source_id`,`monitor_id`,`date`)
);
--> statement-breakpoint
CREATE INDEX `uptime_daily__date_idx` ON `uptime_daily` (`date`);