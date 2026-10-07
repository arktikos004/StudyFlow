import { Hono } from 'hono';
import { z } from 'zod';
import { addDays, today, weekStart } from '../../shared/dates';
import { mistakeCounts } from '../lib/notes';
import {
	buildHeatmap,
	buildWeeklyTaskCounts,
	metDailyGoal,
	minutesByDate,
	recentStudySessions,
	round1,
	streaks,
	subjectRanking,
	summarizeRange,
} from '../lib/stats';
import { countTasks, tasksDueBetween } from '../lib/tasks';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import type { StatsResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

const statsQuery = z.object({ days: z.enum(['7', '30', '90']).default('30') });

export const statsRoutes = new Hono<AppEnv>().use(requireAuth).get('/', validate('query', statsQuery), async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const tz = user.timezone;
	const days = Number(c.req.valid('query').days);
	const to = today(tz);
	const from = addDays(to, -(days - 1));

	// 學習紀錄一次抓近一年：連續天數、熱度圖和區間統計都從這份資料算
	const [yearSessions, dueTasks, taskCounts, mistakes] = await Promise.all([
		recentStudySessions(db, user.id, tz, to),
		tasksDueBetween(db, user.id, weekStart(from), to),
		countTasks(db, user.id, to),
		mistakeCounts(db, user.id, to),
	]);
	const minutesPerDay = minutesByDate(yearSessions, tz);
	const range = summarizeRange(yearSessions, from, to, tz);
	const streak = streaks(new Set(minutesPerDay.keys()), to);
	const dailyGoal = user.dailyGoalMinutes;

	const body: StatsResponse = {
		range: { from, to, days },
		totals: {
			minutes: round1(range.totalMinutes),
			sessions: range.sessionCount,
			activeDays: range.daily.filter((day) => day.minutes > 0).length,
			avgMinutesPerDay: round1(range.totalMinutes / days),
			currentStreak: streak.current,
			longestStreak: streak.longest,
			goalMetDays: dailyGoal ? range.daily.filter((day) => metDailyGoal(day.minutes, dailyGoal)).length : 0,
		},
		daily: range.daily,
		bySubject: subjectRanking(range.minutesBySubject),
		heatmap: buildHeatmap(minutesPerDay, to),
		weekly: buildWeeklyTaskCounts(dueTasks, from, to),
		tasks: taskCounts,
		mistakes,
		dailyGoalMinutes: dailyGoal,
	};
	return c.json(body);
});
