import { getTableColumns, sql } from 'drizzle-orm';
import { events } from '../db/schema';

/**
 * 查詢考試／截止日用的欄位：全部欄位加上相關任務的完成進度（= EventItem）。
 * 子查詢要明確寫出表名，否則 id 會被解析成 tasks.id。
 */
export const eventItemFields = () => ({
	...getTableColumns(events),
	taskTotal: sql<number>`(SELECT count(*) FROM tasks t WHERE t.event_id = events.id)`,
	taskDone: sql<number>`(SELECT count(*) FROM tasks t WHERE t.event_id = events.id AND t.status = 'done')`,
});
