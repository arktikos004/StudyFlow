import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { clearSessionCookie, getSessionToken, setSessionCookie, validateSession } from '../lib/session';
import type { AppEnv } from '../types';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
	const token = getSessionToken(c);
	const result = token ? await validateSession(c.var.db, token) : null;
	if (!result) {
		if (token) clearSessionCookie(c);
		throw new HTTPException(401, { message: '請先登入' });
	}
	if (result.renewedExpiresAt && token) setSessionCookie(c, token, result.renewedExpiresAt);
	c.set('user', result.user);
	c.set('sessionId', result.sessionId);
	await next();
});
