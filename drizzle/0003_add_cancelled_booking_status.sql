ALTER TABLE `bookings` MODIFY COLUMN `status` enum('pending','confirmed','rejected','cancelled') NOT NULL DEFAULT 'pending';
