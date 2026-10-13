CREATE TABLE IF NOT EXISTS `gm_geo_visitor_totals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country_code` varchar(2) NOT NULL,
	`country` varchar(100) NOT NULL,
	`region_code` varchar(32) NOT NULL DEFAULT '',
	`region` varchar(120) NOT NULL DEFAULT '',
	`total` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_geo_visitor_totals_id` PRIMARY KEY(`id`),
	CONSTRAINT `gm_geo_visitor_region_unique` UNIQUE(`country_code`,`region_code`)
);
