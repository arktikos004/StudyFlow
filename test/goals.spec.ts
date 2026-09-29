import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays, weekStart } from '../src/shared/dates';
import { createClient, logSession, noonClient, registeredClient, type Client } from './helpers';

async function makeSubject(c: Client, name: string, extra: Record<string, unknown> = {}) {
	const res = await c.post('/api/subjects', { name, color: '#2a78d6', ...extra });
	expect(res.status, JSON.stringify(res.data)).toBe(201);
	return res.data.subject;
}

describe('每日／每週讀書目標（GOAL-1）', () => {
	it('預設沒有目標；可以設定、只改其中一個、清除', async () => {
		const c = await registeredClient();
		expect(c.user).toMatchObject({ dailyGoalMinutes: null, weeklyGoalMinutes: null });

		const set = await c.patch('/api/auth/me', { dailyGoalMinutes: 60, weeklyGoalMinutes: 600 });
		expect(set.status).toBe(200);
		expect(set.data.user).toMatchObject({ dailyGoalMinutes: 60, weeklyGoalMinutes: 600 });
		expect((await c.get('/api/auth/me')).data.user).toMatchObject({ dailyGoalMinutes: 60, weeklyGoalMinutes: 600 });

		const cleared = await c.patch('/api/auth/me', { dailyGoalMinutes: null });
		expect(cleared.data.user).toMatchObject({ dailyGoalMinutes: null, weeklyGoalMinutes: 600 });

		// 沒有任何欄位的 PATCH 不會出錯，資料不變
		const noop = await c.patch('/api/auth/me', {});
		expect(noop.status).toBe(200);
		expect(noop.data.user).toMatchObject({ dailyGoalMinutes: null, weeklyGoalMinutes: 600 });
	});

	it('拒絕超出範圍、不是整數或不是數字的目標', async () => {
		const c = await registeredClient();
		const cases: [Record<string, unknown>, string][] = [
			[{ dailyGoalMinutes: 9 }, '每日目標需介於 10–720 分鐘'],
			[{ dailyGoalMinutes: 721 }, '每日目標需介於 10–720 分鐘'],
			[{ dailyGoalMinutes: 30.5 }, '每日目標必須是整數'],
			[{ dailyGoalMinutes: '30' }, '每日目標請輸入數字'],
			[{ weeklyGoalMinutes: 59 }, '每週目標需介於 60–5040 分鐘'],
			[{ weeklyGoalMinutes: 5041 }, '每週目標需介於 60–5040 分鐘'],
		];
		for (const [body, error] of cases) {
			const res = await c.patch('/api/auth/me', body);
			expect(res.status, JSON.stringify(body)).toBe(400);
			expect(res.data.error, JSON.stringify(body)).toBe(error);
		}
		// 邊界值可以
		expect((await c.patch('/api/auth/me', { dailyGoalMinutes: 10, weeklyGoalMinutes: 5040 })).status).toBe(200);
		expect((await c.patch('/api/auth/me', { dailyGoalMinutes: 720, weeklyGoalMinutes: 60 })).status).toBe(200);
		expect((await c.get('/api/auth/me')).data.user).toMatchObject({ dailyGoalMinutes: 720, weeklyGoalMinutes: 60 });
	});
});

describe('個人資料：時區名稱正規化', () => {
	it('大小寫不同的時區名稱寫入後，存下的是標準名稱', async () => {
		const c = await registeredClient();
		const res = await c.patch('/api/auth/me', { timezone: 'asia/TAIPEI' });
		expect(res.status).toBe(200);
		expect(res.data.user.timezone).toBe('Asia/Taipei');

		expect((await c.patch('/api/auth/me', { timezone: 'AMERICA/new_york' })).data.user.timezone).toBe('America/New_York');
		expect((await c.get('/api/auth/me')).data.user.timezone).toBe('America/New_York');
		const row = await env.DB.prepare('SELECT timezone FROM users WHERE id = ?').bind(c.user.id).first<{ timezone: string }>();
		expect(row!.timezone).toBe('America/New_York');

		const bad = await c.patch('/api/auth/me', { timezone: 'asia/nowhere' });
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('時區格式錯誤');
	});
});

describe('各科每週目標（GOAL-2）', () => {
	it('新增與編輯科目時可以設定每週目標，也可以清除', async () => {
		const c = await registeredClient();
		const s = await makeSubject(c, '英文', { weeklyGoalMinutes: 150 });
		expect(s.weeklyGoalMinutes).toBe(150);
		expect((await c.patch(`/api/subjects/${s.id}`, { weeklyGoalMinutes: 3000 })).data.subject.weeklyGoalMinutes).toBe(3000);
		expect((await c.patch(`/api/subjects/${s.id}`, { weeklyGoalMinutes: null })).data.subject.weeklyGoalMinutes).toBeNull();

		// 沒有任何欄位的 PATCH 回傳原本的資料
		const noop = await c.patch(`/api/subjects/${s.id}`, {});
		expect(noop.status).toBe(200);
		expect(noop.data.subject).toMatchObject({ id: s.id, name: '英文', weeklyGoalMinutes: null });
	});

	it('拒絕超出 10–3000 分鐘的科目目標', async () => {
		const c = await registeredClient();
		const low = await c.post('/api/subjects', { name: '國文', color: '#2a78d6', weeklyGoalMinutes: 5 });
		expect(low.status).toBe(400);
		expect(low.data.error).toBe('科目每週目標需介於 10–3000 分鐘');

		const s = await makeSubject(c, '國文');
		const high = await c.patch(`/api/subjects/${s.id}`, { weeklyGoalMinutes: 3001 });
		expect(high.status).toBe(400);
		expect(high.data.error).toBe('科目每週目標需介於 10–3000 分鐘');
	});
});

describe('總覽的目標進度（GOAL-1、GOAL-2）', () => {
	it('列出有每週目標、沒有封存的科目，以及本週（週一起算）的分鐘數', async () => {
		const c = await noonClient();
		const t = c.today;
		const monday = weekStart(t);
		await c.patch('/api/auth/me', { dailyGoalMinutes: 30, weeklyGoalMinutes: 300 });
		const math = await makeSubject(c, '微積分', { weeklyGoalMinutes: 120 });
		const physics = await makeSubject(c, '物理', { weeklyGoalMinutes: 60 });
		const chem = await makeSubject(c, '化學');
		const bio = await makeSubject(c, '生物', { weeklyGoalMinutes: 90 });
		await c.patch(`/api/subjects/${physics.id}`, { archived: true });

		await logSession(c, monday, 6, 40, { subjectId: math.id });
		await logSession(c, t, 9, 30, { subjectId: math.id });
		await logSession(c, addDays(monday, -1), 9, 45, { subjectId: math.id }); // 上週日：不算
		await logSession(c, t, 8, 20, { subjectId: chem.id }); // 沒有目標：不列
		await logSession(c, t, 7, 15, { subjectId: physics.id }); // 已封存：不列

		const dash = (await c.get('/api/dashboard')).data;
		expect(dash.goals.dailyMinutes).toBe(30);
		expect(dash.goals.weeklyMinutes).toBe(300);
		expect(dash.goals.subjects).toHaveLength(2);
		expect(dash.goals.subjects).toEqual(
			expect.arrayContaining([
				{ subjectId: math.id, goalMinutes: 120, minutes: 70 },
				{ subjectId: bio.id, goalMinutes: 90, minutes: 0 },
			]),
		);
		expect(dash.weekMinutes).toBe(105);
	});

	it('沒有設定目標時為 null 與空陣列', async () => {
		const c = await registeredClient();
		await makeSubject(c, '歷史');
		expect((await c.get('/api/dashboard')).data.goals).toEqual({ dailyMinutes: null, weeklyMinutes: null, subjects: [] });
	});
});

describe('統計：達成每日目標的天數（GOAL-1）', () => {
	it('依每天的分鐘數判斷，沒有設定目標時為 0', async () => {
		const c = await noonClient();
		const t = c.today;
		await logSession(c, t, 9, 40);
		await logSession(c, addDays(t, -1), 9, 20);
		await logSession(c, addDays(t, -2), 9, 30); // 剛好達標
		await logSession(c, addDays(t, -3), 8, 15);
		await logSession(c, addDays(t, -3), 10, 15); // 同一天加總 30 分
		await logSession(c, addDays(t, -8), 9, 90); // 不在 7 天區間內

		const none = (await c.get('/api/stats?days=7')).data;
		expect(none.totals.goalMetDays).toBe(0);
		expect(none.dailyGoalMinutes).toBeNull();

		await c.patch('/api/auth/me', { dailyGoalMinutes: 30 });
		const s = (await c.get('/api/stats?days=7')).data;
		expect(s.dailyGoalMinutes).toBe(30);
		expect(s.totals.goalMetDays).toBe(3);
		expect((await c.get('/api/stats?days=30')).data.totals.goalMetDays).toBe(4);
		// 既有欄位的形狀不變
		expect(s.range).toEqual({ from: addDays(t, -6), to: t, days: 7 });
		expect(s.tasks).toEqual({ total: 0, done: 0, overdue: 0 });
	});
});

describe('目標的跨使用者隔離', () => {
	it('改不到別人科目的目標，別人的目標與讀書時間不會出現在自己的總覽', async () => {
		const alice = await noonClient('Alice');
		const bob = await noonClient('Bob');
		await alice.patch('/api/auth/me', { dailyGoalMinutes: 60 });
		const math = await makeSubject(alice, '微積分', { weeklyGoalMinutes: 120 });

		// 別人的資料回 404
		expect((await bob.patch(`/api/subjects/${math.id}`, { weeklyGoalMinutes: 10 })).status).toBe(404);
		expect((await bob.patch(`/api/subjects/${math.id}`, {})).status).toBe(404);
		// 引用別人的 id 回 400：不能把自己的讀書時間記到別人的科目上
		const now = Date.now();
		const res = await bob.post('/api/study-sessions', { mode: 'manual', startedAt: now - 3_600_000, endedAt: now - 60_000, subjectId: math.id });
		expect(res.status).toBe(400);
		expect(res.data.error).toBe('找不到指定的科目');

		expect((await bob.get('/api/dashboard')).data.goals).toEqual({ dailyMinutes: null, weeklyMinutes: null, subjects: [] });
		expect((await alice.get('/api/dashboard')).data.goals).toEqual({
			dailyMinutes: 60,
			weeklyMinutes: null,
			subjects: [{ subjectId: math.id, goalMinutes: 120, minutes: 0 }],
		});
		expect((await alice.get('/api/subjects')).data.subjects[0].weeklyGoalMinutes).toBe(120);
	});

	it('未登入不能修改目標', async () => {
		expect((await createClient().patch('/api/auth/me', { dailyGoalMinutes: 30 })).status).toBe(401);
	});
});
