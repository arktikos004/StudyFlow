import { and, count, eq, sql } from 'drizzle-orm';
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

/** 番茄鐘成就只計入至少 10 分鐘的番茄紀錄，提早結束的 1 分鐘紀錄不算（PO 決定） */
const POMODORO_MIN_SEC = 600;

/** 小時數無條件捨去到小數 1 位：9.99 小時顯示 9.9，不會看起來已達成卻沒解鎖 */
const floor1 = (n: number) => Math.floor(n * 10) / 10;

/*
 * 成就不另外存表，每次都從現有資料即時計算：
 * - 刪除學習紀錄、任務或錯題後，已經解鎖的徽章可能會被收回（PO 已接受）。
 * - goal-streak-7 用「目前」的每日目標判斷全部的歷史紀錄：改了目標結果就會跟著變，
 *   沒有設定目標時不計算（進度 0）。
 */
export const achievementRoutes = new Hono<AppEnv>().use(requireAuth).get('/', async (c) => {
	const db = c.var.db;
	const user = c.var.user;
	const tz = user.timezone;

	const [[sessionTotals], dayRows, [tasksDone], [mastered]] = await Promise.all([
		// 紀錄數、總秒數、合格的番茄數用 SQL 聚合
		db
			.select({
				sessions: count(),
				seconds: sql<number>`coalesce(sum(${studySessions.durationSec}), 0)`,
				pomodoros: sql<number>`coalesce(sum(CASE WHEN ${studySessions.mode} = 'pomodoro' AND ${studySessions.durationSec} >= ${POMODORO_MIN_SEC} THEN 1 ELSE 0 END), 0)`,
			})
			.from(studySessions)
			.where(eq(studySessions.userId, user.id)),
		// 連續天數要依使用者時區的當地日期分組，只取開始時間與秒數
		db
			.select({ startedAt: studySessions.startedAt, durationSec: studySessions.durationSec })
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
	const byDate = minutesByDate(dayRows, tz);
	const hours = sessionTotals.seconds / 3600;
	const longestStreak = streaks(new Set(byDate.keys()), todayStr).longest;
	// 達成每日目標的日子（和統計頁一樣用四捨五入到 0.1 分的分鐘數判斷）
	const goal = user.dailyGoalMinutes;
	const goalDays = goal ? [...byDate].filter(([, minutes]) => round1(minutes) >= goal).map(([date]) => date) : [];
	const longestGoalStreak = goal ? streaks(new Set(goalDays), todayStr).longest : 0;

	const defs: Def[] = [
		{ id: 'first-session', title: '踏出第一步', description: '記錄第一次讀書時間', icon: 'sparkles', target: 1, value: sessionTotals.sessions },
		{ id: 'hours-10', title: '起步 10 小時', description: '累積讀書 10 小時', icon: 'clock', target: 10, value: floor1(hours) },
		{ id: 'hours-50', title: '累積 50 小時', description: '累積讀書 50 小時', icon: 'hourglass', target: 50, value: floor1(hours) },
		{ id: 'hours-100', title: '百小時里程碑', description: '累積讀書 100 小時', icon: 'trophy', target: 100, value: floor1(hours) },
		{ id: 'streak-7', title: '連續一週', description: '連續 7 天都有讀書', icon: 'flame', target: 7, value: longestStreak },
		{ id: 'streak-30', title: '連續一個月', description: '連續 30 天都有讀書', icon: 'calendar-check', target: 30, value: longestStreak },
		{
			id: 'pomodoro-25',
			title: '番茄新手',
			description: '完成 25 個番茄鐘（每個至少 10 分鐘）',
			icon: 'timer',
			target: 25,
			value: sessionTotals.pomodoros,
		},
		{
			id: 'pomodoro-100',
			title: '番茄達人',
			description: '完成 100 個番茄鐘（每個至少 10 分鐘）',
			icon: 'alarm-clock',
			target: 100,
			value: sessionTotals.pomodoros,
		},
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
