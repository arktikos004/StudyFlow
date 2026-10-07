import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../src/shared/api-types';
import { dropKept, keepSaved, mergeKept, pruneKept, type KeptTask } from '../src/react-app/lib/kept-tasks';

// 單科總覽的「剛完成」列：留著的資料以伺服器的儲存結果為準。

const SUBJECT = 'sub-1';

function task(id: string, over: Partial<TaskItem> = {}): TaskItem {
	return {
		id,
		userId: 'u1',
		subjectId: SUBJECT,
		eventId: null,
		title: `任務 ${id}`,
		description: null,
		dueDate: null,
		priority: 'medium',
		status: 'todo',
		estimatedMinutes: null,
		checklist: [],
		completedAt: null,
		createdAt: 1,
		updatedAt: 100,
		spentMinutes: 0,
		...over,
	};
}

const ids = (list: readonly TaskItem[]) => list.map((t) => t.id);
const done = (id: string, updatedAt: number) => task(id, { status: 'done', updatedAt, completedAt: updatedAt });

/** 畫面上顯示的清單（和 TasksCard 的算法相同：先丟掉用不到的，再合併） */
function shown(open: readonly TaskItem[], kept: readonly KeptTask[]) {
	return mergeKept(open, pruneKept(open, kept));
}

describe('keepSaved', () => {
	const open = [task('a'), task('b'), task('c')];

	it('在清單上完成的任務：留在原位', () => {
		const kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		expect(kept).toEqual([{ task: done('b', 200), index: 1 }]);
	});

	it('不是完成的儲存（改標題、改期限）不用留', () => {
		const kept: readonly KeptTask[] = [];
		expect(keepSaved(kept, task('b', { title: '新標題', updatedAt: 200 }), SUBJECT, ids(open))).toBe(kept);
	});

	it('不在這張清單上的任務（新增時就設成完成）不會多出一列', () => {
		const kept: readonly KeptTask[] = [];
		expect(keepSaved(kept, done('new', 200), SUBJECT, ids(open))).toBe(kept);
	});

	it('取消完成：換成新的那一筆，位置不變', () => {
		const kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		const reopened = task('b', { updatedAt: 300 });
		expect(keepSaved(kept, reopened, SUBJECT, ['a', 'b', 'c'])).toEqual([{ task: reopened, index: 1 }]);
	});

	it('留著的任務在編輯視窗改了標題：顯示最新的內容', () => {
		const kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		const renamed = { ...done('b', 300), title: '改過的標題' };
		expect(keepSaved(kept, renamed, SUBJECT, ['a', 'b', 'c'])[0].task.title).toBe('改過的標題');
	});

	it('移到別的科目：不再留著；本來就沒留的不受影響', () => {
		const kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		expect(keepSaved(kept, { ...done('b', 300), subjectId: 'sub-2' }, SUBJECT, ['a', 'b', 'c'])).toEqual([]);
		expect(keepSaved([], { ...done('a', 300), subjectId: 'sub-2' }, SUBJECT, ids(open))).toEqual([]);
	});

	it('比手上還舊的回應（順序顛倒）不採用', () => {
		const kept = keepSaved([], done('b', 300), SUBJECT, ids(open));
		expect(keepSaved(kept, task('b', { updatedAt: 200 }), SUBJECT, ids(open))).toBe(kept);
	});
});

describe('dropKept', () => {
	it('刪除的任務不再留著；其他 id 不受影響', () => {
		const kept: readonly KeptTask[] = [
			{ task: done('a', 200), index: 0 },
			{ task: done('b', 200), index: 1 },
		];
		expect(dropKept(kept, 'a')).toEqual([{ task: done('b', 200), index: 1 }]);
		expect(dropKept(kept, 'event-1')).toBe(kept);
	});
});

describe('pruneKept', () => {
	it('清單還沒更新（清單裡的比較舊）：留著', () => {
		const kept: readonly KeptTask[] = [{ task: done('b', 200), index: 1 }];
		expect(pruneKept([task('a'), task('b'), task('c')], kept)).toBe(kept);
	});

	it('清單已經沒有這一筆：留著', () => {
		const kept: readonly KeptTask[] = [{ task: done('b', 200), index: 1 }];
		expect(pruneKept([task('a'), task('c')], kept)).toBe(kept);
	});

	it('任務回到清單，而且一樣新或更新：丟掉', () => {
		const kept: readonly KeptTask[] = [{ task: task('b', { updatedAt: 300 }), index: 1 }];
		expect(pruneKept([task('a'), task('b', { updatedAt: 300 }), task('c')], kept)).toEqual([]);
		// 在別的分頁又改過（更新）
		expect(pruneKept([task('a'), task('b', { updatedAt: 400 }), task('c')], [{ task: done('b', 200), index: 1 }])).toEqual([]);
	});

	it('沒有東西要丟時回傳原本的陣列（render 時不會多觸發一次更新）', () => {
		const empty: readonly KeptTask[] = [];
		expect(pruneKept([task('a')], empty)).toBe(empty);
	});
});

describe('mergeKept', () => {
	it('沒有留著的：就是 API 的清單', () => {
		const open = [task('a'), task('b')];
		expect(mergeKept(open, [])).toEqual(open);
	});

	it('剛存完、清單還沒更新：同一筆顯示比較新的（馬上顯示「剛完成」）', () => {
		const open = [task('a'), task('b'), task('c')];
		const list = mergeKept(open, [{ task: done('b', 200), index: 1 }]);
		expect(ids(list)).toEqual(['a', 'b', 'c']);
		expect(list[1].status).toBe('done');
	});

	it('清單更新後已經沒有的：插回原本的位置', () => {
		const list = mergeKept([task('a'), task('c')], [{ task: done('b', 200), index: 1 }]);
		expect(ids(list)).toEqual(['a', 'b', 'c']);
		expect(list[1].status).toBe('done');
	});

	it('留了好幾筆：不管完成的順序，位置都和原本一樣', () => {
		const kept: readonly KeptTask[] = [
			{ task: done('c', 300), index: 2 },
			{ task: done('b', 200), index: 1 },
		];
		expect(ids(mergeKept([task('a'), task('d')], kept))).toEqual(['a', 'b', 'c', 'd']);
	});

	it('位置超過清單長度時排在最後', () => {
		expect(ids(mergeKept([task('a')], [{ task: done('z', 200), index: 9 }]))).toEqual(['a', 'z']);
	});
});

describe('情境：「剛完成」的列不會在不該出現的時候又冒出來', () => {
	const open = [task('a'), task('b'), task('c')];

	it('完成 → 取消完成 → 之後在編輯視窗刪除：不會出現「剛完成」', () => {
		// 完成 b：伺服器回應 → 清單更新（b 不在未完成清單）
		let kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		expect(shown([task('a'), task('c')], kept).map((t) => [t.id, t.status])).toEqual([
			['a', 'todo'],
			['b', 'done'],
			['c', 'todo'],
		]);
		// 取消完成：回應先到，清單更新前就照未完成顯示
		const reopened = task('b', { updatedAt: 300 });
		kept = keepSaved(kept, reopened, SUBJECT, ['a', 'b', 'c']);
		expect(shown([task('a'), task('c')], kept).map((t) => t.status)).toEqual(['todo', 'todo', 'todo']);
		// 清單更新：b 回到清單，留著的那一筆丟掉
		const refreshed = [task('a'), reopened, task('c')];
		kept = pruneKept(refreshed, kept);
		expect(kept).toEqual([]);
		// 之後 b 被刪除（或移到別科、在別的裝置完成）：清單少了 b，也不會有「剛完成」的 b
		kept = dropKept(kept, 'b');
		expect(ids(shown([task('a'), task('c')], kept))).toEqual(['a', 'c']);
	});

	it('完成失敗（沒有回應）→ 之後任務被刪除：不會出現「剛完成」', () => {
		// 失敗的請求不會呼叫 keepSaved，什麼都沒留
		const kept: readonly KeptTask[] = [];
		expect(ids(shown([task('a'), task('c')], dropKept(kept, 'b')))).toEqual(['a', 'c']);
	});

	it('「剛完成」的任務在編輯視窗刪除：那一列跟著消失', () => {
		let kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		kept = dropKept(kept, 'b');
		expect(ids(shown([task('a'), task('c')], kept))).toEqual(['a', 'c']);
	});

	it('在編輯視窗把狀態改成完成：和勾選一樣留在原位', () => {
		const kept = keepSaved([], done('c', 200), SUBJECT, ids(open));
		expect(shown([task('a'), task('b')], kept).map((t) => [t.id, t.status])).toEqual([
			['a', 'todo'],
			['b', 'todo'],
			['c', 'done'],
		]);
	});

	it('完成後在別的分頁改回未完成（清單裡的比較新）：照清單顯示，不會留著「剛完成」', () => {
		const kept = keepSaved([], done('b', 200), SUBJECT, ids(open));
		const other = task('b', { updatedAt: 500 });
		const list = shown([task('a'), other, task('c')], kept);
		expect(list.map((t) => t.status)).toEqual(['todo', 'todo', 'todo']);
		expect(pruneKept([task('a'), other, task('c')], kept)).toEqual([]);
	});
});
