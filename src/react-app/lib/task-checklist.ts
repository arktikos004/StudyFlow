import type { ChecklistItem } from '../../shared/api-types';
import { CHECKLIST_ITEM_MAX, CHECKLIST_MAX_ITEMS, checklistItemSchema } from '../../shared/schemas';

// 子任務清單（TSK-1）的純函式：新增、勾選、刪除、調整順序與輸入檢查。測試在 test/task-checklist.spec.ts。

export { CHECKLIST_ITEM_MAX, CHECKLIST_MAX_ITEMS };

export function checklistProgress(items: readonly Pick<ChecklistItem, 'done'>[]): { done: number; total: number } {
	return { done: items.filter((i) => i.done).length, total: items.length };
}

/** 至少一項、而且全部勾完 */
export function isAllDone(items: readonly Pick<ChecklistItem, 'done'>[]): boolean {
	return items.length > 0 && items.every((i) => i.done);
}

/**
 * 新增前的檢查，訊息和後端（共用 zod schema）一致。
 * 回傳 null 代表可以新增；字數以去掉前後空白後計算。
 */
export function checklistInputError(items: readonly ChecklistItem[], raw: string): string | null {
	if (items.length >= CHECKLIST_MAX_ITEMS) return `子項目最多 ${CHECKLIST_MAX_ITEMS} 項，請先刪除用不到的項目`;
	const parsed = checklistItemSchema.shape.title.safeParse(raw);
	if (!parsed.success) {
		const length = raw.trim().length;
		return length > CHECKLIST_ITEM_MAX ? `子項目最多 ${CHECKLIST_ITEM_MAX} 個字，目前 ${length} 個字` : parsed.error.issues[0].message;
	}
	return null;
}

export function addChecklistItem(items: readonly ChecklistItem[], title: string, id: string): ChecklistItem[] {
	return [...items, { id, title: title.trim(), done: false }];
}

export function toggleChecklistItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
	return items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
}

export function removeChecklistItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
	return items.filter((i) => i.id !== id);
}

/** 上移（-1）或下移（1）一格；已經在頭尾時回傳原順序的副本 */
export function moveChecklistItem(items: readonly ChecklistItem[], id: string, delta: -1 | 1): ChecklistItem[] {
	const from = items.findIndex((i) => i.id === id);
	const to = from + delta;
	if (from < 0 || to < 0 || to >= items.length) return [...items];
	const next = [...items];
	[next[from], next[to]] = [next[to], next[from]];
	return next;
}

/** 這次勾選讓清單從「還有沒勾的」變成「全部勾完」（用來詢問要不要一併完成任務） */
export function justCompleted(prev: readonly Pick<ChecklistItem, 'done'>[], next: readonly Pick<ChecklistItem, 'done'>[]): boolean {
	return !isAllDone(prev) && isAllDone(next);
}

/** 子項目的 ID：前端產生，最多 40 字（schema 限制） */
export function newChecklistId(): string {
	return crypto.randomUUID();
}
