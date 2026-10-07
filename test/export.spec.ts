import { describe, expect, it } from 'vitest';
import { today } from '../src/shared/dates';
import { createClient, decodeText, PNG_1X1, registeredClient, type Client } from './helpers';

/** 簡單的 RFC 4180 解析：處理雙引號、逗號與欄位內換行 */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else cell += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ',') {
			row.push(cell);
			cell = '';
		} else if (ch === '\r' && text[i + 1] === '\n') {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
			i++;
		} else cell += ch;
	}
	return rows;
}

async function download(c: Client, path: string) {
	const res = await c.get(path);
	expect(res.status, path).toBe(200);
	return { text: decodeText(res.data), headers: res.headers };
}

/** 把 ICS 的每個 VEVENT 取出來（已還原折行） */
function vevents(ics: string) {
	return ics
		.replace(/\r\n /g, '')
		.split('BEGIN:VEVENT\r\n')
		.slice(1)
		.map((block) => block.slice(0, block.indexOf('END:VEVENT')));
}

describe('JSON 備份（DATA-1）', () => {
	it('包含科目、考試、任務、學習紀錄、筆記與照片中繼資料；不含密碼雜湊、登入 session 與 R2 key', async () => {
		const c = await registeredClient('小明');
		const subject = (await c.post('/api/subjects', { name: '資料結構', color: '#2a78d6', icon: 'code' })).data.subject;
		const event = (await c.post('/api/events', { kind: 'exam', title: '期中考', date: '2026-11-03', subjectId: subject.id })).data.event;
		const task = (
			await c.post('/api/tasks', { title: '複習', subjectId: subject.id, checklist: [{ id: 'a', title: '第一章', done: true }] })
		).data.task;
		const now = Date.now();
		const session = (await c.post('/api/study-sessions', { mode: 'pomodoro', startedAt: now - 30 * 60_000, endedAt: now - 5 * 60_000 }))
			.data.session;
		const note = (await c.post('/api/notes', { kind: 'mistake', title: '錯題', tags: ['遞迴'] })).data.note;
		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'q.png', { type: 'image/png' }));
		const att = (await c.post(`/api/notes/${note.id}/attachments`, form)).data.attachment;

		const res = await c.get('/api/export/backup.json');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
		const disposition = res.headers.get('content-disposition')!;
		const date = today('Asia/Taipei');
		expect(disposition).toContain(`filename="studyflow-backup-${date}.json"`);
		expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent(`StudyFlow 備份 ${date}.json`)}`);
		expect(res.headers.get('cache-control')).toBe('no-store');

		const b = res.data;
		expect(b).toMatchObject({ app: 'StudyFlow', version: 1, user: { id: c.user.id, email: c.email, displayName: '小明' } });
		expect(b.subjects).toMatchObject([{ id: subject.id, name: '資料結構', icon: 'code' }]);
		expect(b.events).toMatchObject([{ id: event.id, title: '期中考' }]);
		expect(b.tasks).toMatchObject([{ id: task.id, checklist: [{ id: 'a', title: '第一章', done: true }] }]);
		expect(b.studySessions).toMatchObject([{ id: session.id, mode: 'pomodoro', durationSec: 25 * 60 }]);
		expect(b.notes).toMatchObject([{ id: note.id, tags: ['遞迴'] }]);
		expect(b.attachments).toEqual([
			{ id: att.id, noteId: note.id, contentType: 'image/png', size: PNG_1X1.byteLength, createdAt: att.createdAt },
		]);

		const raw = JSON.stringify(b);
		expect(raw).not.toMatch(/password|pbkdf2|r2Key|r2_key|expiresAt/i);
		expect(raw).not.toContain(c.cookie.split('=')[1]);
	});
});

describe('CSV 匯出（DATA-1）', () => {
	it('學習紀錄：UTF-8 BOM、CRLF、依使用者時區、顯示科目與任務名稱、防公式注入', async () => {
		const c = await registeredClient();
		await c.patch('/api/auth/me', { timezone: 'Asia/Tokyo' });
		const subject = (await c.post('/api/subjects', { name: '=SUM(A1)', color: '#2a78d6' })).data.subject;
		const task = (await c.post('/api/tasks', { title: '+惡意任務' })).data.task;
		// 2026-01-15 01:00Z = 東京 10:00
		const s1 = Date.UTC(2026, 0, 15, 1, 0);
		await c.post('/api/study-sessions', {
			mode: 'manual',
			startedAt: s1,
			endedAt: s1 + 90 * 60_000,
			subjectId: subject.id,
			taskId: task.id,
			note: '-1 分',
		});
		// 2026-01-16 15:30Z = 東京 1/17 00:30
		const s2 = Date.UTC(2026, 0, 16, 15, 30);
		await c.post('/api/study-sessions', {
			mode: 'pomodoro',
			startedAt: s2,
			endedAt: s2 + 30 * 60_000,
			durationSec: 25 * 60,
			note: '第一行, "引號"\n第二行',
		});

		const { text, headers } = await download(c, '/api/export/sessions.csv');
		expect(headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('StudyFlow 學習紀錄')}`);
		expect(text.startsWith('﻿')).toBe(true);
		expect(text.endsWith('\r\n')).toBe(true);
		expect(text).toContain('"第一行, ""引號""\n第二行"');

		expect(parseCsv(text.slice(1))).toEqual([
			['日期', '開始', '結束', '分鐘數', '模式', '科目', '任務', '備註'],
			['2026-01-15', '2026-01-15 10:00', '2026-01-15 11:30', '90', '手動補登', "'=SUM(A1)", "'+惡意任務", "'-1 分"],
			['2026-01-17', '2026-01-17 00:30', '2026-01-17 01:00', '25', '番茄鐘', '', '', '第一行, "引號"\n第二行'],
		]);
	});

	it('任務：狀態與優先度用中文、顯示投入時間與子項目、時間依使用者時區、防公式注入', async () => {
		const c = await registeredClient(); // Asia/Taipei
		const subject = (await c.post('/api/subjects', { name: '資料結構', color: '#2a78d6' })).data.subject;
		const t1 = (
			await c.post('/api/tasks', {
				title: '=HYPERLINK("http://evil")',
				subjectId: subject.id,
				status: 'doing',
				priority: 'high',
				dueDate: '2026-10-01',
				estimatedMinutes: 60,
				description: 'a,b',
				checklist: [
					{ id: '1', title: '一', done: true },
					{ id: '2', title: '二', done: false },
				],
			})
		).data.task;
		const now = Date.now();
		await c.post('/api/study-sessions', { mode: 'manual', startedAt: now - 40 * 60_000, endedAt: now - 10 * 60_000, taskId: t1.id });
		const t2 = (await c.post('/api/tasks', { title: '@寫報告', priority: 'low' })).data.task;
		const done = (await c.patch(`/api/tasks/${t2.id}`, { status: 'done' })).data.task;

		const { text } = await download(c, '/api/export/tasks.csv');
		expect(text.startsWith('﻿')).toBe(true);
		const rows = parseCsv(text.slice(1));
		expect(rows[0]).toEqual([
			'標題',
			'科目',
			'狀態',
			'優先度',
			'期限',
			'預估分鐘',
			'已投入分鐘',
			'子項目完成',
			'子項目總數',
			'說明',
			'建立時間',
			'完成時間',
		]);
		const taipei = (ms: number) =>
			new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short' }).format(ms);
		expect(rows[1]).toEqual([
			`'=HYPERLINK("http://evil")`,
			'資料結構',
			'進行中',
			'高',
			'2026-10-01',
			'60',
			'30',
			'1',
			'2',
			'a,b',
			taipei(t1.createdAt),
			'',
		]);
		expect(rows[2]).toEqual(["'@寫報告", '', '已完成', '低', '', '', '0', '0', '0', '', taipei(t2.createdAt), taipei(done.completedAt)]);
	});
});

describe('行事曆匯出（CAL-2）', () => {
	it('符合 RFC 5545：CRLF、75 octets 折行、固定 UID、跳脫、UTC 時間、全天事件、考試前一天提醒', async () => {
		const c = await registeredClient(); // Asia/Taipei
		const subject = (await c.post('/api/subjects', { name: '資料結構', color: '#2a78d6' })).data.subject;
		const longTitle = '資料結構與演算法'.repeat(10); // 80 字 = 240 bytes
		const exam = (
			await c.post('/api/events', {
				kind: 'exam',
				title: '期中考, 第一次; 重要',
				date: '2026-11-03',
				time: '09:10',
				location: '工學院 E101',
				notes: '範圍：第 1–5 章\n帶計算機',
				subjectId: subject.id,
			})
		).data.event;
		const allDay = (await c.post('/api/events', { kind: 'exam', title: longTitle, date: '2027-01-10' })).data.event;
		const deadline = (await c.post('/api/events', { kind: 'deadline', title: 'HW3', date: '2026-10-20', time: '23:59' })).data.event;
		const task = (await c.post('/api/tasks', { title: '複習第一章', dueDate: '2026-10-30', subjectId: subject.id })).data.task;
		await c.post('/api/tasks', { title: '沒有期限的任務' });

		const { text, headers } = await download(c, '/api/export/calendar.ics');
		expect(headers.get('content-type')).toBe('text/calendar; charset=utf-8');
		expect(headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('StudyFlow 行事曆')}`);
		expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
		expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
		expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
		expect(text).not.toContain('�'); // 折行沒有切斷中文

		const blocks = vevents(text);
		expect(blocks).toHaveLength(3); // 預設不含任務
		const [examBlock, allDayBlock, deadlineBlock] = [exam, allDay, deadline].map((e) =>
			blocks.find((b) => b.includes(`UID:${e.id}@studyflow\r\n`))!,
		);

		expect(examBlock).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
		expect(examBlock).toContain('DTSTART:20261103T011000Z\r\n'); // 台北 09:10 = UTC 01:10
		expect(examBlock).toContain('DTEND:20261103T021000Z\r\n'); // 預設 1 小時
		expect(examBlock).toContain('SUMMARY:【考試】期中考\\, 第一次\\; 重要\r\n');
		expect(examBlock).toContain('LOCATION:工學院 E101\r\n');
		expect(examBlock).toContain('DESCRIPTION:科目：資料結構\\n範圍：第 1–5 章\\n帶計算機\r\n');
		expect(examBlock).toMatch(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:-P1D\r\nEND:VALARM/);

		expect(allDayBlock).toContain('DTSTART;VALUE=DATE:20270110\r\n');
		expect(allDayBlock).toContain('DTEND;VALUE=DATE:20270111\r\n');
		expect(allDayBlock).toContain(`SUMMARY:【考試】${longTitle}\r\n`);
		expect(allDayBlock).toContain('TRIGGER:-PT15H\r\n'); // 前一天早上 9 點

		expect(deadlineBlock).toContain('DTSTART:20261020T155900Z\r\n');
		expect(deadlineBlock).not.toContain('VALARM');

		// tasks=1：有期限的任務變成全天事件
		const withTasks = vevents((await download(c, '/api/export/calendar.ics?tasks=1')).text);
		expect(withTasks).toHaveLength(4);
		const taskBlock = withTasks.find((b) => b.includes(`UID:${task.id}@studyflow\r\n`))!;
		expect(taskBlock).toContain('DTSTART;VALUE=DATE:20261030\r\n');
		expect(taskBlock).toContain('SUMMARY:【任務】複習第一章\r\n');
		expect(taskBlock).toContain('DESCRIPTION:科目：資料結構\r\n');
		expect(taskBlock).not.toContain('VALARM');
		expect((await download(c, '/api/export/calendar.ics?tasks=0')).text).not.toContain(task.id);

		// 同一筆資料每次匯出的 UID 相同
		expect(vevents((await download(c, '/api/export/calendar.ics')).text).map((b) => b.split('\r\n')[0])).toEqual(
			blocks.map((b) => b.split('\r\n')[0]),
		);

		const bad = await c.get('/api/export/calendar.ics?tasks=yes');
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('參數格式錯誤');
	});

	it('夏令時間切換當天也換算成正確的 UTC', async () => {
		const c = await registeredClient();
		await c.patch('/api/auth/me', { timezone: 'America/New_York' });
		// 紐約 2026-03-08 凌晨 2 點起改成夏令時間（UTC-4）
		const e = (await c.post('/api/events', { kind: 'exam', title: 'DST', date: '2026-03-08', time: '09:00' })).data.event;
		const [block] = vevents((await download(c, '/api/export/calendar.ics')).text);
		expect(block).toContain(`UID:${e.id}@studyflow`);
		expect(block).toContain('DTSTART:20260308T130000Z\r\n');
	});
});

describe('匯出的跨使用者隔離', () => {
	it('只包含本人的資料；別人的資料回 404、引用別人的 id 回 400，都不會出現在匯出檔', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const secret = (await alice.post('/api/subjects', { name: 'Alice 的科目', color: '#2a78d6' })).data.subject;
		const aliceTask = (await alice.post('/api/tasks', { title: 'Alice 的任務', dueDate: '2026-12-01' })).data.task;
		await alice.post('/api/events', { kind: 'exam', title: 'Alice 的考試', date: '2026-12-02' });
		await bob.post('/api/tasks', { title: 'Bob 的任務', dueDate: '2026-12-03' });

		expect((await bob.patch(`/api/tasks/${aliceTask.id}`, { title: '被竄改' })).status).toBe(404);
		expect((await bob.post('/api/tasks', { title: '偷掛科目', subjectId: secret.id })).status).toBe(400);
		const now = Date.now();
		expect(
			(await bob.post('/api/study-sessions', { mode: 'manual', startedAt: now - 600_000, endedAt: now - 60_000, taskId: aliceTask.id }))
				.status,
		).toBe(400);

		const bobFiles = [
			JSON.stringify((await bob.get('/api/export/backup.json')).data),
			(await download(bob, '/api/export/sessions.csv')).text,
			(await download(bob, '/api/export/tasks.csv')).text,
			(await download(bob, '/api/export/calendar.ics?tasks=1')).text,
		];
		for (const file of bobFiles) {
			expect(file).not.toContain('Alice');
			expect(file).not.toContain(alice.user.id);
			expect(file).not.toContain(secret.id);
		}
		expect(bobFiles[2]).toContain('Bob 的任務');
		expect(bobFiles[3]).toContain('Bob 的任務');
		expect((await download(alice, '/api/export/tasks.csv')).text).toContain('Alice 的任務');
	});

	it('未登入回 401', async () => {
		const anon = createClient();
		for (const file of ['backup.json', 'sessions.csv', 'tasks.csv', 'calendar.ics']) {
			expect((await anon.get(`/api/export/${file}`)).status, file).toBe(401);
		}
	});
});
