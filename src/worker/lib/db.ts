import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { HTTPException } from 'hono/http-exception';
import * as schema from '../db/schema';

export function createDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof createDb>;

type OwnedTable = typeof schema.subjects | typeof schema.events | typeof schema.tasks | typeof schema.notes;

/**
 * 確認被引用的資料（科目、考試、任務…）屬於目前使用者，
 * 避免有人把別人的 ID 填進自己的資料裡。
 */
export async function assertOwned(db: DB, table: OwnedTable, id: string | null | undefined, userId: string, label: string) {
	if (!id) return;
	const row = await db
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.id, id), eq(table.userId, userId)))
		.get();
	if (!row) throw new HTTPException(400, { message: `找不到指定的${label}` });
}

export function notFound(label: string): never {
	throw new HTTPException(404, { message: `找不到此${label}` });
}
