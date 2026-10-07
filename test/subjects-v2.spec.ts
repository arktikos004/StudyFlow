import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/shared/dates';
import { SUBJECT_ICONS } from '../src/shared/schemas';
import { logSession, noonClient, registeredClient, type Client } from './helpers';

async function makeSubject(c: Client, name: string, extra: Record<string, unknown> = {}) {
	const res = await c.post('/api/subjects', { name, color: '#2a78d6', ...extra });
	expect(res.status, JSON.stringify(res.data)).toBe(201);
	return res.data.subject;
}

const names = async (c: Client) => (await c.get('/api/subjects')).data.subjects.map((s: { name: string }) => s.name);

describe('科目圖示（SUB-2）', () => {
	it('可以設定白名單內的圖示，也可以清除；不在白名單回 400', async () => {
		expect(SUBJECT_ICONS).toHaveLength(24);
		const c = await registeredClient();
		const s = await makeSubject(c, '物理', { icon: 'atom' });
		expect(s.icon).toBe('atom');
		expect(await makeSubject(c, '國文')).toMatchObject({ icon: null });

		expect((await c.patch(`/api/subjects/${s.id}`, { icon: 'microscope' })).data.subject.icon).toBe('microscope');
		expect((await c.patch(`/api/subjects/${s.id}`, { icon: null })).data.subject.icon).toBeNull();

		const bad = await c.post('/api/subjects', { name: '化學', color: '#2a78d6', icon: 'rocket' });
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('圖示不存在');
		const badPatch = await c.patch(`/api/subjects/${s.id}`, { icon: 'Atom' });
		expect(badPatch.status).toBe(400);
		expect(badPatch.data.error).toBe('圖示不存在');
	});
});

describe('科目排序（SUB-2）', () => {
	it('新科目排在最後；PUT /order 調整順序後，列表依新順序排列', async () => {
		const c = await registeredClient();
		const a = await makeSubject(c, 'A');
		const b = await makeSubject(c, 'B');
		const d = await makeSubject(c, 'C');
		expect([a, b, d].map((s) => s.sortOrder)).toEqual([0, 1, 2]);

		const res = await c.put('/api/subjects/order', { ids: [d.id, a.id, b.id] });
		expect(res.status).toBe(200);
		expect(res.data.subjects.map((s: { id: string; sortOrder: number }) => [s.id, s.sortOrder])).toEqual([
			[d.id, 0],
			[a.id, 1],
			[b.id, 2],
		]);
		expect(await names(c)).toEqual(['C', 'A', 'B']);

		// 新增的科目排在最後
		const e = await makeSubject(c, 'D');
		expect(e.sortOrder).toBe(3);
		expect(await names(c)).toEqual(['C', 'A', 'B', 'D']);

		// 封存的科目也在清單裡，要一起排序
		await c.patch(`/api/subjects/${a.id}`, { archived: true });
		expect((await c.put('/api/subjects/order', { ids: [e.id, d.id, a.id, b.id] })).status).toBe(200);
		expect(await names(c)).toEqual(['D', 'C', 'A', 'B']);
	});

	it('ids 必須剛好是本人全部的科目，否則回 400「科目清單不正確」', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const a = await makeSubject(alice, 'A');
		const b = await makeSubject(alice, 'B');
		const x = await makeSubject(bob, 'X');

		const wrong = [
			[a.id], // 少一個
			[a.id, b.id, x.id], // 多了別人的
			[a.id, x.id], // 數量相同但混入別人的
			[a.id, crypto.randomUUID()], // 不存在的
			[a.id, a.id], // 重複
			[], // 空的
		];
		for (const ids of wrong) {
			const res = await alice.put('/api/subjects/order', { ids });
			expect(res.status, JSON.stringify(ids)).toBe(400);
			expect(res.data.error).toBe('科目清單不正確');
		}
		expect((await alice.put('/api/subjects/order', {})).data.error).toBe('科目清單不正確');
		expect((await alice.put('/api/subjects/order', { ids: ['not-a-uuid'] })).data.error).toBe('ID 格式錯誤');

		// 失敗時順序不變；別人的順序也不受影響
		expect((await alice.get('/api/subjects')).data.subjects.map((s: { id: string }) => s.id)).toEqual([a.id, b.id]);
		expect((await bob.get('/api/subjects')).data.subjects).toMatchObject([{ id: x.id, sortOrder: 0 }]);
	});

	it('每位使用者各自排序，互不影響', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const a1 = await makeSubject(alice, '一');
		const a2 = await makeSubject(alice, '二');
		const b1 = await makeSubject(bob, '甲');
		const b2 = await makeSubject(bob, '乙');
		expect([a1.sortOrder, a2.sortOrder, b1.sortOrder, b2.sortOrder]).toEqual([0, 1, 0, 1]);

		await alice.put('/api/subjects/order', { ids: [a2.id, a1.id] });
		expect(await names(alice)).toEqual(['二', '一']);
		expect(await names(bob)).toEqual(['甲', '乙']);
	});
});

describe('單科總覽（SUB-3）', () => {
	it('一次取得即將到來的考試、未完成任務、讀書時間與錯題', async () => {
		const c = await noonClient();
		const t = c.today;
		const math = await makeSubject(c, '微積分', { weeklyGoalMinutes: 120, icon: 'sigma' });
		const eng = await makeSubject(c, '英文');

		const exam = (await c.post('/api/events', { kind: 'exam', title: '期中考', date: addDays(t, 7), time: '09:00', subjectId: math.id }))
			.data.event;
		await c.post('/api/events', { kind: 'deadline', title: 'HW1', date: t, subjectId: math.id });
		await c.post('/api/events', { kind: 'exam', title: '小考', date: addDays(t, -1), subjectId: math.id }); // 已經過了
		await c.post('/api/events', { kind: 'exam', title: '英文考', date: addDays(t, 3), subjectId: eng.id }); // 別科

		const open = (await c.post('/api/tasks', { title: '複習第一章', subjectId: math.id, eventId: exam.id })).data.task;
		await c.post('/api/tasks', { title: '複習第二章', subjectId: math.id, eventId: exam.id, status: 'done' });
		await c.post('/api/tasks', { title: '背單字', subjectId: eng.id });

		await logSession(c, t, 9, 30, { subjectId: math.id, taskId: open.id });
		await logSession(c, addDays(t, -10), 9, 60, { subjectId: math.id }); // 近 30 天、不在本週
		await logSession(c, addDays(t, -40), 9, 90, { subjectId: math.id }); // 超過 30 天
		await logSession(c, t, 10, 45, { subjectId: eng.id }); // 別科

		const mastered = (await c.post('/api/notes', { kind: 'mistake', title: '已掌握', subjectId: math.id })).data.note;
		const due = (await c.post('/api/notes', { kind: 'mistake', title: '今天複習', subjectId: math.id })).data.note;
		await c.post('/api/notes', { kind: 'mistake', title: '明天複習', subjectId: math.id });
		await c.post('/api/notes', { kind: 'note', title: '一般筆記', subjectId: math.id });
		await c.post('/api/notes', { kind: 'mistake', title: '英文錯題', subjectId: eng.id });
		await c.patch(`/api/notes/${mastered.id}`, { mastered: true });
		await env.DB.prepare('UPDATE notes SET next_review_date = ? WHERE id = ?').bind(t, due.id).run();

		const res = await c.get(`/api/subjects/${math.id}/overview`);
		expect(res.status).toBe(200);
		const o = res.data;
		expect(o.subject).toMatchObject({ id: math.id, name: '微積分', icon: 'sigma', weeklyGoalMinutes: 120 });
		expect(o.upcomingEvents.map((e: { title: string }) => e.title)).toEqual(['HW1', '期中考']);
		expect(o.upcomingEvents[1]).toMatchObject({ id: exam.id, taskTotal: 2, taskDone: 1 });
		expect(o.openTasks).toHaveLength(1);
		expect(o.openTasks[0]).toMatchObject({ id: open.id, spentMinutes: 30, checklist: [] });
		expect(o.minutes).toEqual({ week: 30, last30: 90 });
		expect(o.mistakes).toEqual({ total: 3, mastered: 1, due: 1 });
	});

	it('沒有任何資料時回傳空的總覽', async () => {
		const c = await registeredClient();
		const s = await makeSubject(c, '空科目');
		const o = (await c.get(`/api/subjects/${s.id}/overview`)).data;
		expect(o).toEqual({
			subject: expect.objectContaining({ id: s.id }),
			upcomingEvents: [],
			openTasks: [],
			minutes: { week: 0, last30: 0 },
			mistakes: { total: 0, mastered: 0, due: 0 },
		});
	});
});

describe('科目的跨使用者隔離', () => {
	it('別人的科目：總覽、改圖示回 404；引用別人的科目回 400', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const s = await makeSubject(alice, '線性代數', { icon: 'sigma' });

		const overview = await bob.get(`/api/subjects/${s.id}/overview`);
		expect(overview.status).toBe(404);
		expect(overview.data.error).toBe('找不到此科目');
		expect((await alice.get(`/api/subjects/${crypto.randomUUID()}/overview`)).status).toBe(404);
		expect((await bob.patch(`/api/subjects/${s.id}`, { icon: 'book' })).status).toBe(404);

		// 引用別人的 id 回 400：別人的任務、考試不會混進自己的單科總覽
		expect((await bob.post('/api/tasks', { title: '偷掛', subjectId: s.id })).status).toBe(400);
		expect((await bob.post('/api/events', { kind: 'exam', title: '偷掛', date: '2099-01-01', subjectId: s.id })).status).toBe(400);
		expect((await bob.put('/api/subjects/order', { ids: [s.id] })).status).toBe(400);

		const o = (await alice.get(`/api/subjects/${s.id}/overview`)).data;
		expect(o).toMatchObject({ subject: { icon: 'sigma' }, upcomingEvents: [], openTasks: [] });
	});
});
