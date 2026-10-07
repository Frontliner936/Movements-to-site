ALTER TABLE `gm_jobs` ADD `company_description` text;--> statement-breakpoint
ALTER TABLE `gm_jobs` ADD `company_logo_url` varchar(2048);--> statement-breakpoint
ALTER TABLE `gm_jobs` ADD `company_website_url` varchar(2048);--> statement-breakpoint
ALTER TABLE `gm_pending_jobs` ADD `company_description` text;--> statement-breakpoint
ALTER TABLE `gm_pending_jobs` ADD `company_logo_url` varchar(2048);--> statement-breakpoint
ALTER TABLE `gm_pending_jobs` ADD `company_website_url` varchar(2048);