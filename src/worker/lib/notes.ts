import { and, count, eq, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { notes } from '../db/schema';
import type { DB } from './db';
import { masteredNextDate } from './review';
import { containsText } from './text';

/**
 * 到期待複習：排定的複習日是今天或更早（沒有排程的複習日是 NULL，不會符合）。
 * 已掌握的題目只有選擇定期複習時才有複習日，所以不必另外排除。
 */
export const reviewDue = (todayStr: string): SQL => lte(notes.nextReviewDate, todayStr);

/**
 * 使用者改了「已掌握的錯題每幾天複習」的預設：沒有自己設定間隔的已掌握題目，
 * 下次複習改成今天加上新的間隔（改成不提醒時清掉）。一條 SQL，不受題目數量影響。
 */
export function rescheduleMasteredNotes(db: DB, userId: string, todayStr: string, days: number | null) {
	return db
		.update(notes)
		.set({ nextReviewDate: masteredNextDate(todayStr, days) })
		.where(and(eq(notes.userId, userId), eq(notes.mastered, true), isNull(notes.masteredReviewDays)));
}

/** 本人到期待複習的筆記與錯題數（總覽、頁首摘要用同一個數字） */
export async function countReviewDue(db: DB, userId: string, todayStr: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(notes)
		.where(and(eq(notes.userId, userId), reviewDue(todayStr)));
	return row.n;
}

/** 本人錯題的總數、已掌握、到期待複習；給 subjectId 就只算那一科 */
export async function mistakeCounts(db: DB, userId: string, todayStr: string, subjectId?: string) {
	const [row] = await db
		.select({
			total: count(),
			mastered: sql<number>`coalesce(sum(CASE WHEN ${notes.mastered} THEN 1 ELSE 0 END), 0)`,
			due: sql<number>`coalesce(sum(CASE WHEN ${reviewDue(todayStr)} THEN 1 ELSE 0 END), 0)`,
		})
		.from(notes)
		.where(and(eq(notes.userId, userId), eq(notes.kind, 'mistake'), subjectId ? eq(notes.subjectId, subjectId) : undefined));
	return row;
}

/** 筆記的關鍵字比對：標題、內容、題目（筆記列表與全站搜尋相同） */
export const noteMatches = (keyword: string) =>
	or(containsText(notes.title, keyword), containsText(notes.content, keyword), containsText(notes.question, keyword));
