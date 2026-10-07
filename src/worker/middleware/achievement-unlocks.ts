import { createMiddleware } from 'hono/factory';
import { recordUnlockChanges, unlockedIdsFrom, type AchievementSource } from '../lib/achievements';
import type { AppEnv } from '../types';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 記錄成就的解鎖時間（PRO-2），放在 requireAuth 之後、會改變成就進度的寫入路由上。
 * source 是這組路由會改變的資料來源：寫入前後各算一次「那一種來源」已解鎖的成就，寫入成功才比對。
 * 讀取（GET、HEAD）直接放行，只讀不寫。
 * 改個人資料的 handler 要把更新後的使用者放回 c.var.user：每日目標與時區會影響學習紀錄的成就。
 */
export const recordAchievementUnlocks = (source: AchievementSource) =>
	createMiddleware<AppEnv>(async (c, next) => {
		if (!WRITE_METHODS.has(c.req.method)) return next();
		const before = await unlockedIdsFrom(c.var.db, c.var.user, source);
		await next();
		if (!c.res.ok) return;
		const after = await unlockedIdsFrom(c.var.db, c.var.user, source);
		await recordUnlockChanges(c.var.db, c.var.user.id, before, after, Date.now());
	});
