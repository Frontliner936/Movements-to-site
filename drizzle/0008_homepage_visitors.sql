CREATE TABLE `gm_home_viewers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `visitor_key` varchar(64) NOT NULL,
  `first_viewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_viewed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `gm_home_viewers_id` PRIMARY KEY(`id`),
  CONSTRAINT `gm_home_viewer_unique` UNIQUE(`visitor_key`)
);
