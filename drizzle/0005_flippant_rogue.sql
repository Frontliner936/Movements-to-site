CREATE TABLE `gm_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`kind` enum('interview','event','ad','business','news') NOT NULL DEFAULT 'news',
	`body` text,
	`image_url` varchar(2048),
	`image_caption` varchar(600),
	`pdf_url` varchar(2048),
	`pdf_name` varchar(240),
	`link_url` varchar(2048),
	`link_label` varchar(120),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_announcements_id` PRIMARY KEY(`id`)
);
