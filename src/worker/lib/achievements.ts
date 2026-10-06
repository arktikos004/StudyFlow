import { and, count, eq } from 'drizzle-orm';
import { today } from '../../shared/dates';
import type { Achievement } from '../../shared/api-types';
import { notes, studySessions, tasks, type User } from '../db/schema';
import type { DB } from './db';
import { minutesByDate, round1, streaks } from './stats';

/** 番茄鐘成就只計入至少 10 分鐘的番茄紀錄，提早結束的 1 分鐘紀錄不算（PO 決定） */
const POMODORO_MIN_SEC = 600;

/** 小時數無條件捨去到小數 1 位：9.99 小時顯示 9.9，不會看起來已達成卻沒解鎖 */
const floor1 = (n: number) => Math.floor(n * 10) / 10;

/** 成就（GET /api/achievements）與個人檔案（GET /api/profile/summary）共用的累積值：全部歷史、只有本人的資料 */
export type Progress = {
	/** 學習紀錄的筆數與總秒數 */
	sessions: number;
	seconds: number;
	/** 合格的番茄鐘數：mode = 'pomodoro' 而且至少 10 分鐘 */
	pomodoros: number;
	/**
	 * 連續讀書天數，依使用者時區的當地日期分組（和 dashboard.streak 同一個 streaks()）。
	 * 這裡用全部歷史；總覽只讀近 366 天（今天與前 365 天），連續很久時總覽的數字會比較少：
	 * - 今天已經讀書：連續 367 天以上才不同（總覽最多 366）。
	 * - 今天還沒讀書（從昨天算起）：連續 366 天以上就不同（總覽最多 365）。
	 */
	currentStreak: number;
	longestStreak: number;
	/** 最長連續達成每日目標的天數；沒有設定目標時為 0 */
	longestGoalStreak: number;
	tasksDone: number;
	/** 已掌握的錯題（kind = 'mistake'）；一般筆記不算 */
	mistakesMastered: number;
};

/**
 * 讀取累積值：每張表只查一次，都用 WHERE user_id = ? 限定本人（不用 inArray）。
 * 學習紀錄只取三個欄位，筆數、秒數、番茄數與連續天數都在記憶體裡算。
 */
export async function loadProgress(db: DB, user: User): Promise<Progress> {
	const tz = user.timezone;
	const [sessionRows, [done], [mastered]] = await Promise.all([
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

	let seconds = 0;
	let pomodoros = 0;
	for (const s of sessionRows) {
		seconds += s.durationSec;
		if (s.mode === 'pomodoro' && s.durationSec >= POMODORO_MIN_SEC) pomodoros++;
	}

	const todayStr = today(tz);
	const byDate = minutesByDate(sessionRows, tz);
	const streak = streaks(new Set(byDate.keys()), todayStr);
	// 達成每日目標的日子（和統計頁一樣用四捨五入到 0.1 分的分鐘數判斷）
	const goal = user.dailyGoalMinutes;
	const goalDays = goal ? [...byDate].filter(([, minutes]) => round1(minutes) >= goal).map(([date]) => date) : [];

	return {
		sessions: sessionRows.length,
		seconds,
		pomodoros,
		currentStreak: streak.current,
		longestStreak: streak.longest,
		longestGoalStreak: goal ? streaks(new Set(goalDays), todayStr).longest : 0,
		tasksDone: done.n,
		mistakesMastered: mastered.n,
	};
}

type Def = Omit<Achievement, 'unlocked' | 'progress'> & {
	/** 目前的值（單位同 target）；達到 target 就解鎖 */
	value: number;
};

/**
 * 固定順序的成就清單（GET /api/achievements 的內容；個人檔案的徽章也依這個順序）。
 * 成就不另外存表，每次都從現有資料即時計算：
 * - 刪除學習紀錄、任務或錯題後，已經解鎖的徽章可能會被收回（PO 已接受）。
 * - goal-streak-7 用「目前」的每日目標判斷全部的歷史紀錄：改了目標結果就會跟著變，
 *   沒有設定目標時不計算（進度 0）。
 */
export function achievementList(p: Progress): Achievement[] {
	const hours = floor1(p.seconds / 3600);
	const defs: Def[] = [
		{ id: 'first-session', title: '踏出第一步', description: '記錄第一次讀書時間', icon: 'sparkles', target: 1, value: p.sessions },
		{ id: 'hours-10', title: '起步 10 小時', description: '累積讀書 10 小時', icon: 'clock', target: 10, value: hours },
		{ id: 'hours-50', title: '累積 50 小時', description: '累積讀書 50 小時', icon: 'hourglass', target: 50, value: hours },
		{ id: 'hours-100', title: '百小時里程碑', description: '累積讀書 100 小時', icon: 'trophy', target: 100, value: hours },
		{ id: 'streak-7', title: '連續一週', description: '連續 7 天都有讀書', icon: 'flame', target: 7, value: p.longestStreak },
		{ id: 'streak-30', title: '連續一個月', description: '連續 30 天都有讀書', icon: 'calendar-check', target: 30, value: p.longestStreak },
		{
			id: 'pomodoro-25',
			title: '番茄新手',
			description: '完成 25 個番茄鐘（每個至少 10 分鐘）',
			icon: 'timer',
			target: 25,
			value: p.pomodoros,
		},
		{
			id: 'pomodoro-100',
			title: '番茄達人',
			description: '完成 100 個番茄鐘（每個至少 10 分鐘）',
			icon: 'alarm-clock',
			target: 100,
			value: p.pomodoros,
		},
		{ id: 'mastered-10', title: '錯題剋星', description: '掌握 10 題錯題', icon: 'brain', target: 10, value: p.mistakesMastered },
		{ id: 'mastered-50', title: '錯題大師', description: '掌握 50 題錯題', icon: 'graduation-cap', target: 50, value: p.mistakesMastered },
		{ id: 'tasks-50', title: '使命必達', description: '完成 50 個任務', icon: 'list-checks', target: 50, value: p.tasksDone },
		{
			id: 'goal-streak-7',
			title: '說到做到',
			description: '連續 7 天達成每日讀書目標',
			icon: 'target',
			target: 7,
			value: p.longestGoalStreak,
		},
	];
	return defs.map(({ value, ...a }) => ({ ...a, unlocked: value >= a.target, progress: Math.min(value, a.target) }));
}
