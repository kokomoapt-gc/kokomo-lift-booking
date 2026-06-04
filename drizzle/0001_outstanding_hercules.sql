CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(50) NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`roomNumber` varchar(50) NOT NULL,
	`requestedDate` varchar(20) NOT NULL,
	`requestedStartTime` varchar(10) NOT NULL,
	`requestedDurationMinutes` int NOT NULL,
	`notes` text,
	`status` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
	`confirmedDate` varchar(20),
	`confirmedStartTime` varchar(10),
	`calendarEventId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
