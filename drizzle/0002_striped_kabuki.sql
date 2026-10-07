CREATE TABLE `gm_job_viewers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`visitor_key` varchar(64) NOT NULL,
	`first_viewed_at` timestamp NOT NULL DEFAULT (now()),
	`last_viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gm_job_viewers_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_job_viewer_unique` UNIQUE(`job_id`,`visitor_key`)
);
--> statement-breakpoint
ALTER TABLE `gm_job_viewers` ADD CONSTRAINT `gm_job_viewers_job_id_gm_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `gm_jobs`(`id`) ON DELETE cascade ON UPDATE no action;