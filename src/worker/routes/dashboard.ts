import { and, asc, count, eq, gte, lte, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { addDays, dateRange, today, weekStart } from '../../shared/dates';
import { events, notes, tasks } from '../db/schema';
import { minutesByDate, round1, sessionsBetween, streaks } from '../lib/stats';
import { requireAuth } from '../middleware/auth';
import type { DashboardResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

export const dashboardRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const tz = user.timezone;
	const todayStr = today(tz);

	const [upcomingEvents, focusTasks, [openTasks], [reviewDue], yearSessions] = await Promise.all([
		db
			.select()
			.from(events)
			.where(and(eq(events.userId, user.id), gte(events.date, todayStr)))
			.orderBy(asc(events.date), asc(events.time))
			.limit(5),
		// 今天要處理的：已到期/逾期，或正在進行中的任務
		db
			.select()
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done'), or(lte(tasks.dueDate, todayStr), eq(tasks.status, 'doing'))))
			.orderBy(sql`${tasks.dueDate} IS NULL`, asc(tasks.dueDate))
			.limit(8),
		db
			.select({ n: count() })
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done'))),
		db
			.select({ n: count() })
			.from(notes)
			.where(and(eq(notes.userId, user.id), eq(notes.mastered, false), lte(notes.nextReviewDate, todayStr))),
		sessionsBetween(db, user.id, tz, addDays(todayStr, -365), todayStr),
	]);

	const byDate = minutesByDate(yearSessions, tz);
	const week = weekStart(todayStr);
	const last7 = dateRange(addDays(todayStr, -6), todayStr).map((date) => ({ date, minutes: round1(byDate.get(date) ?? 0) }));
	const weekMinutes = [...byDate.entries()].filter(([d]) => d >= week).reduce((sum, [, m]) => sum + m, 0);

	const body: DashboardResponse = {
		today: todayStr,
		upcomingEvents,
		focusTasks,
		openTaskCount: openTasks.n,
		reviewDueCount: reviewDue.n,
		todayMinutes: round1(byDate.get(todayStr) ?? 0),
		weekMinutes: round1(weekMinutes),
		streak: streaks(new Set(byDate.keys()), todayStr).current,
		last7,
	};
	return c.json(body);
});
