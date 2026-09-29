import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/shared/dates';
import { createClient, noonClient, registeredClient, type Client } from './helpers';

async function mistakeDue(c: Client, title: string, nextReviewDate: string | null, mastered = false) {
	const note = (await c.post('/api/notes', { kind: 'mistake', title })).data.note;
	await env.DB.prepare('UPDATE notes SET next_review_date = ?, mastered = ? WHERE id = ?')
		.bind(nextReviewDate, mastered ? 1 : 0, note.id)
		.run();
	return note;
}

describe('頁首摘要 /api/summary', () => {
	it('計算今天到期、逾期、待複習的數量，以及下一場考試', async () => {
		const c = await noonClient();
		const t = c.today;
		const subject = (await c.post('/api/subjects', { name: '資料結構', color: '#2a78d6' })).data.subject;

		await c.post('/api/tasks', { title: '今天到期 1', dueDate: t });
		await c.post('/api/tasks', { title: '今天到期 2', dueDate: t, status: 'doing' });
		await c.post('/api/tasks', { title: '今天到期但已完成', dueDate: t, status: 'done' });
		await c.post('/api/tasks', { title: '逾期', dueDate: addDays(t, -3) });
		await c.post('/api/tasks', { title: '逾期但已完成', dueDate: addDays(t, -3), status: 'done' });
		await c.post('/api/tasks', { title: '明天到期', dueDate: addDays(t, 1) });
		await c.post('/api/tasks', { title: '沒有期限' });

		await mistakeDue(c, '今天複習', t);
		await mistakeDue(c, '前天就該複習', addDays(t, -2));
		await mistakeDue(c, '明天複習', addDays(t, 1));
		await mistakeDue(c, '已掌握', t, true);

		await c.post('/api/events', { kind: 'exam', title: '昨天的考試', date: addDays(t, -1) });
		await c.post('/api/events', { kind: 'deadline', title: '今天截止（不是考試）', date: t });
		await c.post('/api/events', { kind: 'exam', title: '下週考試', date: addDays(t, 7) });
		await c.post('/api/events', { kind: 'exam', title: '後天晚上考', date: addDays(t, 2), time: '19:00' });
		const next = (await c.post('/api/events', { kind: 'exam', title: '後天下午考', date: addDays(t, 2), time: '14:00', subjectId: subject.id }))
			.data.event;

		const res = await c.get('/api/summary');
		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			today: t,
			dueTodayCount: 2,
			overdueCount: 1,
			reviewDueCount: 2,
			nextExam: { id: next.id, title: '後天下午考', date: addDays(t, 2), time: '14:00', subjectId: subject.id },
		});
	});

	it('今天的考試也算下一場；沒有考試時為 null', async () => {
		const c = await noonClient();
		expect((await c.get('/api/summary')).data).toEqual({
			today: c.today,
			dueTodayCount: 0,
			overdueCount: 0,
			reviewDueCount: 0,
			nextExam: null,
		});
		const exam = (await c.post('/api/events', { kind: 'exam', title: '今天的小考', date: c.today })).data.event;
		expect((await c.get('/api/summary')).data.nextExam).toEqual({ id: exam.id, title: '今天的小考', date: c.today, time: null, subjectId: null });
	});
});

describe('總覽：考試準備進度（DASH-1）', () => {
	it('即將到來的考試帶有相關任務的總數與完成數', async () => {
		const c = await noonClient();
		const exam = (await c.post('/api/events', { kind: 'exam', title: '期中考', date: addDays(c.today, 3) })).data.event;
		const hw = (await c.post('/api/events', { kind: 'deadline', title: 'HW1', date: addDays(c.today, 5) })).data.event;
		const t1 = (await c.post('/api/tasks', { title: '第一章', eventId: exam.id })).data.task;
		await c.post('/api/tasks', { title: '第二章', eventId: exam.id });
		await c.post('/api/tasks', { title: '第三章', eventId: exam.id });
		await c.patch(`/api/tasks/${t1.id}`, { status: 'done' });

		const dash = (await c.get('/api/dashboard')).data;
		expect(dash.upcomingEvents).toMatchObject([
			{ id: exam.id, title: '期中考', taskTotal: 3, taskDone: 1 },
			{ id: hw.id, title: 'HW1', taskTotal: 0, taskDone: 0 },
		]);
	});
});

describe('摘要的跨使用者隔離', () => {
	it('只計算本人的資料；改不到別人的考試；不能把任務掛到別人的考試上', async () => {
		const alice = await noonClient('Alice');
		const bob = await registeredClient('Bob');
		await alice.post('/api/tasks', { title: '逾期', dueDate: addDays(alice.today, -1) });
		await mistakeDue(alice, '要複習', alice.today);
		const exam = (await alice.post('/api/events', { kind: 'exam', title: 'Alice 的考試', date: addDays(alice.today, 1) })).data.event;

		const bobSummary = (await bob.get('/api/summary')).data;
		expect(bobSummary).toMatchObject({ dueTodayCount: 0, overdueCount: 0, reviewDueCount: 0, nextExam: null });

		// 別人的資料回 404；引用別人的 id 回 400
		expect((await bob.patch(`/api/events/${exam.id}`, { date: addDays(alice.today, 30) })).status).toBe(404);
		const hijack = await bob.post('/api/tasks', { title: '偷掛', eventId: exam.id });
		expect(hijack.status).toBe(400);
		expect(hijack.data.error).toBe('找不到指定的考試或截止日');

		expect((await alice.get('/api/summary')).data).toMatchObject({ overdueCount: 1, reviewDueCount: 1, nextExam: { id: exam.id } });
		expect((await alice.get('/api/dashboard')).data.upcomingEvents).toMatchObject([{ id: exam.id, taskTotal: 0, taskDone: 0 }]);
	});

	it('未登入回 401', async () => {
		expect((await createClient().get('/api/summary')).status).toBe(401);
	});
});
