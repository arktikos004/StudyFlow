import { and, asc, count, desc, eq, getTableColumns, gte, lte, ne, sql } from 'drizzle-orm';
import type { StatsResponse } from '../../shared/api-types';
import { tasks } from '../db/schema';
import type { DB } from './db';

/**
 * 任務的實際投入時間：本人在該任務的學習秒數加總 ÷ 60，四捨五入到小數 1 位。
 * 子查詢要明確寫出表名：寫成 ${tasks.id} 會被印成 "id"，被解析成 study_sessions 自己的 id。
 */
const spentMinutes = () =>
	sql<number>`(SELECT round(coalesce(sum(s.duration_sec), 0) / 60.0, 1) FROM study_sessions s WHERE s.task_id = tasks.id AND s.user_id = tasks.user_id)`;

/** 查詢或 returning 用的欄位：任務全部欄位加上 spentMinutes（= TaskItem） */
export const taskItemFields = () => ({ ...getTableColumns(tasks), spentMinutes: spentMinutes() });

/** 任務列表的順序：有期限的排前面、期限近的優先，再依優先度（高 → 低）、最新建立的在前 */
export const taskListOrder = () => [
	sql`${tasks.dueDate} IS NULL`,
	asc(tasks.dueDate),
	sql`CASE ${tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
	desc(tasks.createdAt),
];

/** 任務狀態改變時的完成時間：變成已完成記下現在，離開已完成就清掉；狀態沒變時維持原值 */
export function completedAtAfter(status: string | undefined, previous: { status: string; completedAt: number | null } | null, now: number) {
	if (!status || status === previous?.status) return previous?.completedAt ?? null;
	return status === 'done' ? now : null;
}

/** 本人還沒完成的任務數 */
export async function countOpenTasks(db: DB, userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(tasks)
		.where(and(eq(tasks.userId, userId), ne(tasks.status, 'done')));
	return row.n;
}

/** 本人任務的總數、已完成、逾期（還沒完成而且期限早於今天） */
export async function countTasks(db: DB, userId: string, todayStr: string): Promise<StatsResponse['tasks']> {
	const [row] = await db
		.select({
			total: count(),
			done: sql<number>`coalesce(sum(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END), 0)`,
			overdue: sql<number>`coalesce(sum(CASE WHEN ${tasks.status} != 'done' AND ${tasks.dueDate} < ${todayStr} THEN 1 ELSE 0 END), 0)`,
		})
		.from(tasks)
		.where(eq(tasks.userId, userId));
	return row;
}

/** 期限落在 from～to（含頭尾）的任務，只取期限與狀態 */
export function tasksDueBetween(db: DB, userId: string, from: string, to: string) {
	return db
		.select({ dueDate: tasks.dueDate, status: tasks.status })
		.from(tasks)
		.where(and(eq(tasks.userId, userId), gte(tasks.dueDate, from), lte(tasks.dueDate, to)));
}
