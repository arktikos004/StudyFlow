import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import type { Achievement, ProfileSummary } from '../src/shared/api-types';
import { addDays, startOfLocalDay } from '../src/shared/dates';
import { recentBadges } from '../src/worker/lib/achievements';
import { logSession, noonClient, type Client, type NoonClient } from './helpers';

async function achievements(c: Client): Promise<Record<string, Achievement>> {
	const res = await c.get('/api/achievements');
	expect(res.status).toBe(200);
	return Object.fromEntries(res.data.achievements.map((a: Achievement) => [a.id, a]));
}

async function summary(c: Client): Promise<ProfileSummary> {
	const res = await c.get('/api/profile/summary');
	expect(res.status).toBe(200);
	return res.data;
}

/** 資料庫裡的解鎖紀錄（依成就 id 排序） */
async function unlockRows(userId: string) {
	const { results } = await env.DB.prepare(
		'SELECT achievement_id AS id, unlocked_at AS at FROM achievement_unlocks WHERE user_id = ? ORDER BY achievement_id',
	)
		.bind(userId)
		.all<{ id: string; at: number }>();
	return results;
}

/** 直接寫進 D1 的學習紀錄：不經過 API，就像開始記錄解鎖時間之前就有的資料 */
async function insertSessionDirectly(c: NoonClient, date: string, minutes: number) {
	const startedAt = startOfLocalDay(date, c.tz) + 9 * 3_600_000;
	await env.DB.prepare(
		"INSERT INTO study_sessions (id, user_id, mode, started_at, ended_at, duration_sec, created_at) VALUES (?, ?, 'manual', ?, ?, ?, ?)",
	)
		.bind(crypto.randomUUID(), c.user.id, startedAt, startedAt + minutes * 60_000, minutes * 60, Date.now())
		.run();
}

/** 在指定的「現在」送出請求：控制解鎖時間，讓先後順序不受執行速度影響 */
async function at<T>(now: number, request: () => Promise<T>): Promise<T> {
	const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
	try {
		return await request();
	} finally {
		spy.mockRestore();
	}
}

describe('成就的解鎖時間（PRO-2）', () => {
	it('造成解鎖的寫入記下時間：落在那個請求的前後之間；沒解鎖的是 null', async () => {
		const c = await noonClient();
		const before = Date.now();
		await logSession(c, c.today, 9, 30);
		const after = Date.now();

		const a = await achievements(c);
		expect(a['first-session'].unlocked).toBe(true);
		expect(a['first-session'].unlockedAt).toBeGreaterThanOrEqual(before);
		expect(a['first-session'].unlockedAt).toBeLessThanOrEqual(after);
		const others = Object.values(a).filter((x) => x.id !== 'first-session');
		expect(others.every((x) => !x.unlocked && x.unlockedAt === null)).toBe(true);
		expect(await unlockRows(c.user.id)).toEqual([{ id: 'first-session', at: a['first-session'].unlockedAt }]);
	});

	it('開始記錄之前就解鎖的：顯示已解鎖、時間是 null；讀取不寫入，之後的寫入也不會補記成現在', async () => {
		const c = await noonClient();
		await insertSessionDirectly(c, addDays(c.today, -3), 10);

		await c.get('/api/achievements');
		await c.get('/api/profile/summary');
		await logSession(c, c.today, 9, 10); // 經過 API 的寫入，但「踏出第一步」在這之前就解鎖了

		expect((await achievements(c))['first-session']).toMatchObject({ unlocked: true, unlockedAt: null });
		expect(await unlockRows(c.user.id)).toEqual([]);
	});

	it('徽章被收回時刪掉紀錄；之後再解鎖得到新的時間', async () => {
		const c = await noonClient();
		const base = Date.now();
		const session = await at(base + 60_000, () => logSession(c, c.today, 8, 30));
		expect((await achievements(c))['first-session'].unlockedAt).toBe(base + 60_000);

		expect((await c.del(`/api/study-sessions/${session.id}`)).status).toBe(200);
		expect((await achievements(c))['first-session']).toMatchObject({ unlocked: false, unlockedAt: null });
		expect(await unlockRows(c.user.id)).toEqual([]);

		await at(base + 120_000, () => logSession(c, c.today, 9, 30));
		expect((await achievements(c))['first-session']).toMatchObject({ unlocked: true, unlockedAt: base + 120_000 });
	});

	it('改了每日目標而解鎖「說到做到」：記在改目標的那個請求；調高目標收回後紀錄刪掉', async () => {
		const c = await noonClient();
		for (let i = 0; i < 7; i++) await logSession(c, addDays(c.today, -6 + i), 8, 30);
		expect((await achievements(c))['goal-streak-7']).toMatchObject({ unlocked: false, unlockedAt: null });

		const now = Date.now() + 60_000;
		expect((await at(now, () => c.patch('/api/auth/me', { dailyGoalMinutes: 30 }))).status).toBe(200);
		expect((await achievements(c))['goal-streak-7']).toMatchObject({ unlocked: true, unlockedAt: now });

		await c.patch('/api/auth/me', { dailyGoalMinutes: 45 });
		expect((await achievements(c))['goal-streak-7']).toMatchObject({ unlocked: false, unlockedAt: null });
		expect((await unlockRows(c.user.id)).map((r) => r.id)).not.toContain('goal-streak-7');
	});

	it('完成第 50 個任務而解鎖「使命必達」：記在完成的那個請求；改回未完成就收回', async () => {
		const c = await noonClient();
		const base = Date.now();
		const insert = env.DB.prepare("INSERT INTO tasks (id, user_id, title, status, created_at, updated_at) VALUES (?, ?, ?, 'done', ?, ?)");
		await env.DB.batch(Array.from({ length: 49 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, `任務 ${i}`, base, base)));
		const last = (await c.post('/api/tasks', { title: '第 50 個' })).data.task;
		expect((await achievements(c))['tasks-50']).toMatchObject({ unlocked: false, unlockedAt: null });

		await at(base + 60_000, () => c.patch(`/api/tasks/${last.id}`, { status: 'done' }));
		expect((await achievements(c))['tasks-50']).toMatchObject({ unlocked: true, unlockedAt: base + 60_000 });
		// 任務的寫入只比對任務的成就：沒有學習紀錄，其他成就不受影響
		expect((await unlockRows(c.user.id)).map((r) => r.id)).toEqual(['tasks-50']);

		await c.patch(`/api/tasks/${last.id}`, { status: 'todo' });
		expect((await achievements(c))['tasks-50']).toMatchObject({ unlocked: false, unlockedAt: null });
		expect(await unlockRows(c.user.id)).toEqual([]);
	});

	it('個人檔案的徽章：最近解鎖的在前，時間不明的排在最後', async () => {
		const c = await noonClient();
		// 開始記錄之前就有的資料：解鎖「踏出第一步」，沒有時間
		await insertSessionDirectly(c, addDays(c.today, -3), 10);
		const base = Date.now();
		// 10 小時的補登：解鎖「起步 10 小時」
		await at(base + 60_000, () => logSession(c, addDays(c.today, -1), 8, 600));
		// 掌握第 10 題錯題（9 題直接寫入資料庫）：解鎖「錯題剋星」
		const insert = env.DB.prepare(
			"INSERT INTO notes (id, user_id, kind, title, mastered, created_at, updated_at) VALUES (?, ?, 'mistake', ?, 1, ?, ?)",
		);
		await env.DB.batch(Array.from({ length: 9 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, `錯題 ${i}`, base, base)));
		const tenth = (await c.post('/api/notes', { kind: 'mistake', title: '第十題' })).data.note;
		await at(base + 120_000, () => c.patch(`/api/notes/${tenth.id}`, { mastered: true }));

		const s = await summary(c);
		expect(s.achievements.badges).toEqual([
			{ id: 'mastered-10', title: '錯題剋星', icon: 'brain', unlockedAt: base + 120_000 },
			{ id: 'hours-10', title: '起步 10 小時', icon: 'clock', unlockedAt: base + 60_000 },
			{ id: 'first-session', title: '踏出第一步', icon: 'sparkles', unlockedAt: null },
		]);
		expect(s.achievements.unlocked).toBe(3);
	});

	it('排序規則：同一時間或時間不明的，依成就的固定順序', () => {
		const a = (id: string, unlocked: boolean, unlockedAt: number | null): Achievement => ({
			id,
			title: id,
			description: '',
			icon: 'trophy',
			unlocked,
			progress: 0,
			target: 1,
			unlockedAt,
		});
		const list = [
			a('first-session', true, null),
			a('hours-10', true, 100),
			a('hours-50', false, null),
			a('streak-7', true, 300),
			a('streak-30', true, 100),
			a('tasks-50', true, null),
		];
		expect(recentBadges(list).map((b) => b.id)).toEqual(['streak-7', 'hours-10', 'streak-30', 'first-session', 'tasks-50']);
	});
});

describe('解鎖紀錄的隔離與失敗的寫入', () => {
	it('只記在本人名下；別人改不了，失敗的寫入不記錄', async () => {
		const alice = await noonClient('Alice');
		const bob = await noonClient('Bob');
		const session = await logSession(alice, alice.today, 9, 30);
		const aliceRows = await unlockRows(alice.user.id);
		expect(aliceRows.map((r) => r.id)).toEqual(['first-session']);

		// 別人刪不了我的紀錄（404）、自己送錯的寫入（400）都不會動到解鎖紀錄
		expect((await bob.del(`/api/study-sessions/${session.id}`)).status).toBe(404);
		expect((await bob.post('/api/study-sessions', { mode: 'manual' })).status).toBe(400);
		expect(await unlockRows(bob.user.id)).toEqual([]);

		// 各自的寫入記在各自名下
		await logSession(bob, bob.today, 9, 30);
		const bobRows = await unlockRows(bob.user.id);
		expect(bobRows.map((r) => r.id)).toEqual(['first-session']);
		expect((await achievements(bob))['first-session'].unlockedAt).toBe(bobRows[0].at);
		expect(await unlockRows(alice.user.id)).toEqual(aliceRows);
	});

	it('JSON 備份包含本人的解鎖紀錄（時間無法從其他資料算回來）', async () => {
		const alice = await noonClient('Alice');
		const bob = await noonClient('Bob');
		await logSession(alice, alice.today, 9, 30);
		const [row] = await unlockRows(alice.user.id);

		expect((await alice.get('/api/export/backup.json')).data.achievementUnlocks).toEqual([
			{ achievementId: 'first-session', unlockedAt: row.at },
		]);
		expect((await bob.get('/api/export/backup.json')).data.achievementUnlocks).toEqual([]);
	});
});
