import { and, eq, gte, lt } from 'drizzle-orm';
import { addDays, localDate, startOfLocalDay } from '../../shared/dates';
import { studySessions } from '../db/schema';
import type { DB } from './db';

export type SessionLite = { subjectId: string | null; startedAt: number; durationSec: number };

/** 取出某段本地日期區間（含頭尾）內開始的學習紀錄 */
export async function sessionsBetween(db: DB, userId: string, tz: string, from: string, to: string): Promise<SessionLite[]> {
	return db
		.select({ subjectId: studySessions.subjectId, startedAt: studySessions.startedAt, durationSec: studySessions.durationSec })
		.from(studySessions)
		.where(
			and(
				eq(studySessions.userId, userId),
				gte(studySessions.startedAt, startOfLocalDay(from, tz)),
				lt(studySessions.startedAt, startOfLocalDay(addDays(to, 1), tz)),
			),
		);
}

/** 依本地日期加總分鐘數（學習時段歸在開始的那一天） */
export function minutesByDate(sessions: SessionLite[], tz: string): Map<string, number> {
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

export const round1 = (n: number) => Math.round(n * 10) / 10;
