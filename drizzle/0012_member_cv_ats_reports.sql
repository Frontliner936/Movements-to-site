CREATE TABLE `gm_member_cv_reports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `member_id` int NOT NULL,
  `score` int NOT NULL,
  `target_label` varchar(300) NOT NULL,
  `report_json` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `gm_member_cv_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gm_member_cv_reports` ADD CONSTRAINT `gm_member_cv_reports_member_id_gm_member_accounts_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gm_member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `gm_member_cv_report_member_created` ON `gm_member_cv_reports` (`member_id`,`created_at`);
