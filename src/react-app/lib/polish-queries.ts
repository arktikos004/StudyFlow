import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import type { TaskItem } from '../../shared/api-types';

// s3/polish 的資料 hook。lib/queries.ts 屬於後端，這裡只觀察它送出的請求結果，不另外打 API。

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
 * 失敗的請求不會通知。TaskCheckbox 的介面是凍結的（只收 task），所以從 TanStack Query 的 mutation cache 觀察結果。
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
