CREATE TABLE `gm_site_metrics` (
	`metric_key` varchar(80) NOT NULL,
	`total` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gm_site_metrics_metric_key` PRIMARY KEY(`metric_key`)
);
