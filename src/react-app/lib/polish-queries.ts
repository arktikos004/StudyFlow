import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import type { TaskItem } from '../../shared/api-types';

// s3/polish 的資料 hook。lib/queries.ts 屬於後端，這裡只觀察它送出的請求結果，不另外打 API。

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
		else if (typeof variables === 'string') onRemoved(variables);
	});
	useEffect(
		() =>
			qc.getMutationCache().subscribe((event) => {
				if (event.type === 'updated' && event.action.type === 'success') onSuccess(event.action.data, event.mutation.state.variables);
			}),
		[qc],
	);
}
