import { describe, expect, it } from 'vitest';
import { logSession, noonClient, registeredClient, type Client } from './helpers';

/** 一小時前結束、長度 30 分鐘的紀錄 */
async function makeSession(c: Client, body: Record<string, unknown> = {}) {
	const endedAt = Date.now() - 60 * 60_000;
	const res = await c.post('/api/study-sessions', { mode: 'manual', startedAt: endedAt - 30 * 60_000, endedAt, ...body });
	expect(res.status, JSON.stringify(res.data)).toBe(201);
	return res.data.session;
}

async function makeSubject(c: Client, name = '數學') {
	return (await c.post('/api/subjects', { name, color: '#2a78d6' })).data.subject;
}

describe('編輯學習紀錄（TMR-2）', () => {
	it('可以改科目、任務、模式與備註；沒改時間時秒數不變', async () => {
		const c = await registeredClient();
		const subject = await makeSubject(c);
		const task = (await c.post('/api/tasks', { title: '寫習題', subjectId: subject.id })).data.task;
		const s = await makeSession(c, { durationSec: 25 * 60, note: '原本的備註' });

		const res = await c.patch(`/api/study-sessions/${s.id}`, {
			subjectId: subject.id,
			taskId: task.id,
			mode: 'pomodoro',
			note: '  選錯科目了  ',
		});
		expect(res.status).toBe(200);
		expect(res.data.session).toMatchObject({
			id: s.id,
			subjectId: subject.id,
			taskId: task.id,
			mode: 'pomodoro',
			note: '選錯科目了',
			startedAt: s.startedAt,
			endedAt: s.endedAt,
			durationSec: 25 * 60,
		});

		const cleared = await c.patch(`/api/study-sessions/${s.id}`, { subjectId: null, taskId: null, note: null });
		expect(cleared.data.session).toMatchObject({ subjectId: null, taskId: null, note: null, durationSec: 25 * 60 });

		// 沒有任何欄位的 PATCH 不會改動資料
		const noop = await c.patch(`/api/study-sessions/${s.id}`, {});
		expect(noop.status).toBe(200);
		expect(noop.data.session).toMatchObject({ startedAt: s.startedAt, endedAt: s.endedAt, durationSec: 25 * 60 });
	});

	it('改了起訖時間但沒給秒數：依新的起訖時間重新計算', async () => {
		const c = await registeredClient();
		const s = await makeSession(c, { durationSec: 20 * 60 }); // 30 分鐘的時段，實際專注 20 分

		const longer = await c.patch(`/api/study-sessions/${s.id}`, { endedAt: s.endedAt + 15 * 60_000 });
		expect(longer.data.session).toMatchObject({ endedAt: s.endedAt + 15 * 60_000, durationSec: 45 * 60 });

		const earlier = await c.patch(`/api/study-sessions/${s.id}`, { startedAt: s.startedAt - 60 * 60_000 });
		expect(earlier.data.session.durationSec).toBe(105 * 60);
	});

	it('沒給秒數時由起訖時間推算，至少 1 秒：新增與編輯用同一個算法（起訖只差 0.3 秒不會存成 0 秒）', async () => {
		const c = await registeredClient();
		const endedAt = Date.now() - 60 * 60_000;
		const created = await c.post('/api/study-sessions', { mode: 'stopwatch', startedAt: endedAt - 300, endedAt });
		expect(created.status, JSON.stringify(created.data)).toBe(201);
		expect(created.data.session.durationSec).toBe(1);

		const edited = await c.patch(`/api/study-sessions/${created.data.session.id}`, { startedAt: endedAt - 200 });
		expect(edited.status).toBe(200);
		expect(edited.data.session.durationSec).toBe(1);
	});

	it('可以只改秒數，或同時改時間與秒數；秒數不能超過起訖時間', async () => {
		const c = await registeredClient();
		const s = await makeSession(c);
		expect((await c.patch(`/api/study-sessions/${s.id}`, { durationSec: 600 })).data.session.durationSec).toBe(600);

		const startedAt = s.startedAt - 30 * 60_000; // 時段變成 60 分鐘
		const both = await c.patch(`/api/study-sessions/${s.id}`, { startedAt, durationSec: 50 * 60 });
		expect(both.data.session).toMatchObject({ startedAt, durationSec: 50 * 60 });

		const tooLong = await c.patch(`/api/study-sessions/${s.id}`, { durationSec: 61 * 60 + 1 });
		expect(tooLong.status).toBe(400);
		expect(tooLong.data.error).toBe('學習秒數不可超過起訖時間');
	});

	it('規則和新增時一樣：不能是未來的時間、不超過 24 小時、結束要晚於開始', async () => {
		const c = await registeredClient();
		const s = await makeSession(c);
		const cases: [Record<string, unknown>, string][] = [
			[{ endedAt: Date.now() + 60 * 60_000 }, '不能記錄未來的時間'],
			[{ startedAt: s.endedAt - 25 * 3_600_000 }, '單次學習不可超過 24 小時'],
			[{ startedAt: s.endedAt + 60_000 }, '結束時間必須晚於開始時間'],
			[{ endedAt: s.startedAt }, '結束時間必須晚於開始時間'],
			[{ durationSec: 31 * 60 + 1 }, '學習秒數不可超過起訖時間'],
			[{ subjectId: 'not-a-uuid' }, 'ID 格式錯誤'],
		];
		for (const [body, error] of cases) {
			const res = await c.patch(`/api/study-sessions/${s.id}`, body);
			expect(res.status, error).toBe(400);
			expect(res.data.error).toBe(error);
		}
		expect((await c.patch(`/api/study-sessions/${s.id}`, { mode: 'nap' })).status).toBe(400);
		expect((await c.patch(`/api/study-sessions/${s.id}`, { durationSec: 0 })).status).toBe(400);

		// 失敗時原紀錄不變
		const [after] = (await c.get('/api/study-sessions')).data.sessions;
		expect(after).toMatchObject({ startedAt: s.startedAt, endedAt: s.endedAt, durationSec: s.durationSec, mode: 'manual' });
	});

	it('編輯後，任務投入時間、總覽與統計都跟著更新', async () => {
		const c = await noonClient();
		const math = await makeSubject(c);
		const taskA = (await c.post('/api/tasks', { title: '任務 A' })).data.task;
		const taskB = (await c.post('/api/tasks', { title: '任務 B' })).data.task;
		const s = await logSession(c, c.today, 9, 30, { subjectId: math.id, taskId: taskA.id });

		const spent = async () =>
			Object.fromEntries(
				(await c.get('/api/tasks')).data.tasks.map((t: { title: string; spentMinutes: number }) => [t.title, t.spentMinutes]),
			);
		expect(await spent()).toEqual({ '任務 A': 30, '任務 B': 0 });

		await c.patch(`/api/study-sessions/${s.id}`, { taskId: taskB.id, endedAt: s.endedAt + 15 * 60_000 });
		expect(await spent()).toEqual({ '任務 A': 0, '任務 B': 45 });
		expect((await c.get('/api/dashboard')).data.todayMinutes).toBe(45);
		expect((await c.get('/api/stats?days=7')).data.daily.at(-1)).toMatchObject({
			date: c.today,
			minutes: 45,
			bySubject: { [math.id]: 45 },
		});
	});
});

describe('學習紀錄編輯的跨使用者隔離', () => {
	it('別人的紀錄回 404；引用別人的科目或任務回 400', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const aliceSubject = await makeSubject(alice);
		const aliceTask = (await alice.post('/api/tasks', { title: 'Alice 的任務' })).data.task;
		const aliceSession = await makeSession(alice);
		const bobSession = await makeSession(bob);

		const res = await bob.patch(`/api/study-sessions/${aliceSession.id}`, { note: '竄改' });
		expect(res.status).toBe(404);
		expect(res.data.error).toBe('找不到此學習紀錄');
		expect((await bob.patch(`/api/study-sessions/${crypto.randomUUID()}`, { note: 'x' })).status).toBe(404);

		const badSubject = await bob.patch(`/api/study-sessions/${bobSession.id}`, { subjectId: aliceSubject.id });
		expect(badSubject.status).toBe(400);
		expect(badSubject.data.error).toBe('找不到指定的科目');
		const badTask = await bob.patch(`/api/study-sessions/${bobSession.id}`, { taskId: aliceTask.id });
		expect(badTask.status).toBe(400);
		expect(badTask.data.error).toBe('找不到指定的任務');

		// 兩邊的資料都沒有被改到
		expect((await alice.get('/api/study-sessions')).data.sessions[0].note).toBeNull();
		expect((await bob.get('/api/study-sessions')).data.sessions[0]).toMatchObject({ subjectId: null, taskId: null });
		expect((await alice.get('/api/tasks')).data.tasks[0].spentMinutes).toBe(0);
	});
});
