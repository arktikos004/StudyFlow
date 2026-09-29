import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../../shared/schemas';
import { sessions, users, type User } from '../db/schema';
import { fakeVerify, hashPassword, verifyPassword } from '../lib/password';
import * as rateLimit from '../lib/rate-limit';
import { clearSessionCookie, createSession, getSessionToken, setSessionCookie } from '../lib/session';
import { validate } from '../lib/validator';
import { sha256Hex } from '../lib/encoding';
import { requireAuth } from '../middleware/auth';
import type { PublicUser } from '../../shared/api-types';
import type { AppEnv } from '../types';

const WINDOW_15M = 15 * 60 * 1000;
const WINDOW_1H = 60 * 60 * 1000;

export function publicUser(u: User): PublicUser {
	return { id: u.id, email: u.email, displayName: u.displayName, timezone: u.timezone, createdAt: u.createdAt };
}

function clientIp(req: Request) {
	return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

export const authRoutes = new Hono<AppEnv>()
	.post('/register', validate('json', registerSchema), async (c) => {
		const db = c.var.db;
		const { email, password, displayName } = c.req.valid('json');
		const ipKey = `register:ip:${clientIp(c.req.raw)}`;
		await rateLimit.assertNotLimited(db, ipKey, 10, WINDOW_1H);
		await rateLimit.hit(db, ipKey, WINDOW_1H);

		const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
		if (existing) throw new HTTPException(409, { message: '此 Email 已經註冊過了' });

		const user = await db
			.insert(users)
			.values({ email, displayName, passwordHash: await hashPassword(password) })
			.returning()
			.get();
		const session = await createSession(db, user.id);
		setSessionCookie(c, session.token, session.expiresAt);
		return c.json({ user: publicUser(user) }, 201);
	})
	.post('/login', validate('json', loginSchema), async (c) => {
		const db = c.var.db;
		const { email, password } = c.req.valid('json');
		const emailKey = `login:email:${email}`;
		const ipKey = `login:ip:${clientIp(c.req.raw)}`;
		await rateLimit.assertNotLimited(db, emailKey, 10, WINDOW_15M);
		await rateLimit.assertNotLimited(db, ipKey, 50, WINDOW_15M);

		const user = await db.select().from(users).where(eq(users.email, email)).get();
		const ok = user ? await verifyPassword(password, user.passwordHash) : (await fakeVerify(password), false);
		if (!user || !ok) {
			await rateLimit.hit(db, emailKey, WINDOW_15M);
			await rateLimit.hit(db, ipKey, WINDOW_15M);
			throw new HTTPException(401, { message: 'Email 或密碼錯誤' });
		}

		await rateLimit.reset(db, emailKey);
		const session = await createSession(db, user.id);
		setSessionCookie(c, session.token, session.expiresAt);
		return c.json({ user: publicUser(user) });
	})
	.post('/logout', async (c) => {
		const token = getSessionToken(c);
		if (token) await c.var.db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
		clearSessionCookie(c);
		return c.json({ ok: true });
	})
	.get('/me', requireAuth, (c) => c.json({ user: publicUser(c.var.user) }))
	.patch('/me', requireAuth, validate('json', updateProfileSchema), async (c) => {
		const input = c.req.valid('json');
		const user = await c.var.db.update(users).set(input).where(eq(users.id, c.var.user.id)).returning().get();
		return c.json({ user: publicUser(user) });
	})
	.post('/password', requireAuth, validate('json', changePasswordSchema), async (c) => {
		const db = c.var.db;
		const { currentPassword, newPassword } = c.req.valid('json');
		if (!(await verifyPassword(currentPassword, c.var.user.passwordHash))) {
			throw new HTTPException(400, { message: '目前密碼不正確' });
		}
		await db
			.update(users)
			.set({ passwordHash: await hashPassword(newPassword) })
			.where(eq(users.id, c.var.user.id));
		// 改密碼後登出其他裝置
		await db.delete(sessions).where(and(eq(sessions.userId, c.var.user.id), ne(sessions.id, c.var.sessionId)));
		return c.json({ ok: true });
	});
