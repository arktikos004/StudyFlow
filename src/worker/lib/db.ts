import { and, eq, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { HTTPException } from 'hono/http-exception';
import * as schema from '../db/schema';

export function createDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof createDb>;

/** 屬於某位使用者的資料表（都有 id 與 user_id） */
type OwnedTable =
	| typeof schema.subjects
	| typeof schema.events
	| typeof schema.tasks
	| typeof schema.studySessions
	| typeof schema.notes
	| typeof schema.attachments;

/** 錯誤訊息裡的名稱：「找不到此任務」「找不到指定的科目」 */
const LABELS = new Map<OwnedTable, string>([
	[schema.subjects, '科目'],
	[schema.events, '考試或截止日'],
	[schema.tasks, '任務'],
	[schema.studySessions, '學習紀錄'],
	[schema.notes, '筆記'],
	[schema.attachments, '照片'],
]);

/**
 * 「這一筆，而且是本人的」。讀、改、刪單筆資料都用這個條件：
 * 別人的資料和不存在的資料一樣查不到（回 404），不會洩漏它存在。
 */
export const ownedBy = (table: OwnedTable, id: string, userId: string): SQL => and(eq(table.id, id), eq(table.userId, userId))!;

/**
 * 確認被引用的資料（科目、考試、任務…）屬於目前使用者，
 * 避免有人把別人的 ID 填進自己的資料裡。沒有引用（null、undefined）時不檢查。
 */
export async function assertOwned(db: DB, table: OwnedTable, id: string | null | undefined, userId: string) {
	if (!id) return;
	const row = await db
		.select({ id: table.id })
		.from(table)
		.where(ownedBy(table, id, userId))
		.get();
	if (!row) throw new HTTPException(400, { message: `找不到指定的${LABELS.get(table)}` });
}

/** 找不到（或不是本人的）資料：404 */
export function notFound(table: OwnedTable): never {
	throw new HTTPException(404, { message: `找不到此${LABELS.get(table)}` });
}

/** drizzle 的 update().set() 遇到沒有任何欄位（全是 undefined）會丟錯，更新前先檢查 */
export function hasValues(values: Record<string, unknown>) {
	return Object.values(values).some((v) => v !== undefined);
}
