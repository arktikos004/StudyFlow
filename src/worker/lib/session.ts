import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sessions, users, type User } from '../db/schema';
import type { AppEnv } from '../types';
import type { DB } from './db';
import { sha256Hex, toBase64Url } from './encoding';

export const SESSION_COOKIE = 'sf_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// 剩不到一半有效期時自動延長，常用的人不會被登出
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

export async function createSession(db: DB, userId: string) {
	const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const id = await sha256Hex(token);
	const expiresAt = Date.now() + SESSION_TTL_MS;
	await db.insert(sessions).values({ id, userId, expiresAt });
	return { token, id, expiresAt };
}

export async function validateSession(db: DB, token: string): Promise<{ user: User; sessionId: string; renewedExpiresAt?: number } | null> {
	const id = await sha256Hex(token);
	const row = await db
		.select({ user: users, session: sessions })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;

	const now = Date.now();
	if (row.session.expiresAt <= now) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	if (row.session.expiresAt - now < RENEW_THRESHOLD_MS) {
		const renewedExpiresAt = now + SESSION_TTL_MS;
		await db.update(sessions).set({ expiresAt: renewedExpiresAt }).where(eq(sessions.id, id));
		return { user: row.user, sessionId: id, renewedExpiresAt };
	}
	return { user: row.user, sessionId: id };
}

export function setSessionCookie(c: Context<AppEnv>, token: string, expiresAt: number) {
	setCookie(c, SESSION_COOKIE, token, {
		httpOnly: true,
		// 本機 http 開發時不能設 Secure，正式環境一律 https
		secure: new URL(c.req.url).protocol === 'https:',
		sameSite: 'Lax',
		path: '/',
		expires: new Date(expiresAt),
	});
}

export function clearSessionCookie(c: Context<AppEnv>) {
	deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function getSessionToken(c: Context<AppEnv>) {
	return getCookie(c, SESSION_COOKIE);
}
