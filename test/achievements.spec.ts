import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/shared/dates';
import { createClient, logSession, noonClient, registeredClient, type Client } from './helpers';

type Achievement = { id: string; title: string; description: string; icon: string; unlocked: boolean; progress: number; target: number };

const IDS = [
	'first-session',
	'hours-10',
	'hours-50',
	'hours-100',
	'streak-7',
	'streak-30',
	'pomodoro-25',
	'pomodoro-100',
	'mastered-10',
	'mastered-50',
	'tasks-50',
	'goal-streak-7',
];

async function achievements(c: Client): Promise<Record<string, Achievement>> {
	const res = await c.get('/api/achievements');
	expect(res.status).toBe(200);
	return Object.fromEntries(res.data.achievements.map((a: Achievement) => [a.id, a]));
}

describe('成就（APP-2）', () => {
	it('新使用者：12 個成就依固定順序列出，都還沒解鎖', async () => {
		const c = await registeredClient();
		const list: Achievement[] = (await c.get('/api/achievements')).data.achievements;
		expect(list.map((a) => a.id)).toEqual(IDS);
		for (const a of list) {
			expect(a).toMatchObject({ unlocked: false, progress: 0 });
			expect(a.title.length).toBeGreaterThan(0);
			expect(a.description.length).toBeGreaterThan(0);
			expect(a.icon).toMatch(/^[a-z]+(-[a-z]+)*$/);
			expect(a.target).toBeGreaterThan(0);
		}
	});

	it('第一筆紀錄、累積時數與番茄數；進度不超過目標', async () => {
		const c = await registeredClient();
		const now = Date.now();
		// 10 小時的手動補登 + 2 個 25 分鐘的番茄 = 10 小時 50 分
		await c.post('/api/study-sessions', { mode: 'manual', startedAt: now - 11 * 3_600_000, endedAt: now - 3_600_000 });
		for (const end of [now - 30 * 60_000, now - 60_000]) {
			await c.post('/api/study-sessions', { mode: 'pomodoro', startedAt: end - 25 * 60_000, endedAt: end });
		}
		const a = await achievements(c);
		expect(a['first-session']).toMatchObject({ unlocked: true, progress: 1, target: 1 });
		expect(a['hours-10']).toMatchObject({ unlocked: true, progress: 10, target: 10 });
		expect(a['hours-50']).toMatchObject({ unlocked: false, progress: 10.8, target: 50 });
		expect(a['pomodoro-25']).toMatchObject({ unlocked: false, progress: 2, target: 25 });
	});

	it('番茄鐘只計入 mode = pomodoro 而且至少 10 分鐘的紀錄', async () => {
		const c = await registeredClient();
		const now = Date.now();
		// 每筆的起訖都是 26 分鐘，實際秒數各不相同；時段彼此錯開
		const cases: [string, number][] = [
			['pomodoro', 25 * 60], // 算
			['pomodoro', 600], // 剛好 10 分鐘：算
			['pomodoro', 599], // 差 1 秒：不算
			['pomodoro', 60], // 提早結束的 1 分鐘：不算
			['stopwatch', 25 * 60], // 不是番茄鐘：不算
			['manual', 25 * 60], // 不是番茄鐘：不算
		];
		for (const [i, [mode, durationSec]] of cases.entries()) {
			const endedAt = now - (i + 1) * 30 * 60_000;
			const res = await c.post('/api/study-sessions', { mode, startedAt: endedAt - 26 * 60_000, endedAt, durationSec });
			expect(res.status, JSON.stringify(res.data)).toBe(201);
		}
		const a = await achievements(c);
		expect(a['pomodoro-25']).toMatchObject({ unlocked: false, progress: 2, target: 25 });
		expect(a['pomodoro-100']).toMatchObject({ unlocked: false, progress: 2, target: 100 });
		expect(a['pomodoro-25'].description).toContain('至少 10 分鐘');
		// 其他成就仍計入全部紀錄
		expect(a['first-session']).toMatchObject({ unlocked: true, progress: 1 });
	});

	it('差一點達標時不會顯示成已達成（小時數無條件捨去）', async () => {
		const c = await registeredClient();
		const end = Date.now() - 60_000;
		await c.post('/api/study-sessions', { mode: 'stopwatch', startedAt: end - 599 * 60_000, endedAt: end });
		expect((await achievements(c))['hours-10']).toMatchObject({ unlocked: false, progress: 9.9 });
	});

	it('連續讀書天數取歷史上最長的一段', async () => {
		const c = await noonClient();
		// 20 天前起連續 7 天，之後中斷；今天再讀一次
		for (let i = 0; i < 7; i++) await logSession(c, addDays(c.today, -20 + i), 9, 10);
		await logSession(c, c.today, 9, 10);
		const a = await achievements(c);
		expect(a['streak-7']).toMatchObject({ unlocked: true, progress: 7 });
		expect(a['streak-30']).toMatchObject({ unlocked: false, progress: 7, target: 30 });
	});

	it('掌握錯題只算錯題；完成的任務數', async () => {
		const c = await registeredClient();
		for (let i = 0; i < 10; i++) {
			const n = (await c.post('/api/notes', { kind: 'mistake', title: `錯題 ${i}` })).data.note;
			await c.patch(`/api/notes/${n.id}`, { mastered: true });
		}
		const plain = (await c.post('/api/notes', { kind: 'note', title: '一般筆記' })).data.note;
		await c.patch(`/api/notes/${plain.id}`, { mastered: true }); // 一般筆記不算

		// 49 個已完成的任務直接寫入資料庫，再用 API 完成第 50 個
		const now = Date.now();
		const insert = env.DB.prepare("INSERT INTO tasks (id, user_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'done', ?, ?)");
		await env.DB.batch(Array.from({ length: 49 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, `任務 ${i}`, now, now)));
		const last = (await c.post('/api/tasks', { title: '最後一個' })).data.task;

		let a = await achievements(c);
		expect(a['mastered-10']).toMatchObject({ unlocked: true, progress: 10 });
		expect(a['mastered-50']).toMatchObject({ unlocked: false, progress: 10 });
		expect(a['tasks-50']).toMatchObject({ unlocked: false, progress: 49 });

		await c.patch(`/api/tasks/${last.id}`, { status: 'done' });
		a = await achievements(c);
		expect(a['tasks-50']).toMatchObject({ unlocked: true, progress: 50 });
	});

	it('連續 7 天達成每日目標：只有設定目標時才計算，依目前的目標判斷', async () => {
		const c = await noonClient();
		for (let i = 0; i < 6; i++) await logSession(c, addDays(c.today, -6 + i), 9, 30);
		// 今天分兩段讀，加總剛好 30 分
		await logSession(c, c.today, 8, 15);
		await logSession(c, c.today, 10, 15);
		expect((await achievements(c))['goal-streak-7']).toMatchObject({ unlocked: false, progress: 0 });

		await c.patch('/api/auth/me', { dailyGoalMinutes: 30 });
		expect((await achievements(c))['goal-streak-7']).toMatchObject({ unlocked: true, progress: 7 });

		await c.patch('/api/auth/me', { dailyGoalMinutes: 45 });
		expect((await achievements(c))['goal-streak-7']).toMatchObject({ unlocked: false, progress: 0 });
	});
});

describe('成就的跨使用者隔離', () => {
	it('只計算本人的資料；別人的錯題、任務回 404，引用別人的任務回 400', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const now = Date.now();
		await alice.post('/api/study-sessions', { mode: 'pomodoro', startedAt: now - 11 * 3_600_000, endedAt: now - 3_600_000 });
		const mistake = (await alice.post('/api/notes', { kind: 'mistake', title: 'Alice 的錯題' })).data.note;
		const task = (await alice.post('/api/tasks', { title: 'Alice 的任務' })).data.task;

		// 不能替別人完成錯題或任務，也不能把自己的時間掛到別人的任務上
		expect((await bob.patch(`/api/notes/${mistake.id}`, { mastered: true })).status).toBe(404);
		expect((await bob.patch(`/api/tasks/${task.id}`, { status: 'done' })).status).toBe(404);
		const hijack = await bob.post('/api/study-sessions', {
			mode: 'pomodoro',
			startedAt: now - 30 * 60_000,
			endedAt: now - 5 * 60_000,
			taskId: task.id,
		});
		expect(hijack.status).toBe(400);

		const b = await achievements(bob);
		expect(Object.values(b).every((x) => !x.unlocked && x.progress === 0)).toBe(true);
		const a = await achievements(alice);
		expect(a['hours-10'].unlocked).toBe(true);
		expect(a['pomodoro-25'].progress).toBe(1);
		expect(a['mastered-10'].progress).toBe(0);
		expect(a['tasks-50'].progress).toBe(0);
	});

	it('未登入回 401', async () => {
		expect((await createClient().get('/api/achievements')).status).toBe(401);
	});
});
