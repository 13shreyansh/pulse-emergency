CREATE TABLE `dispatch_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`step` enum('voice_captured','transcription_complete','classification_complete','hospital_search_complete','scraping_started','scraping_complete','hospital_selected','call_initiated','call_connected','call_completed','cpr_guidance_started','error') NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispatch_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emergency_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`status` enum('recording','classifying','searching','scraping','dispatching','completed','failed') NOT NULL DEFAULT 'recording',
	`transcript` text,
	`emergencyType` varchar(64),
	`severity` enum('critical','high','moderate'),
	`classification` json,
	`latitude` text,
	`longitude` text,
	`hospitalsFound` json,
	`selectedHospitalName` text,
	`selectedHospitalPhone` varchar(32),
	`scrapingResults` json,
	`vapiCallId` varchar(128),
	`callStatus` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`totalDurationMs` bigint,
	CONSTRAINT `emergency_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `emergency_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
