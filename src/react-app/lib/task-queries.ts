import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { ChecklistItem, TaskItem } from '../../shared/api-types';
import { api } from './api';
import { completedAtFor, DEFAULT_SORT, parseSort, type TaskSort, type TaskStatus } from './task-sort';

// 任務頁（s2/tasks）的資料 hook：樂觀更新、網址上的搜尋與排序、檢視方式。
// lib/queries.ts 屬於後端；這裡只用同樣的 API 與 query key，快取與 invalidate 和 queries.ts 共用。

/** 和 queries.ts 的 TASK_KEYS 相同：任務會影響考試準備進度、成就、總覽、統計、頁首摘要、單科總覽 */
export const TASK_KEYS: QueryKey[] = [['tasks'], ['events'], ['achievements'], ['dashboard'], ['stats'], ['summary'], ['subject-overview']];

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
 * - 失敗：還原快取（卡片退回原欄、勾選還原）並用 toast 說明原因。
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
			const snapshots = qc.getQueriesData<TaskItem[]>({ queryKey: ['tasks'] });
			const now = Date.now();
			qc.setQueriesData<TaskItem[]>({ queryKey: ['tasks'] }, (old) =>
				old?.map((t) =>
					t.id === id
						? {
								...t,
								...(status && { status, completedAt: completedAtFor(t, status, now) }),
								...(checklist && { checklist }),
							}
						: t,
				),
			);
			return { snapshots };
		},
		onError: (e, vars, ctx) => {
			ctx?.snapshots.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data));
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

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** 使用者是否要求減少動態（看板拖曳放開時的歸位動畫會拿掉） */
export function usePrefersReducedMotion(): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const media = window.matchMedia(REDUCED_MOTION);
			media.addEventListener('change', onChange);
			return () => media.removeEventListener('change', onChange);
		},
		() => window.matchMedia(REDUCED_MOTION).matches,
	);
}
