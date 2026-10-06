import { describe, expect, it } from 'vitest';
import type { ChecklistItem, TaskItem } from '../src/shared/api-types';
import { applyTaskPatch, revertTaskPatch } from '../src/react-app/lib/task-patch';

const item = (id: string, done = false): ChecklistItem => ({ id, title: id, done });
function task(id: string, over: Partial<TaskItem> = {}): TaskItem {
	return {
		id,
		userId: 'u1',
		subjectId: null,
		eventId: null,
		title: id,
		description: null,
		dueDate: null,
		priority: 'medium',
		status: 'todo',
		estimatedMinutes: null,
		checklist: [],
		completedAt: null,
		createdAt: 1,
		updatedAt: 1,
		spentMinutes: 0,
		...over,
	};
}

describe('樂觀更新的套用與還原', () => {
	it('套用：改狀態時依後端規則算完成時間；只改那一筆，其他任務是同一個物件', () => {
		const a = task('a');
		const b = task('b', { status: 'done', completedAt: 100 });
		const next = applyTaskPatch([a, b], 'a', { status: 'done' }, 500);
		expect(next[0]).toMatchObject({ status: 'done', completedAt: 500 });
		expect(next[1]).toBe(b);
		expect(applyTaskPatch([b], 'b', { status: 'doing' }, 500)[0]).toMatchObject({ status: 'doing', completedAt: null });
		const checklist = [item('x', true)];
		expect(applyTaskPatch([a], 'a', { checklist }, 500)[0]).toMatchObject({ status: 'todo', checklist });
	});

	it('連續拖兩張、第一張失敗：只退回第一張，第二張的樂觀狀態保留（review A1）', () => {
		const a = task('a');
		const b = task('b');
		// 先拖 a 到進行中、再拖 b 到已完成（兩個都還在送）
		let cache = applyTaskPatch([a, b], 'a', { status: 'doing' }, 10);
		cache = applyTaskPatch(cache, 'b', { status: 'done' }, 20);
		// a 失敗：只還原 a
		cache = revertTaskPatch(cache, a, { status: 'doing' });
		expect(cache.map((t) => [t.id, t.status, t.completedAt])).toEqual([
			['a', 'todo', null],
			['b', 'done', 20],
		]);
	});

	it('還原只動這次改到的欄位：同一筆的子項目更新還在送時，狀態失敗不會蓋掉子項目', () => {
		const a = task('a', { checklist: [item('x'), item('y')] });
		let cache = applyTaskPatch([a], 'a', { status: 'done' }, 10);
		cache = applyTaskPatch(cache, 'a', { checklist: [item('x', true), item('y')] }, 11);
		cache = revertTaskPatch(cache, a, { status: 'done' });
		expect(cache[0]).toMatchObject({ status: 'todo', completedAt: null, checklist: [item('x', true), item('y')] });
		// 反過來：子項目失敗只還原子項目
		const b = task('b', { checklist: [item('x')] });
		let other = applyTaskPatch([b], 'b', { checklist: [item('x', true)] }, 10);
		other = applyTaskPatch(other, 'b', { status: 'doing' }, 11);
		other = revertTaskPatch(other, b, { checklist: [item('x', true)] });
		expect(other[0]).toMatchObject({ status: 'doing', checklist: [item('x')] });
	});
});
