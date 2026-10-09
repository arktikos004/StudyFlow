import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src/worker/index';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../src/shared/time';
import { registeredClient } from './helpers';

async function runDailyCleanup(now: number) {
	const ctx = createExecutionContext();
	await worker.scheduled(createScheduledController({ scheduledTime: new Date(now), cron: '0 19 * * *' }), env, ctx);
	await waitOnExecutionContext(ctx);
}

describe('每天的清理（Cron Trigger）', () => {
	it('刪掉過期的登入與過了計數區間的失敗紀錄，還有效的保留', async () => {
		const c = await registeredClient();
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(
				'expired',
				c.user.id,
				now - 1,
				now - 31 * DAY_MS,
			),
			env.DB.prepare('INSERT INTO login_attempts (key, count, window_start) VALUES (?, ?, ?)').bind('login:ip:old', 3, now - 2 * HOUR_MS),
			env.DB.prepare('INSERT INTO login_attempts (key, count, window_start) VALUES (?, ?, ?)').bind(
				'login:ip:recent',
				3,
				now - 10 * MINUTE_MS,
			),
		]);

		await runDailyCleanup(now);

		expect(await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind('expired').first()).toBeNull();
		expect((await c.get('/api/auth/me')).status).toBe(200);
		const keys = (await env.DB.prepare('SELECT key FROM login_attempts').all<{ key: string }>()).results.map((r) => r.key);
		expect(keys).toContain('login:ip:recent');
		expect(keys).not.toContain('login:ip:old');
	});
});
