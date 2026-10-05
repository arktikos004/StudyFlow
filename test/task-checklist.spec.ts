import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '../src/shared/api-types';
import { checklistItemSchema } from '../src/shared/schemas';
import {
	addChecklistItem,
	checklistInputError,
	checklistProgress,
	isAllDone,
	justCompleted,
	moveChecklistItem,
	newChecklistId,
	removeChecklistItem,
	toggleChecklistItem,
} from '../src/react-app/lib/task-checklist';

const item = (id: string, done = false): ChecklistItem => ({ id, title: `項目 ${id}`, done });
const ids = (items: ChecklistItem[]) => items.map((i) => i.id);

describe('子項目清單（TSK-1）', () => {
	it('進度「2／5」與全部勾完的判斷（空清單不算勾完）', () => {
		expect(checklistProgress([item('a', true), item('b'), item('c', true)])).toEqual({ done: 2, total: 3 });
		expect(checklistProgress([])).toEqual({ done: 0, total: 0 });
		expect(isAllDone([])).toBe(false);
		expect(isAllDone([item('a', true)])).toBe(true);
		expect(isAllDone([item('a', true), item('b')])).toBe(false);
	});

	it('新增（去掉前後空白、未勾選、加在最後）、勾選、刪除，都不改變原陣列', () => {
		const start = [item('a')];
		const added = addChecklistItem(start, '  讀第 3 章  ', 'b');
		expect(added).toEqual([item('a'), { id: 'b', title: '讀第 3 章', done: false }]);
		expect(start).toEqual([item('a')]);

		const toggled = toggleChecklistItem(added, 'a');
		expect(toggled[0].done).toBe(true);
		expect(added[0].done).toBe(false);
		expect(toggleChecklistItem(toggled, 'a')[0].done).toBe(false);

		expect(ids(removeChecklistItem(toggled, 'a'))).toEqual(['b']);
		expect(ids(removeChecklistItem(toggled, 'zzz'))).toEqual(['a', 'b']);
	});

	it('上移／下移一格；在頭尾或找不到時維持原順序（回傳副本）', () => {
		const list = [item('a'), item('b'), item('c')];
		expect(ids(moveChecklistItem(list, 'b', -1))).toEqual(['b', 'a', 'c']);
		expect(ids(moveChecklistItem(list, 'b', 1))).toEqual(['a', 'c', 'b']);
		expect(ids(moveChecklistItem(list, 'a', -1))).toEqual(['a', 'b', 'c']);
		expect(ids(moveChecklistItem(list, 'c', 1))).toEqual(['a', 'b', 'c']);
		expect(ids(moveChecklistItem(list, 'x', 1))).toEqual(['a', 'b', 'c']);
		expect(moveChecklistItem(list, 'a', -1)).not.toBe(list);
		expect(ids(list)).toEqual(['a', 'b', 'c']);
	});

	it('輸入檢查：空白、超過 100 字、已滿 30 項都擋下，訊息是 zh-TW', () => {
		expect(checklistInputError([], '讀第 3 章')).toBeNull();
		expect(checklistInputError([], '   ')).toBe('請輸入子項目內容');
		expect(checklistInputError([], '')).toBe('請輸入子項目內容');
		expect(checklistInputError([], '字'.repeat(100))).toBeNull();
		// 前後空白不算字數（和後端 trim 後檢查一致）
		expect(checklistInputError([], ` ${'字'.repeat(100)} `)).toBeNull();
		expect(checklistInputError([], '字'.repeat(101))).toBe('子項目最多 100 個字，目前 101 個字');
		const full = Array.from({ length: 30 }, (_, i) => item(String(i)));
		expect(checklistInputError(full, '再一項')).toBe('子項目最多 30 項，請先刪除用不到的項目');
		expect(checklistInputError(full.slice(0, 29), '再一項')).toBeNull();
	});

	it('前端通過檢查的內容，後端的 schema 也會接受', () => {
		const title = ` ${'字'.repeat(100)} `;
		expect(checklistInputError([], title)).toBeNull();
		const [added] = addChecklistItem([], title, newChecklistId());
		expect(checklistItemSchema.safeParse(added).success).toBe(true);
		expect(added.id.length).toBeLessThanOrEqual(40);
	});

	it('justCompleted：只有這次勾選讓清單「全部勾完」時才成立', () => {
		expect(justCompleted([item('a', true), item('b')], [item('a', true), item('b', true)])).toBe(true);
		// 本來就全部勾完（例如調整順序）不再詢問
		expect(justCompleted([item('a', true)], [item('a', true)])).toBe(false);
		// 取消勾選、還有沒勾的、空清單都不算
		expect(justCompleted([item('a', true)], [item('a')])).toBe(false);
		expect(justCompleted([item('a'), item('b')], [item('a', true), item('b')])).toBe(false);
		expect(justCompleted([], [])).toBe(false);
	});
});
