import { getTableColumns, sql } from 'drizzle-orm';
import { tasks } from '../db/schema';

/**
 * 任務的實際投入時間：本人在該任務的學習秒數加總 ÷ 60，四捨五入到小數 1 位。
 * 子查詢要明確寫出表名：寫成 ${tasks.id} 會被印成 "id"，被解析成 study_sessions 自己的 id。
 */
const spentMinutes = () =>
	sql<number>`(SELECT round(coalesce(sum(s.duration_sec), 0) / 60.0, 1) FROM study_sessions s WHERE s.task_id = tasks.id AND s.user_id = tasks.user_id)`;

/** 查詢或 returning 用的欄位：任務全部欄位加上 spentMinutes（= TaskItem） */
export const taskItemFields = () => ({ ...getTableColumns(tasks), spentMinutes: spentMinutes() });
