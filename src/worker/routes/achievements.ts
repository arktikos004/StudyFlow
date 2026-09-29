import { and, count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { today } from '../../shared/dates';
import { notes, studySessions, tasks } from '../db/schema';
import { minutesByDate, round1, streaks } from '../lib/stats';
import { requireAuth } from '../middleware/auth';
import type { Achievement, AchievementsResponse } from '../../shared/api-types';
import type { AppEnv } from '../types';

type Def = Omit<Achievement, 'unlocked' | 'progress'> & {
	/** 目前的值（單位同 target）；達到 target 就解鎖 */
	value: number;
};

/** 小時數無條件捨去到小數 1 位：9.99 小時顯示 9.9，不會看起來已達成卻沒解鎖 */
const floor1 = (n: number) => Math.floor(n * 10) / 10;

// 成就只從現有資料即時計算，不另外存表：學習紀錄查一次，任務與錯題各一個 count
export const achievementRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const tz = user.timezone;

	const [sessionRows, [tasksDone], [mastered]] = await Promise.all([
		db
			.select({ startedAt: studySessions.startedAt, durationSec: studySessions.durationSec, mode: studySessions.mode })
			.from(studySessions)
			.where(eq(studySessions.userId, user.id)),
		db
			.select({ n: count() })
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), eq(tasks.status, 'done'))),
		db
			.select({ n: count() })
			.from(notes)
			.where(and(eq(notes.userId, user.id), eq(notes.kind, 'mistake'), eq(notes.mastered, true))),
	]);

	const todayStr = today(tz);
	const byDate = minutesByDate(sessionRows, tz);
	const hours = sessionRows.reduce((sum, s) => sum + s.durationSec, 0) / 3600;
	const pomodoros = sessionRows.filter((s) => s.mode === 'pomodoro').length;
	const longestStreak = streaks(new Set(byDate.keys()), todayStr).longest;
	// 達成每日目標的日子（和統計頁一樣用四捨五入到 0.1 分的分鐘數判斷）；沒有設定目標時不計算
	const goal = user.dailyGoalMinutes;
	const goalDays = goal ? [...byDate].filter(([, minutes]) => round1(minutes) >= goal).map(([date]) => date) : [];
	const longestGoalStreak = goal ? streaks(new Set(goalDays), todayStr).longest : 0;

	const defs: Def[] = [
		{ id: 'first-session', title: '踏出第一步', description: '記錄第一次讀書時間', icon: 'sparkles', target: 1, value: sessionRows.length },
		{ id: 'hours-10', title: '起步 10 小時', description: '累積讀書 10 小時', icon: 'clock', target: 10, value: floor1(hours) },
		{ id: 'hours-50', title: '累積 50 小時', description: '累積讀書 50 小時', icon: 'hourglass', target: 50, value: floor1(hours) },
		{ id: 'hours-100', title: '百小時里程碑', description: '累積讀書 100 小時', icon: 'trophy', target: 100, value: floor1(hours) },
		{ id: 'streak-7', title: '連續一週', description: '連續 7 天都有讀書', icon: 'flame', target: 7, value: longestStreak },
		{ id: 'streak-30', title: '連續一個月', description: '連續 30 天都有讀書', icon: 'calendar-check', target: 30, value: longestStreak },
		{ id: 'pomodoro-25', title: '番茄新手', description: '完成 25 個番茄鐘', icon: 'timer', target: 25, value: pomodoros },
		{ id: 'pomodoro-100', title: '番茄達人', description: '完成 100 個番茄鐘', icon: 'alarm-clock', target: 100, value: pomodoros },
		{ id: 'mastered-10', title: '錯題剋星', description: '掌握 10 題錯題', icon: 'brain', target: 10, value: mastered.n },
		{ id: 'mastered-50', title: '錯題大師', description: '掌握 50 題錯題', icon: 'graduation-cap', target: 50, value: mastered.n },
		{ id: 'tasks-50', title: '使命必達', description: '完成 50 個任務', icon: 'list-checks', target: 50, value: tasksDone.n },
		{ id: 'goal-streak-7', title: '說到做到', description: '連續 7 天達成每日讀書目標', icon: 'target', target: 7, value: longestGoalStreak },
	];

	const body: AchievementsResponse = {
		achievements: defs.map(({ value, ...a }) => ({ ...a, unlocked: value >= a.target, progress: Math.min(value, a.target) })),
	};
	return c.json(body);
});
