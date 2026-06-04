ALTER TABLE `bookings` ADD `settlementConfirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `settlementDate` varchar(20);