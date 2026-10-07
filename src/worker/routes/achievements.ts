import { Hono } from 'hono';
import { loadAchievements } from '../lib/achievements';
import { requireAuth } from '../middleware/auth';
import type { AchievementsResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

// 成就由現有資料即時計算（lib/achievements.ts），加上記錄下來的解鎖時間；個人檔案的摘要也用同一份計算，數字一定一致
export const achievementRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const { achievements } = await loadAchievements(c.var.db, c.var.user);
	const body: AchievementsResponse = { achievements };
	return c.json(body);
});
