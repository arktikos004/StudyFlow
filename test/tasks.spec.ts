import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { makeTask, registeredClient, type Client } from './helpers';

import { addDays, today } from '../src/shared/dates';

type Item = { id: string; title: string; done: boolean };
const item = (i: number, title = `第 ${i} 項`): Item => ({ id: `item-${i}`, title, done: false });

/** 在「現在」之前 endMinAgo 分鐘結束、長度 minutes 分鐘的學習紀錄 */
async function logFor(c: Client, taskId: string | null, minutes: number, endMinAgo = 1, extra: Record<string, unknown> = {}) {
	const endedAt = Date.now() - endMinAgo * 60_000;
	const res = await c.post('/api/study-sessions', { mode: 'manual', startedAt: endedAt - minutes * 60_000, endedAt, taskId, ...extra });
	expect(res.status, JSON.stringify(res.data)).toBe(201);
	return res.data.session;
}

describe('子任務清單（TSK-1）', () => {
	it('預設是空清單；可以新增、勾選、刪除與調整順序，其他欄位的更新不影響清單', async () => {
		const c = await registeredClient();
		expect((await makeTask(c)).checklist).toEqual([]);

		const items = [item(1, '找資料'), item(2, '寫大綱')];
		const t = await makeTask(c, { checklist: items });
		expect(t.checklist).toEqual(items);

		// 勾選第 2 項並移到最前面、新增第 3 項（標題前後空白會去掉）
		const next = [{ ...items[1], done: true }, items[0], { id: 'item-3', title: '  排版  ', done: false }];
		const updated = (await c.patch(`/api/tasks/${t.id}`, { checklist: next })).data.task;
		expect(updated.checklist).toEqual([{ ...items[1], done: true }, items[0], { id: 'item-3', title: '排版', done: false }]);

		const renamed = (await c.patch(`/api/tasks/${t.id}`, { title: '期末報告（改）' })).data.task;
		expect(renamed.checklist).toEqual(updated.checklist);
		const listed = (await c.get('/api/tasks')).data.tasks.find((x: { id: string }) => x.id === t.id);
		expect(listed.checklist).toEqual(updated.checklist);

		expect((await c.patch(`/api/tasks/${t.id}`, { checklist: [] })).data.task.checklist).toEqual([]);
	});

	it('最多 30 項、每項最多 100 字；超過或格式錯誤回 400', async () => {
		const c = await registeredClient();
		const many = Array.from({ length: 31 }, (_, i) => item(i));
		const cases: [unknown, string][] = [
			[many, '子項目最多 30 項'],
			[[item(1, '字'.repeat(101))], '子項目最多 100 個字'],
			[[item(1, '   ')], '請輸入子項目內容'],
			[[item(1), item(1)], '子項目 ID 重複'],
			[[{ id: '', title: 'a', done: false }], '子項目 ID 格式錯誤'],
			[[{ id: 'x'.repeat(41), title: 'a', done: false }], '子項目 ID 格式錯誤'],
			[[{ id: 'a', title: 'a' }], '子項目格式錯誤'],
			['不是陣列', '子項目格式錯誤'],
		];
		for (const [checklist, error] of cases) {
			const res = await c.post('/api/tasks', { title: 'x', checklist });
			expect(res.status, error).toBe(400);
			expect(res.data.error).toBe(error);
		}
		// 邊界值可以
		expect((await makeTask(c, { checklist: many.slice(0, 30) })).checklist).toHaveLength(30);
		expect((await makeTask(c, { checklist: [item(1, '字'.repeat(100))] })).checklist[0].title).toHaveLength(100);

		// 更新時一樣檢查，失敗時原本的清單不變
		const t = await makeTask(c, { checklist: [item(1)] });
		const bad = await c.patch(`/api/tasks/${t.id}`, { checklist: many });
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('子項目最多 30 項');
		expect((await c.get('/api/tasks')).data.tasks.find((x: { id: string }) => x.id === t.id).checklist).toEqual([item(1)]);
	});
});

describe('任務的實際投入時間（TSK-4）', () => {
	it('加總本人連結到該任務的學習時間（分鐘，小數 1 位），列表與更新回應都有', async () => {
		const c = await registeredClient();
		const t = await makeTask(c, { title: '讀第 3 章', estimatedMinutes: 60 });
		const other = await makeTask(c, { title: '還沒開始' });
		expect(t.spentMinutes).toBe(0);

		await logFor(c, t.id, 25, 90, { mode: 'pomodoro' });
		// 有暫停：實際 20 分 30 秒
		await logFor(c, t.id, 30, 1, { durationSec: 20 * 60 + 30 });
		await logFor(c, null, 40, 200); // 沒有連結任務

		const list = (await c.get('/api/tasks')).data.tasks;
		expect(list.find((x: { id: string }) => x.id === t.id)).toMatchObject({ spentMinutes: 45.5, estimatedMinutes: 60 });
		expect(list.find((x: { id: string }) => x.id === other.id).spentMinutes).toBe(0);

		expect((await c.patch(`/api/tasks/${t.id}`, { status: 'doing' })).data.task.spentMinutes).toBe(45.5);
		expect((await c.get('/api/tasks?status=doing')).data.tasks).toMatchObject([{ id: t.id, spentMinutes: 45.5 }]);
	});

	it('刪除學習紀錄會扣掉時間；刪除任務時學習紀錄保留、只是不再連結（ON DELETE SET NULL）', async () => {
		const c = await registeredClient();
		const t = await makeTask(c);
		const s1 = await logFor(c, t.id, 30, 60);
		await logFor(c, t.id, 15, 1);

		await c.del(`/api/study-sessions/${s1.id}`);
		expect((await c.get('/api/tasks')).data.tasks[0].spentMinutes).toBe(15);

		expect((await c.del(`/api/tasks/${t.id}`)).status).toBe(200);
		const sessions = (await c.get('/api/study-sessions')).data.sessions;
		expect(sessions).toHaveLength(1);
		expect(sessions[0].taskId).toBeNull();
	});
});

describe('任務的跨使用者隔離', () => {
	it('改不到別人的子任務清單；別人的學習紀錄不會算進投入時間', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const t = await makeTask(alice, { title: 'Alice 的任務', checklist: [item(1)] });

		// 別人的資料回 404
		expect((await bob.patch(`/api/tasks/${t.id}`, { checklist: [] })).status).toBe(404);
		// 引用別人的 id 回 400
		const now = Date.now();
		const res = await bob.post('/api/study-sessions', { mode: 'manual', startedAt: now - 600_000, endedAt: now - 60_000, taskId: t.id });
		expect(res.status).toBe(400);
		expect(res.data.error).toBe('找不到指定的任務');

		// 就算資料庫裡有別人掛在這個任務上的紀錄，也只加總本人的
		await env.DB.prepare(
			'INSERT INTO study_sessions (id, user_id, task_id, mode, started_at, ended_at, duration_sec, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
		)
			.bind(crypto.randomUUID(), bob.user.id, t.id, 'manual', now - 600_000, now - 60_000, 540, now)
			.run();
		expect((await alice.get('/api/tasks')).data.tasks).toMatchObject([{ id: t.id, spentMinutes: 0, checklist: [item(1)] }]);
		expect((await bob.get('/api/tasks')).data.tasks).toHaveLength(0);
	});
});

const TZ = 'Asia/Taipei';

describe('考試與任務', () => {
	it('任務可連結考試，考試列表顯示完成進度', async () => {
		const c = await registeredClient();
		const date = addDays(today(TZ), 10);
		const ev = (await c.post('/api/events', { kind: 'exam', title: '期中考', date, time: '09:10' })).data.event;
		const t1 = (await c.post('/api/tasks', { title: '複習第一章', eventId: ev.id })).data.task;
		await c.post('/api/tasks', { title: '複習第二章', eventId: ev.id });
		await c.patch(`/api/tasks/${t1.id}`, { status: 'done' });

		const [listed] = (await c.get('/api/events')).data.events;
		expect(listed).toMatchObject({ title: '期中考', taskTotal: 2, taskDone: 1 });
	});

	it('完成任務時記錄完成時間，改回未完成則清除', async () => {
		const c = await registeredClient();
		const t = (await c.post('/api/tasks', { title: '讀論文' })).data.task;
		expect(t.completedAt).toBeNull();
		const done = (await c.patch(`/api/tasks/${t.id}`, { status: 'done' })).data.task;
		expect(done.completedAt).toBeTypeOf('number');
		const reopened = (await c.patch(`/api/tasks/${t.id}`, { status: 'doing' })).data.task;
		expect(reopened.completedAt).toBeNull();
	});

	it('拒絕錯誤的日期格式', async () => {
		const c = await registeredClient();
		const res = await c.post('/api/events', { kind: 'exam', title: '期末考', date: '2026/12/01' });
		expect(res.status).toBe(400);
		expect(res.data.error).toBe('日期格式錯誤');
	});

	it('拒絕不存在的日期（2 月 31 日、13 月）：考試、任務期限與列表的區間都一樣', async () => {
		const c = await registeredClient();
		const notADay = '沒有這一天，請確認日期';
		for (const date of ['2026-02-31', '2026-13-01', '2025-02-29', '0000-00-00']) {
			const res = await c.post('/api/events', { kind: 'exam', title: '期末考', date });
			expect(res.status, date).toBe(400);
			expect(res.data.error, date).toBe(notADay);
		}
		expect((await c.post('/api/tasks', { title: '交作業', dueDate: '2026-04-31' })).data.error).toBe(notADay);
		expect((await c.get('/api/events?from=2026-02-30')).data.error).toBe(notADay);
		// 閏年的 2 月 29 日是真的
		expect((await c.post('/api/events', { kind: 'exam', title: '期末考', date: '2028-02-29' })).status).toBe(201);
	});

	it('只改標題時，其他欄位都不變（有預設值的優先度、狀態、子項目、標籤不會被洗回預設）', async () => {
		const c = await registeredClient();
		const checklist = [{ id: 'a', title: '第一步', done: true }];
		const task = (await c.post('/api/tasks', { title: '原本', priority: 'high', status: 'doing', checklist })).data.task;
		const renamed = (await c.patch(`/api/tasks/${task.id}`, { title: '改名' })).data.task;
		expect(renamed).toMatchObject({ title: '改名', priority: 'high', status: 'doing', checklist });

		const note = (await c.post('/api/notes', { kind: 'note', title: '原本', tags: ['極限'] })).data.note;
		expect((await c.patch(`/api/notes/${note.id}`, { title: '改名' })).data.note).toMatchObject({ title: '改名', tags: ['極限'] });
	});

	it('驗證失敗的訊息一律是 zh-TW，包含 schema 沒有自己寫訊息的欄位', async () => {
		const c = await registeredClient();
		const responses = [
			await c.get('/api/tasks?status=bogus'),
			await c.get('/api/tasks?subjectId=not-a-uuid'),
			await c.post('/api/tasks', { title: '任務', priority: 'urgent' }),
			await c.post('/api/study-sessions', { mode: 'nap', startedAt: 1, endedAt: 2 }),
		];
		for (const res of responses) {
			expect(res.status).toBe(400);
			expect(res.data.error).toMatch(/[\u4e00-\u9fff]/);
			expect(res.data.error).not.toMatch(/invalid|expected/i);
		}
	});
});
