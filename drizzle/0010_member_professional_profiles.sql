CREATE TABLE `gm_member_profiles` (
	`member_id` int NOT NULL,
	`full_name` varchar(150) NOT NULL DEFAULT '',
	`phone_number` varchar(40) NOT NULL DEFAULT '',
	`location` varchar(160) NOT NULL DEFAULT '',
	`profession` varchar(160) NOT NULL DEFAULT '',
	`directory_opt_in` boolean NOT NULL DEFAULT false,
	`cv_file_name` varchar(255),
	`cv_mime_type` varchar(100),
	`cv_data` mediumblob,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_member_profiles_member_id` PRIMARY KEY(`member_id`)
);
--> statement-breakpoint
ALTER TABLE `gm_member_profiles` ADD CONSTRAINT `gm_member_profiles_member_id_gm_member_accounts_id_fk` FOREIGN KEY (`member_id`) REFERENCES `gm_member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;