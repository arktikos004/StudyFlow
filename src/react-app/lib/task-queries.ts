import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { ChecklistItem, TaskItem } from '../../shared/api-types';
import { api } from './api';
import { TASK_KEYS } from './queries';
import { applyTaskPatch, revertTaskPatch } from './task-patch';
import { DEFAULT_SORT, parseSort, type TaskSort, type TaskStatus } from './task-sort';

// 任務頁（s2/tasks）的資料 hook：樂觀更新、網址上的搜尋與排序、檢視方式。
// lib/queries.ts 屬於後端；這裡用同樣的 API 與 query key（TASK_KEYS 直接從 queries.ts 引入），快取與 invalidate 和 queries.ts 共用。

const PATCH_KEY = ['task-patch'];

export type TaskPatch = {
	id: string;
	status?: TaskStatus;
	checklist?: ChecklistItem[];
	/** 失敗時 toast 的標題，說明發生了什麼（例如「沒有移動成功，已放回『待辦』」） */
	errorTitle: string;
};

/**
 * 樂觀更新任務的狀態或子項目（看板拖曳、清單上直接勾子項目）：
 * - 送出前先改掉所有 ['tasks', …] 快取裡的那一筆（改狀態時一併算好完成時間，規則和後端相同）。
 * - 失敗：只還原這一筆、這次改到的欄位（卡片退回原欄、勾選還原），同時在送的其他更新不受影響；並用 toast 說明原因。
 * - 成功：用回應的那一筆換掉快取；同時有好幾個更新在送時，等最後一個結束才重新整理，畫面不會跳回舊值。
 */
export function useTaskPatch() {
	const qc = useQueryClient();
	const othersPending = () => qc.isMutating({ mutationKey: PATCH_KEY }) > 1;
	return useMutation({
		mutationKey: PATCH_KEY,
		mutationFn: ({ id, status, checklist }: TaskPatch) => api.patch<{ task: TaskItem }>(`/tasks/${id}`, { status, checklist }),
		onMutate: async ({ id, status, checklist }) => {
			await qc.cancelQueries({ queryKey: ['tasks'] });
			// 送出前的那一筆（各個 ['tasks', …] 快取裡是同一筆資料，取第一個找到的）
			const original = qc
				.getQueriesData<TaskItem[]>({ queryKey: ['tasks'] })
				.flatMap(([, data]) => data ?? [])
				.find((t) => t.id === id);
			const now = Date.now();
			qc.setQueriesData<TaskItem[]>({ queryKey: ['tasks'] }, (old) => old && applyTaskPatch(old, id, { status, checklist }, now));
			return { original };
		},
		onError: (e, vars, ctx) => {
			const original = ctx?.original;
			if (original)
				qc.setQueriesData<TaskItem[]>(
					{ queryKey: ['tasks'] },
					(old) => old && revertTaskPatch(old, original, { status: vars.status, checklist: vars.checklist }),
				);
			toast.error(vars.errorTitle, { description: e instanceof Error ? e.message : '請稍後再試' });
		},
		onSuccess: ({ task }) => {
			if (othersPending()) return;
			qc.setQueriesData<TaskItem[]>({ queryKey: ['tasks'] }, (old) => old?.map((t) => (t.id === task.id ? task : t)));
		},
		onSettled: () => {
			if (othersPending()) return;
			TASK_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
		},
	});
}

const SEARCH_DELAY = 300;

/**
 * 搜尋與排序存在網址 `?q=&sort=`（TSK-3）：
 * - 輸入框用本地 state，篩選即時；停止輸入 300ms 後才寫進網址，而且用 replace，不會每打一個字就多一筆歷史紀錄。
 * - 預設值（空白搜尋、依期限排序）不寫進網址。
 * - 網址被外部改變（例如從指令面板連過來）時採用網址的值；自己寫進去的值不會再套回輸入框，打字與注音選字不受影響。
 */
export function useTaskListParams() {
	const [params, setParams] = useSearchParams();
	const urlQ = params.get('q') ?? '';
	const urlSort = parseSort(params.get('sort'));

	const [query, setQuery] = useState(urlQ);
	const [sort, setSortState] = useState<TaskSort>(urlSort);
	// 最後一次寫進網址的值，以及上一次看到的網址
	const [written, setWritten] = useState({ q: urlQ, sort: urlSort });
	const [seen, setSeen] = useState({ q: urlQ, sort: urlSort });
	if (seen.q !== urlQ || seen.sort !== urlSort) {
		setSeen({ q: urlQ, sort: urlSort });
		if (urlQ !== written.q || urlSort !== written.sort) setWritten({ q: urlQ, sort: urlSort });
		if (urlQ !== written.q) setQuery(urlQ);
		if (urlSort !== written.sort) setSortState(urlSort);
	}

	const target = query.trim() ? query : '';
	useEffect(() => {
		if (target === written.q) return;
		const id = setTimeout(() => {
			setWritten((w) => ({ ...w, q: target }));
			setParams(
				(p) => {
					if (target) p.set('q', target);
					else p.delete('q');
					return p;
				},
				{ replace: true },
			);
		}, SEARCH_DELAY);
		return () => clearTimeout(id);
	}, [target, written.q, setParams]);

	const setSort = (next: TaskSort) => {
		setSortState(next);
		setWritten((w) => ({ ...w, sort: next }));
		setParams(
			(p) => {
				if (next === DEFAULT_SORT) p.delete('sort');
				else p.set('sort', next);
				return p;
			},
			{ replace: true },
		);
	};

	return { query, setQuery, sort, setSort };
}

export type TaskView = 'list' | 'board';
const VIEW_KEY = 'studyflow:tasks-view';

/** 清單／看板：記在這個瀏覽器（localStorage，讀寫失敗時就用清單） */
export function useTaskView(): [TaskView, (view: TaskView) => void] {
	const [view, setView] = useState<TaskView>(() => {
		try {
			return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
		} catch {
			return 'list';
		}
	});
	const set = (next: TaskView) => {
		setView(next);
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			// 私密瀏覽等情況寫不進去，只影響下次開啟的預設檢視
		}
	};
	return [view, set];
}

/** 刪除成功的回應（DELETE 一律回 `{ ok: true }`） */
function isDeleted(data: unknown): boolean {
	return !!data && typeof data === 'object' && 'ok' in data && data.ok === true;
}

/** 回應是不是 `{ task }`（POST／PATCH /tasks 的回應） */
function savedTask(data: unknown): TaskItem | null {
	if (!data || typeof data !== 'object' || !('task' in data)) return null;
	const { task } = data;
	return task && typeof task === 'object' && 'id' in task && 'status' in task && 'updatedAt' in task ? (task as TaskItem) : null;
}

/**
 * 這個元件掛載期間，任何地方（TaskCheckbox、TaskDialog…）送出的修改成功時通知：
 * - onSaved：任務新增或修改成功，帶伺服器回傳的那一筆（最新的狀態、updatedAt）。
 * - onRemoved：某一筆刪除成功，帶它的 id。刪除請求只帶 id、分不出資料種類（任務、考試、筆記…都會通知），
 *   id 不會重複，呼叫端用 id 比對自己手上的資料就好。
 * 失敗的請求不會通知。TaskCheckbox 只收 task、不回報結果，所以從 TanStack Query 的 mutation cache 觀察。
 */
export function useTaskResults({ onSaved, onRemoved }: { onSaved: (task: TaskItem) => void; onRemoved: (id: string) => void }) {
	const qc = useQueryClient();
	const onSuccess = useEffectEvent((data: unknown, variables: unknown) => {
		const task = savedTask(data);
		if (task) onSaved(task);
		// 刪除的 mutation（lib/queries.ts 的 useDeleteTask 等）變數就是 id 字串，回應是 { ok: true }。
		// 這裡分不出刪的是任務、考試還是筆記：假設是所有資料的 id 都是 UUID、不會互相撞號，
		// 呼叫端只拿它和自己手上的任務 id 比對（dropKept 找不到就原樣回傳），所以刪除其他資料不會有影響。
		else if (typeof variables === 'string' && isDeleted(data)) onRemoved(variables);
	});
	useEffect(
		() =>
			qc.getMutationCache().subscribe((event) => {
				if (event.type === 'updated' && event.action.type === 'success') onSuccess(event.action.data, event.mutation.state.variables);
			}),
		[qc],
	);
}
