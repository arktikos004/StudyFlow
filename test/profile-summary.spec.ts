import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { Achievement, ProfileSummary } from '../src/shared/api-types';
import { addDays, startOfLocalDay, today, zonedTime } from '../src/shared/dates';
import { createClient, logSession, noonClient, registeredClient, type Client } from './helpers';

const EMPTY_SUMMARY: ProfileSummary = {
	totalMinutes: 0,
	totalSessions: 0,
	currentStreak: 0,
	longestStreak: 0,
	tasksDone: 0,
	mistakesMastered: 0,
	achievements: { unlocked: 0, total: 12, badges: [] },
};

async function summary(c: Client): Promise<ProfileSummary> {
	const res = await c.get('/api/profile/summary');
	expect(res.status, JSON.stringify(res.data)).toBe(200);
	return res.data;
}

describe('個人檔案摘要（PRO-1）', () => {
	it('新帳號全是 0；成就總數和成就頁一致；不被快取', async () => {
		const c = await registeredClient();
		const res = await c.get('/api/profile/summary');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(res.data).toEqual(EMPTY_SUMMARY);
		expect((await c.get('/api/achievements')).data.achievements).toHaveLength(EMPTY_SUMMARY.achievements.total);
	});

	it('學習紀錄、完成的任務、掌握的錯題都算進去；數字和成就頁、總覽一致', async () => {
		const c = await noonClient();
		// 目前連續 3 天（前天、昨天、今天）；更早有一段連續 7 天
		await logSession(c, c.today, 9, 30);
		await logSession(c, c.today, 10, 26, { durationSec: 25 * 60 + 40 });
		await logSession(c, addDays(c.today, -1), 9, 45);
		await logSession(c, addDays(c.today, -2), 9, 20);
		for (let i = 0; i < 7; i++) await logSession(c, addDays(c.today, -20 + i), 9, 10);

		// 完成 2 個任務；進行中、待辦的不算
		const todo = (await c.post('/api/tasks', { title: '完成一' })).data.task;
		await c.patch(`/api/tasks/${todo.id}`, { status: 'done' });
		await c.post('/api/tasks', { title: '完成二', status: 'done' });
		await c.post('/api/tasks', { title: '進行中', status: 'doing' });
		await c.post('/api/tasks', { title: '待辦' });

		// 掌握 10 題錯題（9 題直接寫入資料庫，第 10 題用 API）；還沒掌握的錯題、標成掌握的一般筆記都不算
		const now = Date.now();
		const insert = env.DB.prepare(
			"INSERT INTO notes (id, user_id, kind, title, mastered, created_at, updated_at) VALUES (?, ?, 'mistake', ?, 1, ?, ?)",
		);
		await env.DB.batch(Array.from({ length: 9 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, `錯題 ${i}`, now, now)));
		const tenth = (await c.post('/api/notes', { kind: 'mistake', title: '第十題' })).data.note;
		await c.patch(`/api/notes/${tenth.id}`, { mastered: true });
		await c.post('/api/notes', { kind: 'mistake', title: '還沒掌握' });
		const plain = (await c.post('/api/notes', { kind: 'note', title: '一般筆記' })).data.note;
		await c.patch(`/api/notes/${plain.id}`, { mastered: true });

		const s = await summary(c);
		// 30 + 25:40 + 45 + 20 + 7 × 10 分 = 11440 秒 = 190.67 分 → 無條件捨去 190
		expect(s).toEqual({
			totalMinutes: 190,
			totalSessions: 11,
			currentStreak: 3,
			longestStreak: 7,
			tasksDone: 2,
			mistakesMastered: 10,
			achievements: {
				unlocked: 3,
				total: 12,
				// 三個都是經過 API 解鎖的，都有解鎖時間；「最近解鎖的在前」的順序在 achievement-unlocks.spec.ts 測
				badges: expect.arrayContaining([
					{ id: 'first-session', title: '踏出第一步', icon: 'sparkles', unlockedAt: expect.any(Number) },
					{ id: 'streak-7', title: '連續一週', icon: 'flame', unlockedAt: expect.any(Number) },
					{ id: 'mastered-10', title: '錯題剋星', icon: 'brain', unlockedAt: expect.any(Number) },
				]),
			},
		});
		expect(s.achievements.badges).toHaveLength(3);

		const list: Achievement[] = (await c.get('/api/achievements')).data.achievements;
		const unlocked = list.filter((a) => a.unlocked);
		const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
		expect(s.achievements.total).toBe(list.length);
		expect(s.achievements.unlocked).toBe(unlocked.length);
		// 徽章和成就頁的已解鎖成就一致，解鎖時間也相同
		expect([...s.achievements.badges].sort(byId)).toEqual(
			unlocked.map(({ id, title, icon, unlockedAt }) => ({ id, title, icon, unlockedAt })).sort(byId),
		);
		const progress = Object.fromEntries(list.map((a) => [a.id, a.progress]));
		expect(progress).toMatchObject({
			'first-session': 1,
			'streak-30': s.longestStreak,
			'mastered-50': s.mistakesMastered,
			'tasks-50': s.tasksDone,
		});
		expect((await c.get('/api/dashboard')).data.streak).toBe(s.currentStreak);

		// 即時計算：取消掌握第十題後，數字與徽章跟著變
		await c.patch(`/api/notes/${tenth.id}`, { mastered: false });
		const after = await summary(c);
		expect(after.mistakesMastered).toBe(9);
		expect(after.achievements.badges.map((b) => b.id).sort()).toEqual(['first-session', 'streak-7']);
	});

	it('累積分鐘數無條件捨去：換算成時數後和成就頁一致（3599 秒是 59 分、0.9 小時）', async () => {
		const c = await registeredClient();
		/** 前端顯示累積時數的算法 */
		const hours = (s: ProfileSummary) => Math.floor(s.totalMinutes / 6) / 10;
		const achievementHours = async () => {
			const list: Achievement[] = (await c.get('/api/achievements')).data.achievements;
			return list.find((a) => a.id === 'hours-10')!.progress;
		};

		const end = Date.now() - 10 * 60_000;
		const first = await c.post('/api/study-sessions', { mode: 'stopwatch', startedAt: end - 3_600_000, endedAt: end, durationSec: 3599 });
		expect(first.status, JSON.stringify(first.data)).toBe(201);
		let s = await summary(c);
		expect(s.totalMinutes).toBe(59);
		expect(hours(s)).toBe(0.9);
		expect(await achievementHours()).toBe(0.9);

		// 再多 1 秒剛好滿 1 小時：兩邊同時進位
		const second = await c.post('/api/study-sessions', {
			mode: 'stopwatch',
			startedAt: end + 60_000,
			endedAt: end + 61_000,
			durationSec: 1,
		});
		expect(second.status, JSON.stringify(second.data)).toBe(201);
		s = await summary(c);
		expect(s.totalMinutes).toBe(60);
		expect(hours(s)).toBe(1);
		expect(await achievementHours()).toBe(1);
	});

	it('連續天數依使用者時區的當地日期計算', async () => {
		const c = await registeredClient(); // Asia/Taipei
		const tz = 'Asia/Taipei';
		const d = today(tz);
		// 台北的前天 23:30 與昨天 00:10：在台北是連續兩天，在 UTC 是同一天
		for (const [date, time] of [
			[addDays(d, -2), '23:30'],
			[addDays(d, -1), '00:10'],
		]) {
			const startedAt = zonedTime(date, time, tz);
			const res = await c.post('/api/study-sessions', { mode: 'manual', startedAt, endedAt: startedAt + 20 * 60_000 });
			expect(res.status, JSON.stringify(res.data)).toBe(201);
		}
		const taipei = await summary(c);
		expect(taipei).toMatchObject({ totalMinutes: 40, totalSessions: 2, currentStreak: 2, longestStreak: 2 });
		expect((await c.get('/api/dashboard')).data.streak).toBe(2);

		await c.patch('/api/auth/me', { timezone: 'UTC' });
		const utc = await summary(c);
		expect(utc).toMatchObject({ totalMinutes: 40, totalSessions: 2, longestStreak: 1 });
		// UTC 的「今天」依執行時間是台北的今天或昨天：和總覽用同一個算法，結果一定相同
		expect(utc.currentStreak).toBe((await c.get('/api/dashboard')).data.streak);
	});
});

describe('個人檔案摘要的跨使用者隔離', () => {
	it('只計算本人的資料；別人的任務、錯題回 404，引用別人的任務回 400', async () => {
		const alice = await noonClient('Alice');
		const bob = await registeredClient('Bob');
		await logSession(alice, alice.today, 9, 60);
		const task = (await alice.post('/api/tasks', { title: 'Alice 的任務', status: 'done' })).data.task;
		const mistake = (await alice.post('/api/notes', { kind: 'mistake', title: 'Alice 的錯題' })).data.note;
		await alice.patch(`/api/notes/${mistake.id}`, { mastered: true });

		// 不能改別人的任務與錯題，也不能把自己的時間掛到別人的任務上
		expect((await bob.patch(`/api/tasks/${task.id}`, { status: 'todo' })).status).toBe(404);
		expect((await bob.patch(`/api/notes/${mistake.id}`, { mastered: false })).status).toBe(404);
		const now = Date.now();
		const hijack = await bob.post('/api/study-sessions', {
			mode: 'manual',
			startedAt: now - 600_000,
			endedAt: now - 60_000,
			taskId: task.id,
		});
		expect(hijack.status).toBe(400);
		expect(hijack.data.error).toBe('找不到指定的任務');

		expect(await summary(bob)).toEqual(EMPTY_SUMMARY);
		expect(await summary(alice)).toEqual({
			totalMinutes: 60,
			totalSessions: 1,
			currentStreak: 1,
			longestStreak: 1,
			tasksDone: 1,
			mistakesMastered: 1,
			achievements: {
				unlocked: 1,
				total: 12,
				badges: [{ id: 'first-session', title: '踏出第一步', icon: 'sparkles', unlockedAt: expect.any(Number) }],
			},
		});
	});

	it('未登入回 401', async () => {
		const res = await createClient().get('/api/profile/summary');
		expect(res.status).toBe(401);
		expect(res.data.error).toBe('請先登入');
	});
});

describe('連續天數超過一年（review 3）', () => {
	it('個人檔案看全部歷史；總覽只讀近 366 天，今天有讀書時最多 366、還沒讀書時最多 365', async () => {
		const c = await noonClient();
		// 直接寫入今天到 399 天前、每天 9:00 開始 10 分鐘的紀錄
		const insert = env.DB.prepare(
			"INSERT INTO study_sessions (id, user_id, mode, started_at, ended_at, duration_sec, created_at) VALUES (?, ?, 'manual', ?, ?, 600, ?)",
		);
		const startOf = (daysAgo: number) => startOfLocalDay(addDays(c.today, -daysAgo), c.tz) + 9 * 3_600_000;
		await env.DB.batch(
			Array.from({ length: 400 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, startOf(i), startOf(i) + 600_000, startOf(i))),
		);

		expect(await summary(c)).toMatchObject({ totalSessions: 400, totalMinutes: 4000, currentStreak: 400, longestStreak: 400 });
		expect((await c.get('/api/dashboard')).data.streak).toBe(366);

		// 今天還沒讀書：從昨天算起
		await env.DB.prepare('DELETE FROM study_sessions WHERE user_id = ? AND started_at >= ?')
			.bind(c.user.id, startOf(0) - 9 * 3_600_000)
			.run();
		expect(await summary(c)).toMatchObject({ totalSessions: 399, currentStreak: 399, longestStreak: 399 });
		expect((await c.get('/api/dashboard')).data.streak).toBe(365);
	});
});
