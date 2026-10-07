import { and, asc, eq, gte, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { addDays, dateRange, startOfLocalDay, today, weekStart } from '../../shared/dates';
import { events, subjects, tasks } from '../db/schema';
import { eventItemFields } from '../lib/events';
import { countReviewDue } from '../lib/notes';
import { minutesByDate, recentStudySessions, round1, streaks, weekMinutesBySubject } from '../lib/stats';
import { countOpenTasks } from '../lib/tasks';
import { requireAuth } from '../middleware/auth';
import type { DashboardResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

const UPCOMING_EVENTS_LIMIT = 5;
const FOCUS_TASKS_LIMIT = 8;

export const dashboardRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const tz = user.timezone;
	const todayStr = today(tz);

	const [upcomingEvents, focusTasks, openTaskCount, reviewDueCount, yearSessions, goalSubjects] = await Promise.all([
		// 考試準備進度（DASH-1）：帶相關任務的完成數
		db
			.select(eventItemFields())
			.from(events)
			.where(and(eq(events.userId, user.id), gte(events.date, todayStr)))
			.orderBy(asc(events.date), asc(events.time))
			.limit(UPCOMING_EVENTS_LIMIT),
		// 今天要處理的：已到期/逾期，或正在進行中的任務
		db
			.select()
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), ne(tasks.status, 'done'), or(lte(tasks.dueDate, todayStr), eq(tasks.status, 'doing'))))
			.orderBy(sql`${tasks.dueDate} IS NULL`, asc(tasks.dueDate))
			.limit(FOCUS_TASKS_LIMIT),
		countOpenTasks(db, user.id),
		countReviewDue(db, user.id, todayStr),
		recentStudySessions(db, user.id, tz, todayStr),
		// 各科每週目標：封存的科目不列入
		db
			.select({ id: subjects.id, goalMinutes: subjects.weeklyGoalMinutes })
			.from(subjects)
			.where(and(eq(subjects.userId, user.id), eq(subjects.archived, false), isNotNull(subjects.weeklyGoalMinutes)))
			.orderBy(asc(subjects.sortOrder), asc(subjects.createdAt)),
	]);

	const byDate = minutesByDate(yearSessions, tz);
	const week = weekStart(todayStr);
	const last7 = dateRange(addDays(todayStr, -6), todayStr).map((date) => ({ date, minutes: round1(byDate.get(date) ?? 0) }));
	const weekMinutes = [...byDate.entries()].filter(([d]) => d >= week).reduce((sum, [, m]) => sum + m, 0);

	// 本週各科分鐘數：直接比較時間戳，不用再逐筆換算當地日期
	const weekBySubject = weekMinutesBySubject(yearSessions, startOfLocalDay(week, tz));

	const body: DashboardResponse = {
		today: todayStr,
		upcomingEvents,
		focusTasks,
		openTaskCount,
		reviewDueCount,
		todayMinutes: round1(byDate.get(todayStr) ?? 0),
		weekMinutes: round1(weekMinutes),
		streak: streaks(new Set(byDate.keys()), todayStr).current,
		last7,
		goals: {
			dailyMinutes: user.dailyGoalMinutes,
			weeklyMinutes: user.weeklyGoalMinutes,
			subjects: goalSubjects.map((s) => ({ subjectId: s.id, goalMinutes: s.goalMinutes!, minutes: round1(weekBySubject.get(s.id) ?? 0) })),
		},
	};
	return c.json(body);
});
