import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { addDays, localDateTime, today, zonedTime } from '../../shared/dates';
import { calendarExportQuerySchema } from '../../shared/schemas';
import { attachments, events, notes, studySessions, subjects, tasks } from '../db/schema';
import type { DB } from '../lib/db';
import { toCsv } from '../lib/csv';
import { buildCalendar, type IcsEvent } from '../lib/ics';
import { round1 } from '../lib/stats';
import { taskItemFields } from '../lib/tasks';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { publicUser } from './auth';

// 匯出只查本人的資料：每張表查一次（WHERE user_id = ?），不用 inArray，名稱對照在記憶體裡做

// 和前端 lib/format.ts 的文字一致
const MODE_LABEL = { pomodoro: '番茄鐘', stopwatch: '碼錶', manual: '手動補登' } as const;
const STATUS_LABEL = { todo: '待辦', doing: '進行中', done: '已完成' } as const;
const PRIORITY_LABEL = { high: '高', medium: '中', low: '低' } as const;
const KIND_LABEL = { exam: '考試', deadline: '截止日' } as const;

const HOUR_MS = 3_600_000;

/** RFC 5987：encodeURIComponent 不會編碼 ' ( ) *，但 filename* 裡不允許 */
const rfc5987 = (s: string) => encodeURIComponent(s).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);

/** 下載檔：中文檔名放在 filename*，filename 給不支援的舊瀏覽器 */
function download(c: Context<AppEnv>, body: string, type: string, name: string, fallback: string) {
	return c.body(body, 200, {
		'Content-Type': `${type}; charset=utf-8`,
		'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${rfc5987(name)}`,
	});
}

async function subjectNames(db: DB, userId: string) {
	const rows = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.userId, userId));
	return new Map(rows.map((s) => [s.id, s.name]));
}

/** 科目名稱與備註合在一起，當作日曆的說明 */
const icsDescription = (subject: string | undefined, text: string | null) => [subject && `科目：${subject}`, text].filter(Boolean).join('\n') || null;

export const exportRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/backup.json', async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const [subjectRows, eventRows, taskRows, sessionRows, noteRows, attachmentRows] = await Promise.all([
			db.select().from(subjects).where(eq(subjects.userId, user.id)).orderBy(asc(subjects.sortOrder), asc(subjects.createdAt)),
			db.select().from(events).where(eq(events.userId, user.id)).orderBy(asc(events.date), asc(events.time)),
			db.select().from(tasks).where(eq(tasks.userId, user.id)).orderBy(asc(tasks.createdAt)),
			db.select().from(studySessions).where(eq(studySessions.userId, user.id)).orderBy(asc(studySessions.startedAt)),
			db.select().from(notes).where(eq(notes.userId, user.id)).orderBy(asc(notes.createdAt)),
			// 照片只匯出中繼資料，不含 R2 的 key
			db
				.select({
					id: attachments.id,
					noteId: attachments.noteId,
					contentType: attachments.contentType,
					size: attachments.size,
					createdAt: attachments.createdAt,
				})
				.from(attachments)
				.where(eq(attachments.userId, user.id))
				.orderBy(asc(attachments.createdAt)),
		]);
		const backup = {
			app: 'StudyFlow',
			version: 1,
			exportedAt: new Date().toISOString(),
			// publicUser：不含密碼雜湊；登入 session 也不匯出
			user: publicUser(user),
			subjects: subjectRows,
			events: eventRows,
			tasks: taskRows,
			studySessions: sessionRows,
			notes: noteRows,
			attachments: attachmentRows,
		};
		const date = today(user.timezone);
		return download(c, JSON.stringify(backup, null, 2), 'application/json', `StudyFlow 備份 ${date}.json`, `studyflow-backup-${date}.json`);
	})
	.get('/sessions.csv', async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const tz = user.timezone;
		const [sessionRows, subjectName, taskRows] = await Promise.all([
			db.select().from(studySessions).where(eq(studySessions.userId, user.id)).orderBy(asc(studySessions.startedAt)),
			subjectNames(db, user.id),
			db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(eq(tasks.userId, user.id)),
		]);
		const taskTitle = new Map(taskRows.map((t) => [t.id, t.title]));
		const csv = toCsv(
			['日期', '開始', '結束', '分鐘數', '模式', '科目', '任務', '備註'],
			sessionRows.map((s) => {
				const start = localDateTime(s.startedAt, tz);
				return [
					start.slice(0, 10),
					start,
					localDateTime(s.endedAt, tz),
					round1(s.durationSec / 60),
					MODE_LABEL[s.mode],
					s.subjectId ? subjectName.get(s.subjectId) : null,
					s.taskId ? taskTitle.get(s.taskId) : null,
					s.note,
				];
			}),
		);
		const date = today(tz);
		return download(c, csv, 'text/csv', `StudyFlow 學習紀錄 ${date}.csv`, `studyflow-sessions-${date}.csv`);
	})
	.get('/tasks.csv', async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const tz = user.timezone;
		const [taskRows, subjectName] = await Promise.all([
			db.select(taskItemFields()).from(tasks).where(eq(tasks.userId, user.id)).orderBy(asc(tasks.createdAt)),
			subjectNames(db, user.id),
		]);
		const csv = toCsv(
			['標題', '科目', '狀態', '優先度', '期限', '預估分鐘', '已投入分鐘', '子項目完成', '子項目總數', '說明', '建立時間', '完成時間'],
			taskRows.map((t) => [
				t.title,
				t.subjectId ? subjectName.get(t.subjectId) : null,
				STATUS_LABEL[t.status],
				PRIORITY_LABEL[t.priority],
				t.dueDate,
				t.estimatedMinutes,
				t.spentMinutes,
				t.checklist.filter((i) => i.done).length,
				t.checklist.length,
				t.description,
				localDateTime(t.createdAt, tz),
				t.completedAt ? localDateTime(t.completedAt, tz) : null,
			]),
		);
		const date = today(tz);
		return download(c, csv, 'text/csv', `StudyFlow 任務 ${date}.csv`, `studyflow-tasks-${date}.csv`);
	})
	.get('/calendar.ics', validate('query', calendarExportQuerySchema), async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const tz = user.timezone;
		const withTasks = c.req.valid('query').tasks === '1';
		const [eventRows, subjectName, taskRows] = await Promise.all([
			db.select().from(events).where(eq(events.userId, user.id)).orderBy(asc(events.date), asc(events.time)),
			subjectNames(db, user.id),
			withTasks
				? db
						.select()
						.from(tasks)
						.where(and(eq(tasks.userId, user.id), isNotNull(tasks.dueDate)))
						.orderBy(asc(tasks.dueDate))
				: Promise.resolve([]),
		]);

		const items: IcsEvent[] = eventRows.map((e) => {
			const exam = e.kind === 'exam';
			const base = {
				uid: `${e.id}@studyflow`,
				summary: `【${KIND_LABEL[e.kind]}】${e.title}`,
				location: e.location,
				description: icsDescription(e.subjectId ? subjectName.get(e.subjectId) : undefined, e.notes),
				categories: KIND_LABEL[e.kind],
			};
			const alarmText = `明天考試：${e.title}`;
			if (e.time) {
				// 有時間：依使用者時區換算成 UTC，預設 1 小時；考試前一天同一時間提醒
				const start = zonedTime(e.date, e.time, tz);
				return {
					...base,
					start: { utc: start },
					end: { utc: start + HOUR_MS },
					alarm: exam ? { trigger: '-P1D', description: alarmText } : undefined,
				};
			}
			// 沒有時間：全天事件；考試前一天早上 9 點提醒（當天 00:00 往前 15 小時）
			return {
				...base,
				start: { date: e.date },
				end: { date: addDays(e.date, 1) },
				alarm: exam ? { trigger: '-PT15H', description: alarmText } : undefined,
			};
		});
		for (const t of taskRows) {
			items.push({
				uid: `${t.id}@studyflow`,
				summary: `【${t.status === 'done' ? '已完成' : '任務'}】${t.title}`,
				start: { date: t.dueDate! },
				end: { date: addDays(t.dueDate!, 1) },
				description: icsDescription(t.subjectId ? subjectName.get(t.subjectId) : undefined, t.description),
				categories: '任務',
			});
		}

		const date = today(tz);
		const ics = buildCalendar(items, { name: 'StudyFlow', now: Date.now() });
		return download(c, ics, 'text/calendar', `StudyFlow 行事曆 ${date}.ics`, `studyflow-calendar-${date}.ics`);
	});
