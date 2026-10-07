import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { users } from '../db/schema';
import { recordUnlockChanges, unlockedIds } from '../lib/achievements';
import type { AppEnv } from '../types';

/**
 * 記錄成就的解鎖時間（PRO-2），放在 requireAuth 之後。掛在會改變成就進度的寫入上：
 * 學習紀錄、任務、筆記，以及個人資料（每日目標影響「說到做到」、時區影響連續天數）。
 * 寫入前後各算一次已解鎖的成就，寫入成功才比對；讀取（GET）直接放行，只讀不寫。
 */
export const recordAchievementUnlocks = createMiddleware<AppEnv>(async (c, next) => {
	if (c.req.method === 'GET') return next();
	const db = c.var.db;
	const before = await unlockedIds(db, c.var.user);
	await next();
	if (!c.res.ok) return;
	// 改了每日目標或時區時，c.var.user 還是寫入前的資料：重新讀一次
	const user = (await db.select().from(users).where(eq(users.id, c.var.user.id)).get()) ?? c.var.user;
	await recordUnlockChanges(db, user.id, before, await unlockedIds(db, user), Date.now());
});
