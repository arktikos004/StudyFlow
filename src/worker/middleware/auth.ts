import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { authenticateSession } from '../lib/auth-session';
import type { AppEnv } from '../types';

const SESSION_COOKIE = 'sf_session';

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

/** 需要登入的路由：把登入中的使用者放進 c.var.user；沒有登入或登入過期回 401 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	const token = getSessionToken(c);
	const session = token ? await authenticateSession(c.var.db, token) : null;
	if (!token || !session) {
		if (token) clearSessionCookie(c);
		throw new HTTPException(401, { message: '請先登入' });
	}
	if (session.renewedExpiresAt) setSessionCookie(c, token, session.renewedExpiresAt);
	c.set('user', session.user);
	c.set('sessionId', session.sessionId);
	await next();
});
