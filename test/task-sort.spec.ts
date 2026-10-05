import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../src/shared/api-types';
import {
	boardColumns,
	completedAtFor,
	descriptionSnippet,
	filterTasks,
	groupTasks,
	matchesTerms,
	neighborStatuses,
	parseSort,
	searchTerms,
	sortTasks,
	taskSummary,
} from '../src/react-app/lib/task-sort';

const TODAY = '2026-10-06';

let seq = 0;
function task(over: Partial<TaskItem> = {}): TaskItem {
	seq += 1;
	return {
		id: `t${seq}`,
		userId: 'u1',
		subjectId: null,
		eventId: null,
		title: `任務 ${seq}`,
		description: null,
		dueDate: null,
		priority: 'medium',
		status: 'todo',
		estimatedMinutes: null,
		checklist: [],
		completedAt: null,
		createdAt: 1_000 + seq,
		updatedAt: 1_000 + seq,
		spentMinutes: 0,
		...over,
	};
}
const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe('搜尋（TSK-3）', () => {
	it('關鍵字以空白分隔、不分大小寫，每個關鍵字都要出現在標題或說明', () => {
		expect(searchTerms('  期末  HW2 ')).toEqual(['期末', 'hw2']);
		expect(searchTerms('   ')).toEqual([]);
		const t = { title: '寫完 HW2', description: '期末報告的第二部分' };
		expect(matchesTerms(t, ['hw2'])).toBe(true);
		expect(matchesTerms(t, ['期末', 'hw2'])).toBe(true); // 一個在說明、一個在標題
		expect(matchesTerms(t, ['期末', '數學'])).toBe(false);
		expect(matchesTerms({ title: 'x', description: null }, ['x'])).toBe(true);
		expect(matchesTerms({ title: 'x', description: null }, [])).toBe(true);
	});

	it('filterTasks：空白搜尋回傳全部（新陣列），否則只留符合的', () => {
		const a = task({ title: '複習第 3 章' });
		const b = task({ title: '寫作業', description: '第 3 章的習題' });
		const c = task({ title: '背單字' });
		const all = [a, b, c];
		expect(filterTasks(all, '')).toEqual(all);
		expect(filterTasks(all, '')).not.toBe(all);
		expect(ids(filterTasks(all, '第 3 章'))).toEqual([a.id, b.id]);
		expect(ids(filterTasks(all, '習題'))).toEqual([b.id]);
		expect(filterTasks(all, '物理')).toEqual([]);
	});

	it('只有說明符合時回傳說明片段（前後截斷加「…」），標題已包含全部關鍵字時不顯示', () => {
		const long = `${'前'.repeat(30)}關鍵${'後'.repeat(80)}`;
		const s = descriptionSnippet({ title: '標題', description: long }, ['關鍵'], 40, 10);
		expect(s).toBe(`…${'前'.repeat(10)}關鍵${'後'.repeat(28)}…`);
		expect(descriptionSnippet({ title: '標題', description: '短短的關鍵說明' }, ['關鍵'])).toBe('短短的關鍵說明');
		expect(descriptionSnippet({ title: '關鍵標題', description: '也有關鍵' }, ['關鍵'])).toBeNull();
		expect(descriptionSnippet({ title: '標題', description: null }, ['關鍵'])).toBeNull();
		expect(descriptionSnippet({ title: '標題', description: '說明' }, [])).toBeNull();
		// 換行與連續空白合成一個空白
		expect(descriptionSnippet({ title: 'x', description: '第一行\n\n第二行 關鍵' }, ['關鍵'])).toBe('第一行 第二行 關鍵');
	});
});

describe('排序（TSK-3）', () => {
	it('parseSort：不認得的值一律當成預設（期限）', () => {
		expect(parseSort('priority')).toBe('priority');
		expect(parseSort('created')).toBe('created');
		expect(parseSort('estimate')).toBe('estimate');
		expect(parseSort(null)).toBe('due');
		expect(parseSort('')).toBe('due');
		expect(parseSort('DROP TABLE')).toBe('due');
	});

	it('期限：有期限的在前、近的優先；同一天再依優先度、最新建立', () => {
		const none = task();
		const later = task({ dueDate: '2026-10-20' });
		const soonLow = task({ dueDate: '2026-10-07', priority: 'low' });
		const soonHighOld = task({ dueDate: '2026-10-07', priority: 'high', createdAt: 1 });
		const soonHighNew = task({ dueDate: '2026-10-07', priority: 'high', createdAt: 2 });
		expect(ids(sortTasks([none, later, soonLow, soonHighOld, soonHighNew], 'due'))).toEqual([
			soonHighNew.id,
			soonHighOld.id,
			soonLow.id,
			later.id,
			none.id,
		]);
	});

	it('優先度：高 → 中 → 低，同優先度再依期限', () => {
		const low = task({ priority: 'low', dueDate: '2026-10-07' });
		const midLate = task({ priority: 'medium', dueDate: '2026-10-30' });
		const midSoon = task({ priority: 'medium', dueDate: '2026-10-08' });
		const high = task({ priority: 'high' });
		expect(ids(sortTasks([low, midLate, midSoon, high], 'priority'))).toEqual([high.id, midSoon.id, midLate.id, low.id]);
	});

	it('最新建立：建立時間新的在前', () => {
		const a = task({ createdAt: 10 });
		const b = task({ createdAt: 30 });
		const c = task({ createdAt: 20 });
		expect(ids(sortTasks([a, b, c], 'created'))).toEqual([b.id, c.id, a.id]);
	});

	it('預估時間：短的在前，沒有預估的排最後；相同時依期限', () => {
		const none = task();
		const long = task({ estimatedMinutes: 120 });
		const shortLate = task({ estimatedMinutes: 25, dueDate: '2026-10-20' });
		const shortSoon = task({ estimatedMinutes: 25, dueDate: '2026-10-08' });
		expect(ids(sortTasks([none, long, shortLate, shortSoon], 'estimate'))).toEqual([shortSoon.id, shortLate.id, long.id, none.id]);
	});

	it('不改變原陣列；比較結果完全相同時維持原本順序', () => {
		const a = task({ createdAt: 5 });
		const b = task({ createdAt: 5 });
		const input = [a, b];
		const out = sortTasks(input, 'created');
		expect(ids(out)).toEqual([a.id, b.id]);
		expect(out).not.toBe(input);
		expect(ids(input)).toEqual([a.id, b.id]);
	});
});

describe('分組（清單檢視）', () => {
	it('依期限排序：已逾期／今天／未來 7 天／之後／沒有期限，已完成的放最後（最近完成的在前），空的組不回傳', () => {
		const overdue = task({ dueDate: '2026-10-01' });
		const today = task({ dueDate: TODAY });
		const in7 = task({ dueDate: '2026-10-13' });
		const later = task({ dueDate: '2026-10-14' });
		const none = task();
		// 已完成、期限已過的不算逾期
		const doneOld = task({ status: 'done', dueDate: '2026-09-01', completedAt: 100 });
		const doneNew = task({ status: 'done', completedAt: 200 });
		const groups = groupTasks([none, later, in7, today, overdue, doneOld, doneNew], TODAY, 'due');
		expect(groups.map((g) => [g.key, ids(g.items)])).toEqual([
			['overdue', [overdue.id]],
			['today', [today.id]],
			['week', [in7.id]],
			['later', [later.id]],
			['none', [none.id]],
			['done', [doneNew.id, doneOld.id]],
		]);
		expect(groupTasks([none], TODAY, 'due').map((g) => g.key)).toEqual(['none']);
		expect(groupTasks([], TODAY, 'due')).toEqual([]);
	});

	it('其他排序：未完成的排成一組，已完成的另一組，兩組都照排序方式', () => {
		const low = task({ priority: 'low' });
		const high = task({ priority: 'high' });
		const doneLow = task({ status: 'done', priority: 'low', completedAt: 999 });
		const doneHigh = task({ status: 'done', priority: 'high', completedAt: 1 });
		const groups = groupTasks([low, doneLow, high, doneHigh], TODAY, 'priority');
		expect(groups.map((g) => [g.key, g.title, ids(g.items)])).toEqual([
			['open', '未完成', [high.id, low.id]],
			['done', '已完成', [doneHigh.id, doneLow.id]],
		]);
	});
});

describe('看板', () => {
	it('分成三欄，各欄依排序方式；已完成欄依期限排序時最近完成的在前', () => {
		const todoLate = task({ dueDate: '2026-10-30' });
		const todoSoon = task({ dueDate: '2026-10-07' });
		const doing = task({ status: 'doing' });
		const doneA = task({ status: 'done', completedAt: 1 });
		const doneB = task({ status: 'done', completedAt: 2 });
		const cols = boardColumns([todoLate, doneA, todoSoon, doing, doneB], 'due');
		expect(ids(cols.todo)).toEqual([todoSoon.id, todoLate.id]);
		expect(ids(cols.doing)).toEqual([doing.id]);
		expect(ids(cols.done)).toEqual([doneB.id, doneA.id]);
	});

	it('相鄰的欄：待辦 → 進行中 → 已完成', () => {
		expect(neighborStatuses('todo')).toEqual({ prev: null, next: 'doing' });
		expect(neighborStatuses('doing')).toEqual({ prev: 'todo', next: 'done' });
		expect(neighborStatuses('done')).toEqual({ prev: 'doing', next: null });
	});

	it('拖到已完成時記下完成時間，拖回未完成時清除，狀態沒變時保留原值（和後端相同）', () => {
		expect(completedAtFor({ status: 'todo', completedAt: null }, 'done', 500)).toBe(500);
		expect(completedAtFor({ status: 'doing', completedAt: null }, 'done', 500)).toBe(500);
		expect(completedAtFor({ status: 'done', completedAt: 100 }, 'doing', 500)).toBeNull();
		expect(completedAtFor({ status: 'done', completedAt: 100 }, 'done', 500)).toBe(100);
		expect(completedAtFor({ status: 'todo', completedAt: null }, 'doing', 500)).toBeNull();
	});
});

describe('頁首摘要', () => {
	it('只算未完成的任務；逾期與今天到期分開計算', () => {
		const list = [
			task({ dueDate: '2026-10-01' }),
			task({ dueDate: '2026-10-02', status: 'doing' }),
			task({ dueDate: TODAY }),
			task({ dueDate: '2026-10-09' }),
			task(),
			task({ status: 'done', dueDate: '2026-10-01' }),
			task({ status: 'done', dueDate: TODAY }),
		];
		expect(taskSummary(list, TODAY)).toEqual({ open: 5, overdue: 2, dueToday: 1 });
		expect(taskSummary([], TODAY)).toEqual({ open: 0, overdue: 0, dueToday: 0 });
	});
});
