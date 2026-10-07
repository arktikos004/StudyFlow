import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { addDays, dateRange, localDate, today, weekStart } from '../../shared/dates';
import { tasks } from '../db/schema';
import { mistakeCounts } from '../lib/notes';
import { minutesByDate, round1, sessionsBetween, streaks } from '../lib/stats';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { StatsResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

const statsQuery = z.object({ days: z.enum(['7', '30', '90']).default('30') });

const HEATMAP_WEEKS = 16;

export const statsRoutes = new Hono<AppEnv>().use(requireAuth).get('/', validate('query', statsQuery), async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const tz = user.timezone;
	const days = Number(c.req.valid('query').days);
	const to = today(tz);
	const from = addDays(to, -(days - 1));

	// 一次抓一年，連續天數、熱度圖和區間統計都從這份資料算
	const yearFrom = addDays(to, -365);
	const yearSessions = await sessionsBetween(db, user.id, tz, yearFrom, to);
	const yearByDate = minutesByDate(yearSessions, tz);
	const rangeSessions = yearSessions.filter((s) => localDate(s.startedAt, tz) >= from);

	// 每日學習時間（依科目拆分）
	const daily = dateRange(from, to).map((date) => ({ date, minutes: 0, bySubject: {} as Record<string, number> }));
	const dailyIndex = new Map(daily.map((d, i) => [d.date, i]));
	const subjectTotals = new Map<string, number>();
	for (const s of rangeSessions) {
		const day = daily[dailyIndex.get(localDate(s.startedAt, tz))!];
		const key = s.subjectId ?? 'none';
		const min = s.durationSec / 60;
		day.minutes += min;
		day.bySubject[key] = (day.bySubject[key] ?? 0) + min;
		subjectTotals.set(key, (subjectTotals.get(key) ?? 0) + min);
	}
	for (const d of daily) {
		d.minutes = round1(d.minutes);
		for (const k of Object.keys(d.bySubject)) d.bySubject[k] = round1(d.bySubject[k]);
	}

	const totalMinutes = rangeSessions.reduce((sum, s) => sum + s.durationSec / 60, 0);
	const activeDays = daily.filter((d) => d.minutes > 0).length;
	const streak = streaks(new Set(yearByDate.keys()), to);
	// 和畫面顯示的一樣，用四捨五入到 0.1 分的每日分鐘數判斷是否達標
	const dailyGoal = user.dailyGoalMinutes;
	const goalMetDays = dailyGoal ? daily.filter((d) => d.minutes >= dailyGoal).length : 0;

	// 熱度圖：最近 16 週，從週一開始排
	const heatFrom = weekStart(addDays(to, -(HEATMAP_WEEKS * 7 - 1)));
	const heatmap = dateRange(heatFrom, to).map((date) => ({ date, minutes: round1(yearByDate.get(date) ?? 0) }));

	// 每週任務：期限落在該週的任務有幾項、完成幾項
	const firstWeek = weekStart(from);
	const dueTasks = await db
		.select({ dueDate: tasks.dueDate, status: tasks.status })
		.from(tasks)
		.where(and(eq(tasks.userId, user.id), gte(tasks.dueDate, firstWeek), lte(tasks.dueDate, to)));
	const weekly: { weekStart: string; due: number; done: number }[] = [];
	for (let w = firstWeek; w <= to; w = addDays(w, 7)) weekly.push({ weekStart: w, due: 0, done: 0 });
	for (const t of dueTasks) {
		const wk = weekly.find((w) => w.weekStart === weekStart(t.dueDate!));
		if (!wk) continue;
		wk.due++;
		if (t.status === 'done') wk.done++;
	}

	const [taskCounts] = await db
		.select({
			total: count(),
			done: sql<number>`coalesce(sum(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END), 0)`,
			overdue: sql<number>`coalesce(sum(CASE WHEN ${tasks.status} != 'done' AND ${tasks.dueDate} < ${to} THEN 1 ELSE 0 END), 0)`,
		})
		.from(tasks)
		.where(eq(tasks.userId, user.id));

	const mistakes = await mistakeCounts(db, user.id, to);

	const body: StatsResponse = {
		range: { from, to, days },
		totals: {
			minutes: round1(totalMinutes),
			sessions: rangeSessions.length,
			activeDays,
			avgMinutesPerDay: round1(totalMinutes / days),
			currentStreak: streak.current,
			longestStreak: streak.longest,
			goalMetDays,
		},
		daily,
		bySubject: [...subjectTotals.entries()]
			.map(([subjectId, minutes]) => ({ subjectId: subjectId === 'none' ? null : subjectId, minutes: round1(minutes) }))
			.sort((a, b) => b.minutes - a.minutes),
		heatmap,
		weekly,
		tasks: taskCounts,
		mistakes,
		dailyGoalMinutes: dailyGoal,
	};
	return c.json(body);
});
