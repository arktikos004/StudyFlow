import { and, asc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { today } from '../../shared/dates';
import { events, tasks } from '../db/schema';
import { countReviewDue } from '../lib/notes';
import { requireAuth } from '../middleware/auth';
import type { SummaryResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

// 頁首與快速搜尋常常會呼叫：每張表只查一次，都走 user_id 開頭的 index
export const summaryRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const todayStr = today(user.timezone);

	const [[taskCounts], reviewDueCount, [nextExam]] = await Promise.all([
		db
			.select({
				dueToday: sql<number>`coalesce(sum(CASE WHEN ${tasks.dueDate} = ${todayStr} THEN 1 ELSE 0 END), 0)`,
				overdue: sql<number>`coalesce(sum(CASE WHEN ${tasks.dueDate} < ${todayStr} THEN 1 ELSE 0 END), 0)`,
			})
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done'), lte(tasks.dueDate, todayStr))),
		countReviewDue(db, user.id, todayStr),
		db
			.select({ id: events.id, title: events.title, date: events.date, time: events.time, subjectId: events.subjectId })
			.from(events)
			.where(and(eq(events.userId, user.id), eq(events.kind, 'exam'), gte(events.date, todayStr)))
			.orderBy(asc(events.date), asc(events.time))
			.limit(1),
	]);

	const body: SummaryResponse = {
		today: todayStr,
		dueTodayCount: taskCounts.dueToday,
		overdueCount: taskCounts.overdue,
		reviewDueCount,
		nextExam: nextExam ?? null,
	};
	return c.json(body);
});
