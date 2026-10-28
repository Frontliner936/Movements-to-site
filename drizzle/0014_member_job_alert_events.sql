CREATE TABLE `gm_member_job_alert_events` (
	`job_id` int NOT NULL,
	`status` enum('pending','processed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` timestamp,
	CONSTRAINT `gm_member_job_alert_events_job_id` PRIMARY KEY(`job_id`)
);
--> statement-breakpoint
ALTER TABLE `gm_member_job_alert_events` ADD CONSTRAINT `gm_member_job_alert_events_job_id_gm_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `gm_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `gm_member_job_alert_event_pending` ON `gm_member_job_alert_events` (`status`,`created_at`);