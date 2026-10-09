import { describe, expect, it } from 'vitest';
import { registeredClient } from './helpers';

import { today } from '../src/shared/dates';
import { makeSubject, PNG_1X1 } from './helpers';
import { MINUTE_MS } from '../src/shared/time';

/** 有效的照片上傳表單（1×1 PNG） */
function photoForm() {
	const form = new FormData();
	form.append('file', new File([PNG_1X1], 'p.png', { type: 'image/png' }));
	return form;
}

// Sprint 3 QA：第二個帳號用第一個帳號的 id 操作，所有路徑都不能成功
describe('QA：跨使用者隔離矩陣', () => {
	it('存取別人的 id 回 404；把別人的 id 放進自己的資料回 400', async () => {
		const a = await registeredClient('甲');
		const b = await registeredClient('乙');
		const sub = (await a.post('/api/subjects', { name: '微積分', color: '#2563eb' })).data.subject;
		const ev = (await a.post('/api/events', { kind: 'exam', title: '期中', date: '2030-01-01', subjectId: sub.id })).data.event;
		const task = (await a.post('/api/tasks', { title: 't', subjectId: sub.id, eventId: ev.id })).data.task;
		const note = (await a.post('/api/notes', { kind: 'mistake', title: 'm', subjectId: sub.id })).data.note;
		const now = Date.now();

		const notFound: [string, string, unknown?][] = [
			['GET', `/api/notes/${note.id}`],
			['PATCH', `/api/notes/${note.id}`, { title: 'x' }],
			['DELETE', `/api/notes/${note.id}`],
			['POST', `/api/notes/${note.id}/review`, { result: 'forgot' }],
			// 送有效的照片：內容先檢查（400），內容沒問題才會走到「找不到筆記」（404）
			['POST', `/api/notes/${note.id}/attachments`, photoForm()],
			['PATCH', `/api/tasks/${task.id}`, { title: 'x' }],
			['DELETE', `/api/tasks/${task.id}`],
			['PATCH', `/api/events/${ev.id}`, { title: 'x' }],
			['DELETE', `/api/events/${ev.id}`],
			['GET', `/api/subjects/${sub.id}/overview`],
			['PATCH', `/api/subjects/${sub.id}`, { name: 'x' }],
			['DELETE', `/api/subjects/${sub.id}`],
		];
		for (const [method, path, body] of notFound) {
			const res = await (b as unknown as Record<string, (p: string, body?: unknown) => Promise<{ status: number }>>)[
				method === 'DELETE' ? 'del' : method.toLowerCase()
			](path, body);
			expect(res.status, `${method} ${path}`).toBe(404);
		}

		const badRef: [string, unknown][] = [
			['/api/tasks', { title: 't', subjectId: sub.id }],
			['/api/tasks', { title: 't', eventId: ev.id }],
			['/api/notes', { kind: 'note', title: 't', subjectId: sub.id }],
			['/api/events', { kind: 'exam', title: 't', date: '2030-01-01', subjectId: sub.id }],
			['/api/study-sessions', { mode: 'manual', startedAt: now - MINUTE_MS, endedAt: now - 1000, taskId: task.id }],
			['/api/study-sessions', { mode: 'manual', startedAt: now - MINUTE_MS, endedAt: now - 1000, subjectId: sub.id }],
			['/api/subjects/order', { ids: [sub.id] }],
		];
		for (const [path, body] of badRef) {
			const res = path.endsWith('/order') ? await b.put(path, body) : await b.post(path, body);
			expect(res.status, path).toBe(400);
		}

		// 甲的資料沒有被動到
		expect((await a.get(`/api/notes/${note.id}`)).data.note.title).toBe('m');
		expect((await a.get('/api/tasks')).data.tasks.length).toBe(1);
	});
});

const TZ = 'Asia/Taipei';

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
		expect(
			(await bob.post('/api/study-sessions', { mode: 'manual', startedAt: now - MINUTE_MS, endedAt: now, taskId: task.id })).status,
		).toBe(400);

		expect((await alice.get(`/api/tasks`)).data.tasks[0].title).toBe('Alice 的任務');
	});
});
