ALTER TABLE `notes` ADD `mastered_review_days` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `mastered_review_days` integer;--> statement-breakpoint
CREATE INDEX `login_attempts_window_idx` ON `login_attempts` (`window_start`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);