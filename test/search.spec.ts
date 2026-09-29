import { describe, expect, it } from 'vitest';
import { addDays } from '../src/shared/dates';
import { createClient, noonClient, registeredClient, type Client } from './helpers';

const search = async (c: Client, q: string) => {
	const res = await c.get(`/api/search?q=${encodeURIComponent(q)}`);
	expect(res.status, JSON.stringify(res.data)).toBe(200);
	return res.data;
};
const ids = (list: { id: string }[]) => list.map((x) => x.id).sort();

describe('全站搜尋（APP-1）', () => {
	it('搜尋任務、考試、筆記、科目的指定欄位，支援中文子字串，只回傳清單需要的欄位', async () => {
		const c = await noonClient();
		const t = c.today;
		const subject = (await c.post('/api/subjects', { name: '線性代數', color: '#2a78d6', icon: 'sigma' })).data.subject;
		await c.post('/api/subjects', { name: '微積分', color: '#eb6834' });

		const taskByTitle = (await c.post('/api/tasks', { title: '線性代數作業 3', dueDate: t, subjectId: subject.id })).data.task;
		const taskByDesc = (await c.post('/api/tasks', { title: '讀書', description: '先讀線性代數第二章' })).data.task;
		await c.post('/api/tasks', { title: '微積分作業' });

		const evByTitle = (await c.post('/api/events', { kind: 'exam', title: '線性代數期中考', date: addDays(t, 7), subjectId: subject.id })).data
			.event;
		const evByLocation = (await c.post('/api/events', { kind: 'exam', title: '小考', date: addDays(t, 3), location: '線性代數教室' })).data.event;
		const evByNotes = (await c.post('/api/events', { kind: 'deadline', title: 'HW', date: addDays(t, 1), notes: '範圍：線性代數 1–3 章' })).data
			.event;
		await c.post('/api/events', { kind: 'exam', title: '微積分期中考', date: addDays(t, 8) });

		const noteByTitle = (await c.post('/api/notes', { kind: 'note', title: '線性代數筆記' })).data.note;
		const noteByContent = (await c.post('/api/notes', { kind: 'note', title: '重點', content: '線性代數的特徵值' })).data.note;
		const noteByQuestion = (await c.post('/api/notes', { kind: 'mistake', title: '錯題', question: '求線性代數矩陣的秩' })).data.note;
		await c.post('/api/notes', { kind: 'note', title: '其他', reason: '線性代數（reason 不在搜尋範圍）' });

		const r = await search(c, '線性代數');
		expect(ids(r.tasks)).toEqual(ids([taskByTitle, taskByDesc]));
		expect(ids(r.events)).toEqual(ids([evByTitle, evByLocation, evByNotes]));
		expect(ids(r.notes)).toEqual(ids([noteByTitle, noteByContent, noteByQuestion]));
		expect(r.subjects).toEqual([{ id: subject.id, name: '線性代數', color: '#2a78d6', icon: 'sigma' }]);

		expect(r.tasks.find((x: { id: string }) => x.id === taskByTitle.id)).toEqual({
			id: taskByTitle.id,
			title: '線性代數作業 3',
			subjectId: subject.id,
			dueDate: t,
			status: 'todo',
		});
		expect(r.events.find((x: { id: string }) => x.id === evByTitle.id)).toEqual({
			id: evByTitle.id,
			title: '線性代數期中考',
			date: addDays(t, 7),
			kind: 'exam',
			subjectId: subject.id,
		});
		expect(r.notes.find((x: { id: string }) => x.id === noteByQuestion.id)).toEqual({
			id: noteByQuestion.id,
			title: '錯題',
			kind: 'mistake',
			subjectId: null,
		});

		// 子字串
		expect((await search(c, '代數')).subjects).toHaveLength(1);
		expect(await search(c, '找不到的東西')).toEqual({ tasks: [], events: [], notes: [], subjects: [] });
	});

	it('每類最多 5 筆，並依規則排序', async () => {
		const c = await noonClient();
		const t = c.today;
		for (let i = 0; i < 7; i++) await c.post('/api/tasks', { title: `報告 ${i}` });
		const done = (await c.post('/api/tasks', { title: '報告 已完成', status: 'done' })).data.task;
		const r = await search(c, '報告');
		expect(r.tasks).toHaveLength(5);
		expect(r.tasks.map((x: { id: string }) => x.id)).not.toContain(done.id); // 未完成的排前面

		const past = (await c.post('/api/events', { kind: 'exam', title: '考試 上週', date: addDays(t, -7) })).data.event;
		const later = (await c.post('/api/events', { kind: 'exam', title: '考試 下個月', date: addDays(t, 30) })).data.event;
		const soon = (await c.post('/api/events', { kind: 'exam', title: '考試 明天', date: addDays(t, 1) })).data.event;
		const older = (await c.post('/api/events', { kind: 'exam', title: '考試 上個月', date: addDays(t, -30) })).data.event;
		expect((await search(c, '考試')).events.map((e: { id: string }) => e.id)).toEqual([soon.id, later.id, past.id, older.id]);

		const n1 = (await c.post('/api/notes', { kind: 'note', title: '筆記 一' })).data.note;
		const n2 = (await c.post('/api/notes', { kind: 'note', title: '筆記 二' })).data.note;
		await c.patch(`/api/notes/${n1.id}`, { pinned: true });
		expect((await search(c, '筆記')).notes.map((n: { id: string }) => n.id)).toEqual([n1.id, n2.id]);
	});

	it('英文不分大小寫；% 與 _ 是一般字元；長的中文關鍵字也可以', async () => {
		const c = await registeredClient();
		const big = (await c.post('/api/tasks', { title: 'Big-O 分析' })).data.task;
		const pct = (await c.post('/api/tasks', { title: '考試佔 40% 成績' })).data.task;
		const snake = (await c.post('/api/tasks', { title: 'snake_case' })).data.task;
		const long = '資料結構與演算法期中考重點整理第一章到第五章完整版'; // 75 bytes
		const longTask = (await c.post('/api/tasks', { title: `${long}（上）` })).data.task;

		expect(ids((await search(c, 'big-o')).tasks)).toEqual([big.id]);
		expect(ids((await search(c, '%')).tasks)).toEqual([pct.id]);
		expect(ids((await search(c, '_')).tasks)).toEqual([snake.id]);
		expect(ids((await search(c, long)).tasks)).toEqual([longTask.id]);
		expect(ids((await search(c, '  Big-O  ')).tasks)).toEqual([big.id]); // 前後空白會去掉
	});

	it('驗證：沒有關鍵字或超過 50 個字回 400', async () => {
		const c = await registeredClient();
		for (const path of ['/api/search', '/api/search?q=', `/api/search?q=${encodeURIComponent('   ')}`]) {
			const res = await c.get(path);
			expect(res.status, path).toBe(400);
			expect(res.data.error).toBe('請輸入搜尋關鍵字');
		}
		const tooLong = await c.get(`/api/search?q=${encodeURIComponent('字'.repeat(51))}`);
		expect(tooLong.status).toBe(400);
		expect(tooLong.data.error).toBe('搜尋關鍵字最多 50 個字');
		expect((await c.get(`/api/search?q=${encodeURIComponent('字'.repeat(50))}`)).status).toBe(200);
	});
});

describe('搜尋的跨使用者隔離', () => {
	it('只搜尋本人的資料；搜尋結果連到別人的資料回 404，引用別人的 id 回 400', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const subject = (await alice.post('/api/subjects', { name: '祕密科目', color: '#2a78d6' })).data.subject;
		await alice.post('/api/tasks', { title: '祕密任務' });
		await alice.post('/api/events', { kind: 'exam', title: '祕密考試', date: '2026-12-01' });
		const note = (await alice.post('/api/notes', { kind: 'note', title: '祕密筆記' })).data.note;
		await bob.post('/api/tasks', { title: 'Bob 的祕密' });

		const r = await search(bob, '祕密');
		expect(r.subjects).toEqual([]);
		expect(r.events).toEqual([]);
		expect(r.notes).toEqual([]);
		expect(r.tasks.map((x: { title: string }) => x.title)).toEqual(['Bob 的祕密']);
		expect((await search(alice, '祕密')).tasks.map((x: { title: string }) => x.title)).toEqual(['祕密任務']);

		expect((await bob.get(`/api/notes/${note.id}`)).status).toBe(404);
		expect((await bob.get(`/api/subjects/${subject.id}/overview`)).status).toBe(404);
		expect((await bob.post('/api/notes', { kind: 'note', title: '偷掛', subjectId: subject.id })).status).toBe(400);
	});

	it('未登入回 401', async () => {
		expect((await createClient().get('/api/search?q=a')).status).toBe(401);
	});
});
