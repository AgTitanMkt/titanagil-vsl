CREATE TABLE `api_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text,
	`description` varchar(500),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `api_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(50) NOT NULL,
	`syncType` varchar(100) NOT NULL,
	`status` enum('pending','running','success','error') NOT NULL DEFAULT 'pending',
	`dateFrom` date,
	`dateTo` date,
	`recordsProcessed` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `api_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vsl_performance_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vslId` int NOT NULL,
	`date` date NOT NULL,
	`revenue` decimal(12,2) DEFAULT '0',
	`cost` decimal(12,2) DEFAULT '0',
	`profit` decimal(12,2) DEFAULT '0',
	`clicks` int DEFAULT 0,
	`conversions` int DEFAULT 0,
	`totalPlays` int DEFAULT 0,
	`uniquePlays` int DEFAULT 0,
	`watchRate` decimal(5,2) DEFAULT '0',
	`avgWatchTime` int DEFAULT 0,
	`retentionData` json,
	`quartile25` int DEFAULT 0,
	`quartile50` int DEFAULT 0,
	`quartile75` int DEFAULT 0,
	`quartile100` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vsl_performance_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `vsl_date_idx` UNIQUE(`vslId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `vsls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalizedName` varchar(255) NOT NULL,
	`groupName` varchar(255),
	`product` varchar(255),
	`vturbPlayerId` varchar(255),
	`redtrackLandingId` varchar(255),
	`redtrackLandingName` varchar(255),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vsls_id` PRIMARY KEY(`id`)
);
