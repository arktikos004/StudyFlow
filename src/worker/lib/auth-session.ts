import { and, eq, ne } from 'drizzle-orm';
import { DAY_MS } from '../../shared/time';
import { authSessions, users, type User } from '../db/schema';
import type { DB } from './db';
import { sha256Hex, toBase64Url } from './encoding';

// 登入狀態（sessions 資料表的讀寫；cookie 在 middleware/auth.ts）。
// 「session」在這個專案有兩種：這裡是登入狀態，學習紀錄是 study session。

const SESSION_TTL_MS = 30 * DAY_MS;
// 剩不到一半有效期時自動延長，常用的人不會被登出
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

/** 資料庫只存 token 的 SHA-256：資料庫外洩也無法直接拿來登入 */
const sessionIdOf = (token: string) => sha256Hex(token);

/** 建立登入狀態，回傳要放進 cookie 的 token 與到期時間 */
export async function createSession(db: DB, userId: string) {
	const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const expiresAt = Date.now() + SESSION_TTL_MS;
	await db.insert(authSessions).values({ id: await sessionIdOf(token), userId, expiresAt });
	return { token, expiresAt };
}

/**
 * 用 cookie 裡的 token 找出登入中的使用者；token 不存在或已過期回傳 null。
 * 會寫入資料庫：過期的那一列順手刪掉；剩不到一半有效期時延長（滑動續期），
 * 並回傳 renewedExpiresAt 讓呼叫端更新 cookie 的到期時間。
 */
export async function authenticateSession(
	db: DB,
	token: string,
): Promise<{ user: User; sessionId: string; renewedExpiresAt?: number } | null> {
	const id = await sessionIdOf(token);
	const row = await db
		.select({ user: users, session: authSessions })
		.from(authSessions)
		.innerJoin(users, eq(authSessions.userId, users.id))
		.where(eq(authSessions.id, id))
		.get();
	if (!row) return null;

	const now = Date.now();
	if (row.session.expiresAt <= now) {
		await db.delete(authSessions).where(eq(authSessions.id, id));
		return null;
	}
	if (row.session.expiresAt - now < RENEW_THRESHOLD_MS) {
		const renewedExpiresAt = now + SESSION_TTL_MS;
		await db.update(authSessions).set({ expiresAt: renewedExpiresAt }).where(eq(authSessions.id, id));
		return { user: row.user, sessionId: id, renewedExpiresAt };
	}
	return { user: row.user, sessionId: id };
}

/** 登出：刪掉這個 token 的登入狀態 */
export async function destroySession(db: DB, token: string) {
	await db.delete(authSessions).where(eq(authSessions.id, await sessionIdOf(token)));
}

/** 登出其他裝置：刪掉這位使用者除了目前這一個以外的登入狀態（改密碼之後） */
export async function destroyOtherSessions(db: DB, userId: string, currentSessionId: string) {
	await db.delete(authSessions).where(and(eq(authSessions.userId, userId), ne(authSessions.id, currentSessionId)));
}
