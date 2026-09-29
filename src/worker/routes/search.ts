import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { today } from '../../shared/dates';
import { searchQuerySchema } from '../../shared/schemas';
import { events, notes, subjects, tasks } from '../db/schema';
import { containsText } from '../lib/text';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { SearchResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

const LIMIT = 5;

// 全站快速搜尋（Ctrl/⌘+K）：四類各查一次、每類最多 5 筆，都只查本人的資料。
// 用 instr 比對子字串（見 lib/text.ts），中文關鍵字再長也不會碰到 D1 的 LIKE 上限。
export const searchRoutes = new Hono<AppEnv>().use(requireAuth).get('/', validate('query', searchQuerySchema), async (c) => {
	const { q } = c.req.valid('query');
	const db = c.var.db;
	const user = c.var.user;
	const todayStr = today(user.timezone);

	const [taskRows, eventRows, noteRows, subjectRows] = await Promise.all([
		db
			.select({ id: tasks.id, title: tasks.title, subjectId: tasks.subjectId, dueDate: tasks.dueDate, status: tasks.status })
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), or(containsText(tasks.title, q), containsText(tasks.description, q))))
			.orderBy(sql`${tasks.status} = 'done'`, desc(tasks.updatedAt))
			.limit(LIMIT),
		db
			.select({ id: events.id, title: events.title, date: events.date, kind: events.kind, subjectId: events.subjectId })
			.from(events)
			.where(
				and(eq(events.userId, user.id), or(containsText(events.title, q), containsText(events.location, q), containsText(events.notes, q))),
			)
			// 今天以後的依日期由近到遠排前面，已經過去的再依日期由近到遠
			.orderBy(sql`${events.date} < ${todayStr}`, sql`CASE WHEN ${events.date} >= ${todayStr} THEN ${events.date} END`, desc(events.date))
			.limit(LIMIT),
		db
			.select({ id: notes.id, title: notes.title, kind: notes.kind, subjectId: notes.subjectId })
			.from(notes)
			.where(and(eq(notes.userId, user.id), or(containsText(notes.title, q), containsText(notes.content, q), containsText(notes.question, q))))
			.orderBy(desc(notes.pinned), desc(notes.updatedAt))
			.limit(LIMIT),
		db
			.select({ id: subjects.id, name: subjects.name, color: subjects.color, icon: subjects.icon })
			.from(subjects)
			.where(and(eq(subjects.userId, user.id), containsText(subjects.name, q)))
			.orderBy(asc(subjects.archived), asc(subjects.sortOrder), asc(subjects.createdAt))
			.limit(LIMIT),
	]);

	const body: SearchResponse = { tasks: taskRows, events: eventRows, notes: noteRows, subjects: subjectRows };
	return c.json(body);
});
