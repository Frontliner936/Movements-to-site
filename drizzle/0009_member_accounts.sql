CREATE TABLE `gm_member_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`password_hash` varchar(128) NOT NULL,
	`password_salt` varchar(64) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`alert_categories` text,
	`alert_locations` text,
	`alerts_enabled` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_signed_in` timestamp,
	CONSTRAINT `gm_member_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_member_accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `gm_member_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`member_id` int NOT NULL,
	`job_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gm_member_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_member_favorite_unique` UNIQUE(`member_id`,`job_id`)
);
--> statement-breakpoint
ALTER TABLE `gm_member_favorites` ADD CONSTRAINT `gm_member_favorites_member_id_gm_member_accounts_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gm_member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gm_member_favorites` ADD CONSTRAINT `gm_member_favorites_job_id_gm_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `gm_jobs`(`id`) ON DELETE cascade ON UPDATE no action;