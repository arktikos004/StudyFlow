import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { localDateTime, today } from '../../shared/dates';
import { STUDY_MODE_LABEL, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from '../../shared/labels';
import { calendarExportQuerySchema } from '../../shared/schemas';
import { achievementUnlocks, attachments, events, notes, studySessions, subjects, tasks } from '../db/schema';
import { eventToIcs, taskToIcs } from '../lib/calendar-export';
import type { DB } from '../lib/db';
import { toCsv } from '../lib/csv';
import { buildCalendar } from '../lib/ics';
import { round1 } from '../lib/stats';
import { taskItemFields } from '../lib/tasks';
import { publicUser } from '../lib/users';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

// 匯出只查本人的資料：每張表查一次（WHERE user_id = ?），不用 inArray，名稱對照在記憶體裡做

const APP_NAME = 'StudyFlow';

/** RFC 5987：encodeURIComponent 不會編碼 ' ( ) *，但 filename* 裡不允許 */
const rfc5987 = (s: string) => encodeURIComponent(s).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);

type DownloadFile = {
	body: string;
	/** MIME 類型，例如 text/csv */
	type: string;
	/** 中文檔名裡的名稱（「StudyFlow 任務 2026-10-07.csv」的「任務」） */
	title: string;
	/** 英文檔名裡的名稱（「studyflow-tasks-2026-10-07.csv」的「tasks」） */
	slug: string;
	ext: string;
};

/**
 * 下載檔。檔名帶上使用者時區的今天：中文檔名放在 filename*，
 * 只有英文的 filename 給不支援 filename* 的舊瀏覽器。
 */
function download(c: Context<AppEnv>, { body, type, title, slug, ext }: DownloadFile) {
	const date = today(c.var.user.timezone);
	const name = `${APP_NAME} ${title} ${date}.${ext}`;
	const asciiName = `${APP_NAME.toLowerCase()}-${slug}-${date}.${ext}`;
	return c.body(body, 200, {
		'Content-Type': `${type}; charset=utf-8`,
		'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${rfc5987(name)}`,
	});
}

async function subjectNames(db: DB, userId: string) {
	const rows = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.userId, userId));
	return new Map(rows.map((s) => [s.id, s.name]));
}

export const exportRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/backup.json', async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const [subjectRows, eventRows, taskRows, sessionRows, noteRows, attachmentRows, unlockRows] = await Promise.all([
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
			// 成就的解鎖時間（PRO-2）：無法從其他資料算回來，所以也要備份
			db
				.select({ achievementId: achievementUnlocks.achievementId, unlockedAt: achievementUnlocks.unlockedAt })
				.from(achievementUnlocks)
				.where(eq(achievementUnlocks.userId, user.id))
				.orderBy(asc(achievementUnlocks.unlockedAt)),
		]);
		const backup = {
			app: APP_NAME,
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
			achievementUnlocks: unlockRows,
		};
		return download(c, { body: JSON.stringify(backup, null, 2), type: 'application/json', title: '備份', slug: 'backup', ext: 'json' });
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
					STUDY_MODE_LABEL[s.mode],
					s.subjectId ? subjectName.get(s.subjectId) : null,
					s.taskId ? taskTitle.get(s.taskId) : null,
					s.note,
				];
			}),
		);
		return download(c, { body: csv, type: 'text/csv', title: '學習紀錄', slug: 'sessions', ext: 'csv' });
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
				TASK_STATUS_LABEL[t.status],
				TASK_PRIORITY_LABEL[t.priority],
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
		return download(c, { body: csv, type: 'text/csv', title: '任務', slug: 'tasks', ext: 'csv' });
	})
	.get('/calendar.ics', validate('query', calendarExportQuerySchema), async (c) => {
		const db = c.var.db;
		const user = c.var.user;
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
		const nameOf = (subjectId: string | null) => (subjectId ? subjectName.get(subjectId) : undefined);

		const items = [
			...eventRows.map((event) => eventToIcs(event, nameOf(event.subjectId), user.timezone)),
			// 查詢已經排除沒有期限的任務
			...taskRows.map((task) => taskToIcs({ ...task, dueDate: task.dueDate! }, nameOf(task.subjectId))),
		];
		const ics = buildCalendar(items, { name: APP_NAME, now: Date.now() });
		return download(c, { body: ics, type: 'text/calendar', title: '行事曆', slug: 'calendar', ext: 'ics' });
	});
