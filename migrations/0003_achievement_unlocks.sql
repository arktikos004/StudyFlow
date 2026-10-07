CREATE TABLE `achievement_unlocks` (
	`user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `achievement_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
