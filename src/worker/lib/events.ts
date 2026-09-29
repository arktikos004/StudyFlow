import { getTableColumns, sql } from 'drizzle-orm';
import { events } from '../db/schema';

/**
 * 查詢考試／截止日用的欄位：全部欄位加上相關任務的完成進度（= EventItem）。
 * - 子查詢要明確寫出表名，否則 id 會被解析成 tasks.id。
 * - 只計入同一位使用者的任務，並走 tasks_event_idx，不會掃過全站的 tasks。
 */
export const eventItemFields = () => ({
	...getTableColumns(events),
	taskTotal: sql<number>`(SELECT count(*) FROM tasks t WHERE t.event_id = events.id AND t.user_id = events.user_id)`,
	taskDone: sql<number>`(SELECT count(*) FROM tasks t WHERE t.event_id = events.id AND t.user_id = events.user_id AND t.status = 'done')`,
});
