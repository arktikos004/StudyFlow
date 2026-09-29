import { sql, type SQLWrapper } from 'drizzle-orm';

/**
 * 子字串比對：英文不分大小寫（和 LIKE 相同），NULL 欄位視為不符合。
 * 不用 LIKE：D1 的 LIKE／GLOB pattern 最多 50 bytes，中文一個字 3 bytes，
 * 超過 16 個中文字就會出錯（LIKE or GLOB pattern too complex）。
 * instr() 沒有這個限制，而且 % _ \ 本來就是一般字元，不必跳脫。
 */
export function containsText(column: SQLWrapper, needle: string) {
	return sql<boolean>`instr(lower(${column}), lower(${needle})) > 0`;
}
