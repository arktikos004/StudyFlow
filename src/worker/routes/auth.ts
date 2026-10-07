import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../../shared/schemas';
import { users } from '../db/schema';
import { createSession, destroyOtherSessions, destroySession } from '../lib/auth-session';
import { hasValues } from '../lib/db';
import { hashPassword, verifyLoginPassword, verifyPassword } from '../lib/password';
import * as rateLimit from '../lib/rate-limit';
import { publicUser } from '../lib/users';
import { recordAchievementUnlocks } from '../middleware/achievement-unlocks';
import { clearSessionCookie, getSessionToken, requireAuth, setSessionCookie } from '../middleware/auth';
import { validate } from '../middleware/validate';
import type { AppEnv } from '../types';

/** 拿不到來源 IP 的請求（本機開發、測試）共用同一個計數 */
const UNKNOWN_IP = 'unknown';

const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') ?? UNKNOWN_IP;

export const authRoutes = new Hono<AppEnv>()
	.post('/register', validate('json', registerSchema), async (c) => {
		const db = c.var.db;
		const { email, password, displayName } = c.req.valid('json');
		const ip = clientIp(c.req.raw);
		await rateLimit.assertNotLimited(db, rateLimit.REGISTER_BY_IP, ip);
		await rateLimit.hit(db, rateLimit.REGISTER_BY_IP, ip);

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
		const ip = clientIp(c.req.raw);
		await rateLimit.assertNotLimited(db, rateLimit.LOGIN_BY_EMAIL, email);
		await rateLimit.assertNotLimited(db, rateLimit.LOGIN_BY_IP, ip);

		const user = await db.select().from(users).where(eq(users.email, email)).get();
		const passwordOk = await verifyLoginPassword(password, user?.passwordHash);
		if (!user || !passwordOk) {
			await rateLimit.hit(db, rateLimit.LOGIN_BY_EMAIL, email);
			await rateLimit.hit(db, rateLimit.LOGIN_BY_IP, ip);
			throw new HTTPException(401, { message: 'Email 或密碼錯誤' });
		}

		await rateLimit.reset(db, rateLimit.LOGIN_BY_EMAIL, email);
		const session = await createSession(db, user.id);
		setSessionCookie(c, session.token, session.expiresAt);
		return c.json({ user: publicUser(user) });
	})
	.post('/logout', async (c) => {
		const token = getSessionToken(c);
		if (token) await destroySession(c.var.db, token);
		clearSessionCookie(c);
		return c.json({ ok: true });
	})
	.get('/me', requireAuth, (c) => c.json({ user: publicUser(c.var.user) }))
	// 每日目標與時區會改變學習紀錄的成就（「說到做到」、連續天數）
	.patch('/me', requireAuth, recordAchievementUnlocks('study'), validate('json', updateProfileSchema), async (c) => {
		const input = c.req.valid('json');
		if (!hasValues(input)) return c.json({ user: publicUser(c.var.user) });
		const user = await c.var.db.update(users).set(input).where(eq(users.id, c.var.user.id)).returning().get();
		// 後面的 middleware（成就的解鎖時間）要用更新後的每日目標與時區
		c.set('user', user);
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
		await destroyOtherSessions(db, c.var.user.id, c.var.sessionId);
		return c.json({ ok: true });
	});
