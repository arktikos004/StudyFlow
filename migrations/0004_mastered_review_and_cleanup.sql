ALTER TABLE `notes` ADD `mastered_review_days` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `mastered_review_days` integer;--> statement-breakpoint
CREATE INDEX `login_attempts_window_idx` ON `login_attempts` (`window_start`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
-- 從這版起，已掌握的題目只有使用者選擇定期複習時才有複習日（預設不提醒）；
-- 舊資料裡已掌握卻還留著的複習日（介面不會產生，只有直接呼叫 API 才可能有）清掉，避免更新後突然出現在今天到期。
UPDATE `notes` SET `next_review_date` = NULL WHERE `mastered` = 1 AND `next_review_date` IS NOT NULL;
