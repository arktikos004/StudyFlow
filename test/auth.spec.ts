import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createClient, registeredClient } from './helpers';

describe('註冊與登入', () => {
	it('註冊後自動登入，可取得自己的資料', async () => {
		const client = await registeredClient('小明');
		expect(client.cookie).toMatch(/^sf_session=/);
		const me = await client.get('/api/auth/me');
		expect(me.status).toBe(200);
		expect(me.data.user).toMatchObject({ displayName: '小明', email: client.email, timezone: 'Asia/Taipei' });
		expect(me.data.user.passwordHash).toBeUndefined();
	});

	it('密碼以 PBKDF2 雜湊儲存，session 只存 token 的雜湊', async () => {
		const client = await registeredClient();
		const row = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?')
			.bind(client.email)
			.first<{ password_hash: string }>();
		expect(row!.password_hash).toMatch(/^pbkdf2_sha256\$100000\$/);
		const token = client.cookie.split('=')[1];
		const raw = await env.DB.prepare('SELECT count(*) AS n FROM sessions WHERE id = ?').bind(token).first<{ n: number }>();
		expect(raw!.n).toBe(0);
	});

	it('Email 不分大小寫，重複註冊回傳 409', async () => {
		const client = await registeredClient();
		const again = await createClient().post('/api/auth/register', {
			email: client.email.toUpperCase(),
			password: 'another-password',
			displayName: '冒牌貨',
		});
		expect(again.status).toBe(409);
	});

	it('拒絕太短的密碼與錯誤的 Email', async () => {
		const c = createClient();
		expect((await c.post('/api/auth/register', { email: 'a@b.co', password: 'short', displayName: 'x' })).status).toBe(400);
		const bad = await c.post('/api/auth/register', { email: 'not-an-email', password: 'long-enough-pw', displayName: 'x' });
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('Email 格式錯誤');
	});

	it('登入、登出流程', async () => {
		const client = await registeredClient();
		await client.post('/api/auth/logout');
		expect(client.cookie).toBe('');
		expect((await client.get('/api/auth/me')).status).toBe(401);

		const wrong = await client.post('/api/auth/login', { email: client.email, password: 'wrong-password' });
		expect(wrong.status).toBe(401);
		expect(wrong.data.error).toBe('Email 或密碼錯誤');

		const ok = await client.post('/api/auth/login', { email: client.email, password: 'correct-horse-battery' });
		expect(ok.status).toBe(200);
		expect((await client.get('/api/auth/me')).status).toBe(200);
	});

	it('登出後舊 cookie 失效', async () => {
		const client = await registeredClient();
		const stolen = client.cookie;
		await client.post('/api/auth/logout');
		client.cookie = stolen;
		expect((await client.get('/api/auth/me')).status).toBe(401);
	});

	it('過期的 session 會被拒絕', async () => {
		const client = await registeredClient();
		await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
			.bind(Date.now() - 1, client.user.id)
			.run();
		expect((await client.get('/api/auth/me')).status).toBe(401);
	});

	it('同一帳號連續登入失敗 10 次後暫時鎖定', async () => {
		const client = await registeredClient();
		await client.post('/api/auth/logout');
		for (let i = 0; i < 10; i++) {
			expect((await client.post('/api/auth/login', { email: client.email, password: `wrong-${i}` })).status).toBe(401);
		}
		const locked = await client.post('/api/auth/login', { email: client.email, password: 'correct-horse-battery' });
		expect(locked.status).toBe(429);
	});

	it('更改密碼需要正確的舊密碼，並登出其他裝置', async () => {
		const phone = await registeredClient();
		const laptop = createClient();
		await laptop.post('/api/auth/login', { email: phone.email, password: 'correct-horse-battery' });

		const bad = await phone.post('/api/auth/password', { currentPassword: 'nope', newPassword: 'new-password-123' });
		expect(bad.status).toBe(400);
		const ok = await phone.post('/api/auth/password', { currentPassword: 'correct-horse-battery', newPassword: 'new-password-123' });
		expect(ok.status).toBe(200);

		expect((await phone.get('/api/auth/me')).status).toBe(200);
		expect((await laptop.get('/api/auth/me')).status).toBe(401);
	});

	it('可以更新暱稱與時區，但拒絕不存在的時區', async () => {
		const client = await registeredClient();
		const ok = await client.patch('/api/auth/me', { displayName: '新暱稱', timezone: 'Asia/Tokyo' });
		expect(ok.data.user).toMatchObject({ displayName: '新暱稱', timezone: 'Asia/Tokyo' });
		expect((await client.patch('/api/auth/me', { timezone: 'Mars/Olympus' })).status).toBe(400);
	});

	it('未登入不能存取任何資料', async () => {
		const anon = createClient();
		for (const path of [
			'/api/subjects',
			'/api/events',
			'/api/tasks',
			'/api/notes',
			'/api/study-sessions',
			'/api/stats',
			'/api/dashboard',
		]) {
			expect((await anon.get(path)).status, path).toBe(401);
		}
	});
});

describe('安全性', () => {
	it('跨站的表單請求會被 CSRF 保護擋下', async () => {
		const client = await registeredClient();
		const res = await client.post('/api/notes/x/attachments', new FormData(), { origin: 'https://evil.example' });
		expect(res.status).toBe(403);
	});

	it('API 回應帶有安全標頭且不被快取', async () => {
		const res = await createClient().get('/api/health');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
});
