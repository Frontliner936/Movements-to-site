CREATE TABLE `gm_member_job_alert_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`member_id` int NOT NULL,
	`job_id` int NOT NULL,
	`status` enum('pending','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`next_attempt_at` timestamp NOT NULL DEFAULT (now()),
	`attempted_at` timestamp,
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_member_job_alert_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_member_job_alert_delivery_unique` UNIQUE(`member_id`,`job_id`)
);
--> statement-breakpoint
ALTER TABLE `gm_member_accounts` ADD `email_alerts_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `gm_member_job_alert_deliveries` ADD CONSTRAINT `gm_member_job_alert_deliveries_member_id_gm_member_accounts_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gm_member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gm_member_job_alert_deliveries` ADD CONSTRAINT `gm_member_job_alert_deliveries_job_id_gm_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `gm_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `gm_member_job_alert_delivery_pending` ON `gm_member_job_alert_deliveries` (`status`,`next_attempt_at`);