import { eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { loginAttempts } from '../db/schema';
import type { DB } from './db';

// 簡單的固定視窗計數器，存在 D1：同一個 key 在時間窗內超過上限就拒絕

export async function assertNotLimited(db: DB, key: string, max: number, windowMs: number) {
	const row = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).get();
	if (row && Date.now() - row.windowStart < windowMs && row.count >= max) {
		const retryMin = Math.ceil((row.windowStart + windowMs - Date.now()) / 60_000);
		throw new HTTPException(429, { message: `嘗試次數過多，請 ${retryMin} 分鐘後再試` });
	}
}

export async function hit(db: DB, key: string, windowMs: number) {
	const now = Date.now();
	await db
		.insert(loginAttempts)
		.values({ key, count: 1, windowStart: now })
		.onConflictDoUpdate({
			target: loginAttempts.key,
			set: {
				// 時間窗已過就重新計數
				count: sql`CASE WHEN ${now} - ${loginAttempts.windowStart} >= ${windowMs} THEN 1 ELSE ${loginAttempts.count} + 1 END`,
				windowStart: sql`CASE WHEN ${now} - ${loginAttempts.windowStart} >= ${windowMs} THEN ${now} ELSE ${loginAttempts.windowStart} END`,
			},
		});
}

export async function reset(db: DB, key: string) {
	await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
