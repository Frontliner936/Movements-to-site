CREATE TABLE `gm_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(240) NOT NULL,
	`slug` varchar(280) NOT NULL,
	`description` text,
	`logo_url` varchar(2048),
	`website_url` varchar(2048),
	`location` varchar(240),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `gm_job_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`visitor_key` varchar(64) NOT NULL,
	`kind` enum('like','save') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gm_job_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_reaction_unique` UNIQUE(`job_id`,`visitor_key`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `gm_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`company_id` int,
	`company_name` varchar(240),
	`category` varchar(120),
	`location` varchar(240),
	`deadline` varchar(240),
	`description` text,
	`responsibilities` text,
	`qualifications` text,
	`how_to_apply` text,
	`application_url` varchar(2048),
	`image_url` varchar(2048),
	`source_url` varchar(2048),
	`source_id` int,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gm_pending_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_id` int NOT NULL,
	`source_name` varchar(240) NOT NULL,
	`source_fingerprint` varchar(64) NOT NULL,
	`source_url` varchar(2048),
	`title` varchar(300) NOT NULL,
	`company_name` varchar(240),
	`category` varchar(120),
	`location` varchar(240),
	`deadline` varchar(240),
	`description` text,
	`responsibilities` text,
	`qualifications` text,
	`how_to_apply` text,
	`application_url` varchar(2048),
	`image_url` varchar(2048),
	`raw_context` text,
	`duplicate_matches` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_pending_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_pending_jobs_source_fingerprint_unique` UNIQUE(`source_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `gm_scan_schedules` (
	`id` int NOT NULL,
	`heartbeat_task_uid` varchar(80),
	`cron_expression` varchar(120) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`last_run_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_scan_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gm_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(240) NOT NULL,
	`type` enum('rss','json','career','scraper') NOT NULL,
	`url` varchar(2048) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`settings` text,
	`last_run_at` timestamp,
	`last_run_error` text,
	`last_run_count` int NOT NULL DEFAULT 0,
	`total_jobs_found` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_sources_id` PRIMARY KEY(`id`)
);
