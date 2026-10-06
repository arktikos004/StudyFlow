import { Hono } from 'hono';
import { achievementList, loadProgress } from '../lib/achievements';
import { requireAuth } from '../middleware/auth';
import type { ProfileSummary } from '../../shared/api-types';
import type { AppEnv } from '../types';

/** 個人檔案（PRO-1）：累積的學習成果，只有本人的資料；和成就頁用同一份計算（lib/achievements.ts） */
export const profileRoutes = new Hono<AppEnv>().use(requireAuth).get('/summary', async (c) => {
	const progress = await loadProgress(c.var.db, c.var.user);
	const achievements = achievementList(progress);
	const badges = achievements.filter((a) => a.unlocked).map(({ id, title, icon }) => ({ id, title, icon }));
	const body: ProfileSummary = {
		// 無條件捨去：前端用 floor(分鐘 / 6) / 10 換算時數，結果才會和成就頁的 floor1(秒 / 3600) 完全一致
		// （四捨五入時，每 6 分鐘的最後 30 秒會比成就頁多 0.1 小時，例如 3599 秒變成 1 小時）
		totalMinutes: Math.floor(progress.seconds / 60),
		totalSessions: progress.sessions,
		currentStreak: progress.currentStreak,
		longestStreak: progress.longestStreak,
		tasksDone: progress.tasksDone,
		mistakesMastered: progress.mistakesMastered,
		achievements: { unlocked: badges.length, total: achievements.length, badges },
	};
	return c.json(body);
});
