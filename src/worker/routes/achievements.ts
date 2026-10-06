import { Hono } from 'hono';
import { achievementList, loadProgress } from '../lib/achievements';
import { requireAuth } from '../middleware/auth';
import type { AchievementsResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

// 成就由現有資料即時計算（lib/achievements.ts），個人檔案的摘要也用同一份計算，數字一定一致
export const achievementRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const body: AchievementsResponse = { achievements: achievementList(await loadProgress(c.var.db, c.var.user)) };
	return c.json(body);
});
