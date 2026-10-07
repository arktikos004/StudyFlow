import { and, eq, gte, lt, type SQL } from 'drizzle-orm';
import { NO_SUBJECT_KEY, type StatsResponse } from '../../shared/api-types';
import { addDays, dateRange, localDate, startOfLocalDay, weekStart } from '../../shared/dates';
import { studySessions } from '../db/schema';
import type { DB } from './db';

// 學習紀錄的統計：查詢條件與純計算。總覽、統計、成就、個人檔案共用，數字才會一致。

/** 統計需要的學習紀錄欄位 */
export type StudySessionLite = { subjectId: string | null; startedAt: number; durationSec: number };

/**
 * 總覽與統計一次讀回的天數（今天往前）：連續天數、熱度圖與區間統計都從這份資料算。
 * 所以總覽的連續天數最多是 366（今天加上前 365 天）；個人檔案與成就讀全部歷史，不受這個限制。
 */
export const ACTIVITY_LOOKBACK_DAYS = 365;

const HEATMAP_WEEKS = 16;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** 這一天有沒有達成每日目標：和畫面顯示的一樣，用四捨五入到 0.1 分的分鐘數判斷 */
export const metDailyGoal = (minutes: number, goalMinutes: number) => round1(minutes) >= goalMinutes;

/** 學習紀錄的開始時間落在某段本地日期（含頭尾）的條件 */
export const startedBetween = (from: string, to: string, tz: string): SQL =>
	and(gte(studySessions.startedAt, startOfLocalDay(from, tz)), lt(studySessions.startedAt, startOfLocalDay(addDays(to, 1), tz)))!;

/** 近一年（到今天為止）的學習紀錄，只取統計需要的欄位 */
export function recentStudySessions(db: DB, userId: string, tz: string, todayStr: string): Promise<StudySessionLite[]> {
	return db
		.select({ subjectId: studySessions.subjectId, startedAt: studySessions.startedAt, durationSec: studySessions.durationSec })
		.from(studySessions)
		.where(and(eq(studySessions.userId, userId), startedBetween(addDays(todayStr, -ACTIVITY_LOOKBACK_DAYS), todayStr, tz)));
}

/** 依本地日期加總分鐘數（學習時段歸在開始的那一天） */
export function minutesByDate(sessions: Pick<StudySessionLite, 'startedAt' | 'durationSec'>[], tz: string): Map<string, number> {
	const map = new Map<string, number>();
	for (const s of sessions) {
		const d = localDate(s.startedAt, tz);
		map.set(d, (map.get(d) ?? 0) + s.durationSec / 60);
	}
	return map;
}

/**
 * 連續學習天數：從今天往回數；今天還沒讀書的話從昨天開始算，
 * 避免一早打開就看到連續紀錄歸零。
 */
export function streaks(activeDates: Set<string>, todayStr: string) {
	let current = 0;
	let d = activeDates.has(todayStr) ? todayStr : addDays(todayStr, -1);
	while (activeDates.has(d)) {
		current++;
		d = addDays(d, -1);
	}

	let longest = 0;
	let run = 0;
	let prev: string | null = null;
	for (const date of [...activeDates].sort()) {
		run = prev && addDays(prev, 1) === date ? run + 1 : 1;
		longest = Math.max(longest, run);
		prev = date;
	}
	return { current, longest };
}

/**
 * 一段日期（含頭尾）的學習統計：每天的分鐘數（依科目拆分，沒有科目的記在 NO_SUBJECT_KEY）、
 * 各科與整段的總分鐘數、筆數。區間以外的紀錄不計。每天的數字四捨五入到 0.1 分，總數不先四捨五入。
 */
export function summarizeRange(sessions: readonly StudySessionLite[], from: string, to: string, tz: string) {
	const daily: StatsResponse['daily'] = dateRange(from, to).map((date) => ({ date, minutes: 0, bySubject: {} }));
	const dayOf = new Map(daily.map((day) => [day.date, day]));
	const minutesBySubject = new Map<string, number>();
	let totalMinutes = 0;
	let sessionCount = 0;
	for (const session of sessions) {
		const day = dayOf.get(localDate(session.startedAt, tz));
		if (!day) continue;
		const subject = session.subjectId ?? NO_SUBJECT_KEY;
		const minutes = session.durationSec / 60;
		day.minutes += minutes;
		day.bySubject[subject] = (day.bySubject[subject] ?? 0) + minutes;
		minutesBySubject.set(subject, (minutesBySubject.get(subject) ?? 0) + minutes);
		totalMinutes += minutes;
		sessionCount++;
	}
	for (const day of daily) {
		day.minutes = round1(day.minutes);
		for (const subject of Object.keys(day.bySubject)) day.bySubject[subject] = round1(day.bySubject[subject]);
	}
	return { daily, minutesBySubject, totalMinutes, sessionCount };
}

/** 各科的分鐘數，由多到少；沒有科目的 subjectId 是 null */
export function subjectRanking(minutesBySubject: ReadonlyMap<string, number>): StatsResponse['bySubject'] {
	return [...minutesBySubject]
		.map(([subject, minutes]) => ({ subjectId: subject === NO_SUBJECT_KEY ? null : subject, minutes: round1(minutes) }))
		.sort((a, b) => b.minutes - a.minutes);
}

/** 熱度圖：最近 16 週每天的分鐘數，從 16 週前那一週的週一排到今天 */
export function buildHeatmap(minutesPerDay: ReadonlyMap<string, number>, todayStr: string): StatsResponse['heatmap'] {
	const from = weekStart(addDays(todayStr, -(HEATMAP_WEEKS * 7 - 1)));
	return dateRange(from, todayStr).map((date) => ({ date, minutes: round1(minutesPerDay.get(date) ?? 0) }));
}

/**
 * 每週任務：期限落在該週（週一起算）的任務有幾項、完成幾項，從 from 所在的那一週排到 to。
 * 期限不在這幾週裡的任務不計。
 */
export function buildWeeklyTaskCounts(
	dueTasks: readonly { dueDate: string | null; status: string }[],
	from: string,
	to: string,
): StatsResponse['weekly'] {
	const weeks = new Map<string, StatsResponse['weekly'][number]>();
	for (let week = weekStart(from); week <= to; week = addDays(week, 7)) weeks.set(week, { weekStart: week, due: 0, done: 0 });
	for (const task of dueTasks) {
		const week = task.dueDate ? weeks.get(weekStart(task.dueDate)) : undefined;
		if (!week) continue;
		week.due++;
		if (task.status === 'done') week.done++;
	}
	return [...weeks.values()];
}

/** 本週（weekStartTs 之後）各科的分鐘數；沒有科目的紀錄不計 */
export function weekMinutesBySubject(sessions: readonly StudySessionLite[], weekStartTs: number): Map<string, number> {
	const minutes = new Map<string, number>();
	for (const session of sessions) {
		if (session.subjectId && session.startedAt >= weekStartTs) {
			minutes.set(session.subjectId, (minutes.get(session.subjectId) ?? 0) + session.durationSec / 60);
		}
	}
	return minutes;
}
