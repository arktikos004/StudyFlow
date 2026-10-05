import type { Task } from '../../shared/api-types';
import { addDays } from '../../shared/dates';

// 任務頁（s2/tasks）的搜尋、排序、分組：純函式，測試在 test/task-sort.spec.ts。

export type TaskStatus = Task['status'];
export const TASK_STATUS_ORDER: readonly TaskStatus[] = ['todo', 'doing', 'done'];

// ---- 搜尋 ----

/**
 * 不分大小寫比對用：逐個 code point 轉小寫。
 * 不用整串 toLowerCase()：那樣少數字元（例如 İ → i̇、字尾的 Σ）的結果會和逐字轉換不同，
 * 說明片段就沒辦法把比對到的位置對回原字串。搜尋、比對、片段都用這個函式，結果才一致。
 */
export function foldCase(s: string): string {
	return Array.from(s, (c) => c.toLowerCase()).join('');
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** 字串切成使用者看到的「字」（grapheme：emoji、組合字不會被切開）；不支援 Intl.Segmenter 時退回 code point */
function graphemes(s: string): string[] {
	return segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
}

/** 搜尋字串拆成關鍵字（以空白分隔、不分大小寫）；空字串回傳空陣列 */
export function searchTerms(q: string): string[] {
	return foldCase(q)
		.split(/\s+/)
		.filter((t) => t.length > 0);
}

/** 每個關鍵字都要出現在標題或說明裡（AND）；沒有關鍵字時全部符合 */
export function matchesTerms(task: Pick<Task, 'title' | 'description'>, terms: readonly string[]): boolean {
	if (!terms.length) return true;
	const title = foldCase(task.title);
	const description = foldCase(task.description ?? '');
	return terms.every((t) => title.includes(t) || description.includes(t));
}

export function filterTasks<T extends Pick<Task, 'title' | 'description'>>(tasks: readonly T[], q: string): T[] {
	const terms = searchTerms(q);
	return terms.length ? tasks.filter((t) => matchesTerms(t, terms)) : [...tasks];
}

/**
 * 說明裡符合關鍵字的片段（標題已經包含全部關鍵字時回傳 null，不必再顯示說明）。
 * 從第一個符合的位置往前留 before 個字，總長最多 length 個字；有截斷的一側加「…」。
 * 字數以使用者看到的字（grapheme）計算：emoji、組合字不會被切成半個（不會出現孤立的 surrogate）。
 */
export function descriptionSnippet(
	task: Pick<Task, 'title' | 'description'>,
	terms: readonly string[],
	length = 60,
	before = 12,
): string | null {
	const description = task.description?.replace(/\s+/g, ' ').trim();
	if (!description || !terms.length) return null;
	const title = foldCase(task.title);
	if (terms.every((t) => title.includes(t))) return null;
	// 逐字轉小寫並記下每個位置屬於第幾個字，比對到的位置才對得回原字串
	const chars = graphemes(description);
	let folded = '';
	const charAt: number[] = [];
	chars.forEach((ch, i) => {
		const f = foldCase(ch);
		folded += f;
		for (let k = 0; k < f.length; k++) charAt.push(i);
	});
	const hits = terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0);
	if (!hits.length) return null;
	const first = charAt[Math.min(...hits)];
	const start = Math.max(0, first - before);
	const end = Math.min(chars.length, start + length);
	return `${start > 0 ? '…' : ''}${chars.slice(start, end).join('')}${end < chars.length ? '…' : ''}`;
}

// ---- 排序 ----

export const TASK_SORTS = ['due', 'priority', 'created', 'estimate'] as const;
export type TaskSort = (typeof TASK_SORTS)[number];
export const DEFAULT_SORT: TaskSort = 'due';
export const SORT_LABEL: Record<TaskSort, string> = {
	due: '依期限',
	priority: '依優先度',
	created: '最新建立',
	estimate: '預估時間短到長',
};

/** 網址參數 → 排序方式；不認得的值一律當成預設（期限） */
export function parseSort(value: string | null | undefined): TaskSort {
	return (TASK_SORTS as readonly string[]).includes(value ?? '') ? (value as TaskSort) : DEFAULT_SORT;
}

type Sortable = Pick<Task, 'dueDate' | 'priority' | 'createdAt' | 'estimatedMinutes'>;

const PRIORITY_RANK: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };

/** 和 API 的預設順序相同：有期限的在前、期限近的優先，再依優先度、最新建立 */
function byDue(a: Sortable, b: Sortable): number {
	if (a.dueDate !== b.dueDate) {
		if (!a.dueDate) return 1;
		if (!b.dueDate) return -1;
		return a.dueDate < b.dueDate ? -1 : 1;
	}
	return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt;
}

const COMPARE: Record<TaskSort, (a: Sortable, b: Sortable) => number> = {
	due: byDue,
	priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b),
	created: (a, b) => b.createdAt - a.createdAt,
	// 預估時間短的在前（先挑得完的做），沒有預估的排最後
	estimate: (a, b) => {
		const x = a.estimatedMinutes ?? Infinity;
		const y = b.estimatedMinutes ?? Infinity;
		return x === y ? byDue(a, b) : x - y;
	},
};

/** 排序（不改變原陣列；比較結果相同時維持原本順序） */
export function sortTasks<T extends Sortable>(tasks: readonly T[], sort: TaskSort): T[] {
	const compare = COMPARE[sort];
	return tasks
		.map((t, i) => ({ t, i }))
		.sort((a, b) => compare(a.t, b.t) || a.i - b.i)
		.map(({ t }) => t);
}

/** 已完成的任務：最近完成的在前 */
function sortDone<T extends Sortable & Pick<Task, 'completedAt'>>(tasks: readonly T[], sort: TaskSort): T[] {
	if (sort !== 'due') return sortTasks(tasks, sort);
	return tasks
		.map((t, i) => ({ t, i }))
		.sort((a, b) => (b.t.completedAt ?? 0) - (a.t.completedAt ?? 0) || a.i - b.i)
		.map(({ t }) => t);
}

// ---- 分組（清單檢視） ----

export type TaskGroupKey = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'open' | 'done';
export type TaskGroup<T> = { key: TaskGroupKey; title: string; items: T[] };

type Groupable = Sortable & Pick<Task, 'status' | 'completedAt'>;

/**
 * 清單檢視的分組：
 * - 依期限排序：未完成的分成已逾期／今天／未來 7 天／之後／沒有期限。
 * - 其他排序：未完成的不分組，照排序方式排成一組。
 * 已完成的一律放在最後一組（依期限排序時，最近完成的在前）。只回傳有任務的組。
 */
export function groupTasks<T extends Groupable>(tasks: readonly T[], today: string, sort: TaskSort): TaskGroup<T>[] {
	const open = tasks.filter((t) => t.status !== 'done');
	const done = tasks.filter((t) => t.status === 'done');
	const groups: TaskGroup<T>[] = [];
	if (sort === 'due') {
		const weekEnd = addDays(today, 7);
		const due: TaskGroup<T>[] = [
			{ key: 'overdue', title: '已逾期', items: [] },
			{ key: 'today', title: '今天', items: [] },
			{ key: 'week', title: '未來 7 天', items: [] },
			{ key: 'later', title: '之後', items: [] },
			{ key: 'none', title: '沒有期限', items: [] },
		];
		for (const t of sortTasks(open, 'due')) {
			const g = !t.dueDate ? 4 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : t.dueDate <= weekEnd ? 2 : 3;
			due[g].items.push(t);
		}
		groups.push(...due);
	} else {
		groups.push({ key: 'open', title: '未完成', items: sortTasks(open, sort) });
	}
	groups.push({ key: 'done', title: '已完成', items: sortDone(done, sort) });
	return groups.filter((g) => g.items.length > 0);
}

// ---- 看板 ----

/** 看板三欄：各欄依排序方式排列（已完成欄依期限排序時，最近完成的在前） */
export function boardColumns<T extends Groupable>(tasks: readonly T[], sort: TaskSort): Record<TaskStatus, T[]> {
	return {
		todo: sortTasks(
			tasks.filter((t) => t.status === 'todo'),
			sort,
		),
		doing: sortTasks(
			tasks.filter((t) => t.status === 'doing'),
			sort,
		),
		done: sortDone(
			tasks.filter((t) => t.status === 'done'),
			sort,
		),
	};
}

/** 看板上相鄰的欄（鍵盤用的「移到上一欄／下一欄」按鈕） */
export function neighborStatuses(status: TaskStatus): { prev: TaskStatus | null; next: TaskStatus | null } {
	const i = TASK_STATUS_ORDER.indexOf(status);
	return { prev: TASK_STATUS_ORDER[i - 1] ?? null, next: TASK_STATUS_ORDER[i + 1] ?? null };
}

/** 改變狀態時的完成時間，和後端 PATCH 的規則相同：改成已完成時記下現在，改回未完成時清除 */
export function completedAtFor(task: Pick<Task, 'status' | 'completedAt'>, status: TaskStatus, now: number): number | null {
	if (status === task.status) return task.completedAt;
	return status === 'done' ? now : null;
}

// ---- 頁首摘要 ----

/** 未完成、已逾期、今天到期的數量（已完成的不算逾期） */
export function taskSummary(tasks: readonly Pick<Task, 'status' | 'dueDate'>[], today: string) {
	let open = 0;
	let overdue = 0;
	let dueToday = 0;
	for (const t of tasks) {
		if (t.status === 'done') continue;
		open++;
		if (t.dueDate && t.dueDate < today) overdue++;
		else if (t.dueDate === today) dueToday++;
	}
	return { open, overdue, dueToday };
}
