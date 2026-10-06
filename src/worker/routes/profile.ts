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
		totalMinutes: Math.round(progress.seconds / 60),
		totalSessions: progress.sessions,
		currentStreak: progress.currentStreak,
		longestStreak: progress.longestStreak,
		tasksDone: progress.tasksDone,
		mistakesMastered: progress.mistakesMastered,
		achievements: { unlocked: badges.length, total: achievements.length, badges },
	};
	return c.json(body);
});
