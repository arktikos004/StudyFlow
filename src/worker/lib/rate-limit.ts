import { eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { HOUR_MS, MINUTE_MS } from '../../shared/time';
import { loginAttempts } from '../db/schema';
import type { DB } from './db';

// 簡單的固定視窗計數器，存在 D1：同一個對象在時間窗內超過上限就拒絕

/** 一條限制：prefix 加上對象（IP 或 Email）就是計數的 key */
export type RateLimitRule = { prefix: string; max: number; windowMs: number };

export const REGISTER_BY_IP: RateLimitRule = { prefix: 'register:ip:', max: 10, windowMs: HOUR_MS };
export const LOGIN_BY_EMAIL: RateLimitRule = { prefix: 'login:email:', max: 10, windowMs: 15 * MINUTE_MS };
export const LOGIN_BY_IP: RateLimitRule = { prefix: 'login:ip:', max: 50, windowMs: 15 * MINUTE_MS };

const keyOf = (rule: RateLimitRule, subject: string) => rule.prefix + subject;

/** 時間窗內已經達到上限就丟 429，並告訴使用者還要等幾分鐘 */
export async function assertNotLimited(db: DB, rule: RateLimitRule, subject: string) {
	const row = await db
		.select()
		.from(loginAttempts)
		.where(eq(loginAttempts.key, keyOf(rule, subject)))
		.get();
	if (row && Date.now() - row.windowStart < rule.windowMs && row.count >= rule.max) {
		const retryMin = Math.ceil((row.windowStart + rule.windowMs - Date.now()) / MINUTE_MS);
		throw new HTTPException(429, { message: `嘗試次數過多，請 ${retryMin} 分鐘後再試` });
	}
}

/** 記一次；時間窗已過就重新計數 */
export async function hit(db: DB, rule: RateLimitRule, subject: string) {
	const now = Date.now();
	const windowExpired = sql`${now} - ${loginAttempts.windowStart} >= ${rule.windowMs}`;
	await db
		.insert(loginAttempts)
		.values({ key: keyOf(rule, subject), count: 1, windowStart: now })
		.onConflictDoUpdate({
			target: loginAttempts.key,
			set: {
				count: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${loginAttempts.count} + 1 END`,
				windowStart: sql`CASE WHEN ${windowExpired} THEN ${now} ELSE ${loginAttempts.windowStart} END`,
			},
		});
}

export async function reset(db: DB, rule: RateLimitRule, subject: string) {
	await db.delete(loginAttempts).where(eq(loginAttempts.key, keyOf(rule, subject)));
}
