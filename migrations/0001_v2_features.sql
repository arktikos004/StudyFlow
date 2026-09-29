ALTER TABLE `notes` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `weekly_goal_minutes` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `checklist` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `tasks_event_idx` ON `tasks` (`event_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `daily_goal_minutes` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `weekly_goal_minutes` integer;--> statement-breakpoint
CREATE INDEX `attachments_user_idx` ON `attachments` (`user_id`);--> statement-breakpoint
CREATE INDEX `study_sessions_task_idx` ON `study_sessions` (`task_id`);--> statement-breakpoint
-- 補值：每位使用者的科目依建立時間（相同時再比 id）排成 0、1、2…
UPDATE `subjects` SET `sort_order` = (
	SELECT count(*) FROM `subjects` AS `prev`
	WHERE `prev`.`user_id` = `subjects`.`user_id`
		AND (`prev`.`created_at` < `subjects`.`created_at` OR (`prev`.`created_at` = `subjects`.`created_at` AND `prev`.`id` < `subjects`.`id`))
);