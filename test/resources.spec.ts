import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays, today } from '../src/shared/dates';
import { PNG_1X1, registeredClient, type Client } from './helpers';

const TZ = 'Asia/Taipei';

async function makeSubject(c: Client, name = '資料結構') {
	const res = await c.post('/api/subjects', { name, color: '#2a78d6' });
	expect(res.status).toBe(201);
	return res.data.subject;
}

describe('科目', () => {
	it('新增、改名、刪除；同名會被拒絕', async () => {
		const c = await registeredClient();
		const s = await makeSubject(c);
		expect((await c.post('/api/subjects', { name: '資料結構', color: '#eb6834' })).status).toBe(409);

		const renamed = await c.patch(`/api/subjects/${s.id}`, { name: '演算法' });
		expect(renamed.data.subject.name).toBe('演算法');
		expect((await c.get('/api/subjects')).data.subjects).toHaveLength(1);

		expect((await c.del(`/api/subjects/${s.id}`)).status).toBe(200);
		expect((await c.get('/api/subjects')).data.subjects).toHaveLength(0);
	});

	it('刪除科目時，相關任務保留但科目欄位清空', async () => {
		const c = await registeredClient();
		const s = await makeSubject(c);
		const t = (await c.post('/api/tasks', { title: '寫作業', subjectId: s.id })).data.task;
		await c.del(`/api/subjects/${s.id}`);
		const tasks = (await c.get('/api/tasks')).data.tasks;
		expect(tasks.find((x: { id: string }) => x.id === t.id).subjectId).toBeNull();
	});
});

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

describe('學習紀錄', () => {
	it('新增後可依日期查詢，並拒絕不合理的時間', async () => {
		const c = await registeredClient();
		const endedAt = Date.now() - 60_000;
		const startedAt = endedAt - 25 * 60_000;
		const res = await c.post('/api/study-sessions', { mode: 'pomodoro', startedAt, endedAt });
		expect(res.status).toBe(201);
		expect(res.data.session.durationSec).toBe(25 * 60);

		expect((await c.get('/api/study-sessions')).data.sessions).toHaveLength(1);
		expect((await c.post('/api/study-sessions', { mode: 'manual', startedAt: endedAt, endedAt: startedAt })).status).toBe(400);
		expect((await c.post('/api/study-sessions', { mode: 'manual', startedAt, endedAt, durationSec: 99_999 })).status).toBe(400);
	});
});

describe('筆記、錯題與複習', () => {
	it('錯題預設排入明天複習，答對逐步拉長間隔，全部通過即掌握', async () => {
		const c = await registeredClient();
		const n = (
			await c.post('/api/notes', { kind: 'mistake', title: '遞迴時間複雜度', question: 'T(n)=2T(n/2)+n', correctAnswer: 'O(n log n)' })
		).data.note;
		expect(n.nextReviewDate).toBe(addDays(today(TZ), 1));

		// 模擬已到複習日
		await env.DB.prepare('UPDATE notes SET next_review_date = ? WHERE id = ?').bind(today(TZ), n.id).run();
		expect((await c.get('/api/notes?review=due')).data.notes).toHaveLength(1);

		let note = (await c.post(`/api/notes/${n.id}/review`, { result: 'remembered' })).data.note;
		expect(note).toMatchObject({ reviewStage: 1, nextReviewDate: addDays(today(TZ), 3), mastered: false });
		expect((await c.get('/api/notes?review=due')).data.notes).toHaveLength(0);

		note = (await c.post(`/api/notes/${n.id}/review`, { result: 'forgot' })).data.note;
		expect(note).toMatchObject({ reviewStage: 0, nextReviewDate: addDays(today(TZ), 1) });

		for (let i = 0; i < 5; i++) note = (await c.post(`/api/notes/${n.id}/review`, { result: 'remembered' })).data.note;
		expect(note).toMatchObject({ mastered: true, nextReviewDate: null });
	});

	it('一般筆記預設不排複習，可搜尋關鍵字與標籤', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'note', title: 'TCP 三向交握', content: 'SYN → SYN-ACK → ACK', tags: ['網路'] })).data
			.note;
		expect(n.nextReviewDate).toBeNull();
		await c.post('/api/notes', { kind: 'note', title: '100% 會考', content: '無關內容' });

		expect((await c.get('/api/notes?q=SYN-ACK')).data.notes).toHaveLength(1);
		expect((await c.get(`/api/notes?q=${encodeURIComponent('%')}`)).data.notes).toHaveLength(1);
		expect((await c.get(`/api/notes?tag=${encodeURIComponent('網路')}`)).data.notes).toHaveLength(1);
	});

	it('照片上傳到 R2，檢查真實格式，刪除筆記時一併刪除照片', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'mistake', title: '看圖題' })).data.note;

		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'q.png', { type: 'image/png' }));
		const up = await c.post(`/api/notes/${n.id}/attachments`, form);
		expect(up.status).toBe(201);
		expect(up.data.attachment.contentType).toBe('image/png');

		const img = await c.get(`/api/attachments/${up.data.attachment.id}`);
		expect(img.status).toBe(200);
		expect(img.headers.get('content-type')).toBe('image/png');
		expect(new Uint8Array(img.data)).toEqual(PNG_1X1);

		// 副檔名是 .png 但內容是 HTML：要擋下
		const fake = new FormData();
		fake.append('file', new File(['<script>alert(1)</script>'], 'x.png', { type: 'image/png' }));
		expect((await c.post(`/api/notes/${n.id}/attachments`, fake)).status).toBe(415);

		const detail = (await c.get(`/api/notes/${n.id}`)).data.note;
		expect(detail.attachments).toHaveLength(1);

		await c.del(`/api/notes/${n.id}`);
		expect(await env.BUCKET.get(`users/${c.user.id}/${up.data.attachment.id}`)).toBeNull();
	});

	it('照片上傳：沒有選檔、送的不是表單、空檔案都回 400「請選擇照片」（和頭像相同），不會變成 500', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'mistake', title: '看圖題' })).data.note;
		const url = `/api/notes/${n.id}/attachments`;

		const noFile = await c.post(url, new FormData());
		const json = await c.post(url, { file: 'not-a-file' });
		const noBody = await c.post(url);
		const empty = new FormData();
		empty.append('file', new File([], 'empty.png', { type: 'image/png' }));
		const emptyFile = await c.post(url, empty);

		for (const res of [noFile, json, noBody, emptyFile]) {
			expect(res.status, JSON.stringify(res.data)).toBe(400);
			expect(res.data.error).toBe('請選擇照片');
		}
		expect((await c.get(`/api/notes/${n.id}`)).data.note.attachments).toEqual([]);
	});

	it('刪除單張照片：資料列與 R2 的檔案都刪掉，再刪一次回 404', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'mistake', title: '看圖題' })).data.note;
		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'q.png', { type: 'image/png' }));
		const photo = (await c.post(`/api/notes/${n.id}/attachments`, form)).data.attachment;

		expect((await c.del(`/api/attachments/${photo.id}`)).status).toBe(200);
		expect(await env.BUCKET.get(`users/${c.user.id}/${photo.id}`)).toBeNull();
		expect((await c.get(`/api/notes/${n.id}`)).data.note.attachments).toEqual([]);
		expect((await c.del(`/api/attachments/${photo.id}`)).status).toBe(404);
	});
});

describe('使用者之間的資料隔離', () => {
	it('看不到、改不了、刪不掉別人的資料與照片', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');

		const subject = await makeSubject(alice, '線性代數');
		const ev = (await alice.post('/api/events', { kind: 'exam', title: '小考', date: today(TZ) })).data.event;
		const task = (await alice.post('/api/tasks', { title: 'Alice 的任務' })).data.task;
		const note = (await alice.post('/api/notes', { kind: 'mistake', title: 'Alice 的錯題' })).data.note;
		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'a.png'));
		const att = (await alice.post(`/api/notes/${note.id}/attachments`, form)).data.attachment;

		for (const path of ['/api/subjects', '/api/events', '/api/tasks', '/api/notes']) {
			const key = path.split('/')[2];
			expect((await bob.get(path)).data[key], path).toHaveLength(0);
		}
		expect((await bob.get(`/api/notes/${note.id}`)).status).toBe(404);
		expect((await bob.get(`/api/attachments/${att.id}`)).status).toBe(404);

		expect((await bob.patch(`/api/tasks/${task.id}`, { title: '被竄改' })).status).toBe(404);
		expect((await bob.patch(`/api/events/${ev.id}`, { title: '被竄改' })).status).toBe(404);
		expect((await bob.del(`/api/subjects/${subject.id}`)).status).toBe(404);
		expect((await bob.del(`/api/attachments/${att.id}`)).status).toBe(404);
		expect((await bob.post(`/api/notes/${note.id}/review`, { result: 'remembered' })).status).toBe(404);

		// 不能把別人的科目、考試、任務掛到自己的資料上
		expect((await bob.post('/api/tasks', { title: 'x', subjectId: subject.id })).status).toBe(400);
		expect((await bob.post('/api/tasks', { title: 'x', eventId: ev.id })).status).toBe(400);
		const now = Date.now();
		expect((await bob.post('/api/study-sessions', { mode: 'manual', startedAt: now - 60_000, endedAt: now, taskId: task.id })).status).toBe(
			400,
		);

		expect((await alice.get(`/api/tasks`)).data.tasks[0].title).toBe('Alice 的任務');
	});
});
