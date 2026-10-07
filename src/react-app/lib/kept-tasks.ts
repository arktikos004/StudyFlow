import type { TaskItem } from '../../shared/api-types';

// 單科總覽「未完成的任務」的「剛完成」列（s3/polish）。
// API 的清單只有未完成的任務，在這裡完成的那一筆會從清單消失；為了能馬上取消、焦點也不會掉，
// 把「伺服器回傳的那一筆」留在原位。留下來的資料一律以伺服器的回應為準，不靠點擊去猜：
// - 儲存失敗：沒有回應，不會留下任何東西。
// - 取消完成、在編輯視窗改回未完成：換成新的那一筆，等清單更新、任務回到清單後就丟掉，之後不會再冒出來。
// - 刪除、移到別的科目：直接丟掉。

/** 留在清單上的一筆：伺服器回傳的最新內容，以及它在清單上的位置 */
export type KeptTask = { readonly task: TaskItem; readonly index: number };

/**
 * 某一筆任務儲存成功後，更新留在清單上的那幾筆。
 * @param saved 伺服器回傳的任務
 * @param subjectId 這張清單的科目
 * @param shownIds 儲存當下清單上顯示的任務 id（依畫面順序）
 */
export function keepSaved(kept: readonly KeptTask[], saved: TaskItem, subjectId: string, shownIds: readonly string[]): readonly KeptTask[] {
	const prev = kept.find((k) => k.task.id === saved.id);
	// 比手上的還舊的回應（順序顛倒）不採用
	if (prev && prev.task.updatedAt > saved.updatedAt) return kept;
	const rest = prev ? kept.filter((k) => k !== prev) : kept;
	// 移到別的科目：不屬於這張清單了
	if (saved.subjectId !== subjectId) return rest;
	// 已經留著的：換成最新的內容，位置不變（取消完成後，清單更新前就先照新的狀態顯示）
	if (prev) return [...rest, { task: saved, index: prev.index }];
	// 剛完成，而且原本就顯示在這張清單上：留在原位
	const index = shownIds.indexOf(saved.id);
	return saved.status === 'done' && index >= 0 ? [...rest, { task: saved, index }] : kept;
}

/** 任務刪除後不再留著 */
export function dropKept(kept: readonly KeptTask[], id: string): readonly KeptTask[] {
	return kept.some((k) => k.task.id === id) ? kept.filter((k) => k.task.id !== id) : kept;
}

/**
 * 清單更新後，丟掉已經用不到的：清單裡有同一筆，而且和留著的一樣新或更新
 * （任務回到未完成、或在別的地方又改過）。沒有東西要丟時回傳原本的陣列。
 */
export function pruneKept(open: readonly TaskItem[], kept: readonly KeptTask[]): readonly KeptTask[] {
	if (!kept.length) return kept;
	const updatedAt = new Map(open.map((t) => [t.id, t.updatedAt]));
	const live = kept.filter((k) => {
		const at = updatedAt.get(k.task.id);
		return at === undefined || at < k.task.updatedAt;
	});
	return live.length === kept.length ? kept : live;
}

/**
 * 清單實際顯示的任務：API 的未完成清單，加上留著的那幾筆。
 * - 兩邊都有同一筆：顯示留著的（pruneKept 之後留著的一定比較新，例如剛存完、清單還沒更新）。
 * - 清單裡已經沒有的：插回原本的位置。
 */
export function mergeKept(open: readonly TaskItem[], kept: readonly KeptTask[]): TaskItem[] {
	if (!kept.length) return [...open];
	const byId = new Map(kept.map((k) => [k.task.id, k.task]));
	const openIds = new Set(open.map((t) => t.id));
	const shown = open.map((t) => {
		const newer = byId.get(t.id);
		return newer && newer.updatedAt > t.updatedAt ? newer : t;
	});
	const missing = kept.filter((k) => !openIds.has(k.task.id)).sort((a, b) => a.index - b.index);
	for (const k of missing) shown.splice(Math.min(k.index, shown.length), 0, k.task);
	return shown;
}
