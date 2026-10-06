import type { ChecklistItem, Task } from '../../shared/api-types';
import { completedAtFor, type TaskStatus } from './task-sort';

// 任務的樂觀更新（看板拖曳、清單上勾子項目）用的純函式：套用與還原。測試在 test/task-patch.spec.ts。

export type TaskFieldsPatch = { status?: TaskStatus; checklist?: ChecklistItem[] };
type Patchable = Pick<Task, 'id' | 'status' | 'completedAt' | 'checklist'>;

/** 套用到清單裡的那一筆：改狀態時依後端規則算完成時間；其他任務原封不動（同一個物件） */
export function applyTaskPatch<T extends Patchable>(list: readonly T[], id: string, patch: TaskFieldsPatch, now: number): T[] {
	return list.map((t) =>
		t.id === id
			? {
					...t,
					...(patch.status && { status: patch.status, completedAt: completedAtFor(t, patch.status, now) }),
					...(patch.checklist && { checklist: patch.checklist }),
				}
			: t,
	);
}

/**
 * 失敗時只還原這一次改到的那一筆、改到的欄位（狀態與完成時間，或子項目），
 * 同時在送的其他更新（例如另一張剛拖過去的卡片）不受影響。original 是送出前的那一筆。
 */
export function revertTaskPatch<T extends Patchable>(list: readonly T[], original: Patchable, patch: TaskFieldsPatch): T[] {
	return list.map((t) =>
		t.id === original.id
			? {
					...t,
					...(patch.status && { status: original.status, completedAt: original.completedAt }),
					...(patch.checklist && { checklist: original.checklist }),
				}
			: t,
	);
}
