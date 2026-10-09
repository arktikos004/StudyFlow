import { lte } from 'drizzle-orm';
import { authSessions, loginAttempts } from '../db/schema';
import type { DB } from './db';
import { LONGEST_WINDOW_MS } from './rate-limit';

/**
 * 每天清掉用不到的資料（Cron Trigger，見 wrangler.jsonc 的 triggers）：
 * - 過期的登入：過期後就不能再用，留著只佔空間。
 * - 登入、註冊的失敗計數：已經過了最長的計數區間，不會再影響頻率限制（被大量嘗試時會一直增加）。
 * 兩個條件都走 0004 新增的 index。
 */
export async function deleteExpired(db: DB, now = Date.now()): Promise<void> {
	await db.batch([
		db.delete(authSessions).where(lte(authSessions.expiresAt, now)),
		db.delete(loginAttempts).where(lte(loginAttempts.windowStart, now - LONGEST_WINDOW_MS)),
	]);
}
