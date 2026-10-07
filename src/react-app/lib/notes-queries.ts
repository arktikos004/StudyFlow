import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NoteItem } from '../../shared/api-types';
import { api } from './api';
import { QK } from './query-keys';

// 筆記的資料 hook（其餘在 queries.ts）。

/**
 * 釘選／取消釘選（NOTE-1）。後端只改 pinned：不更新「最後更新」時間，也不影響複習排程，
 * 所以只需要重新取得筆記列表與這則筆記；排序以後端回傳的為準（釘選在前、其次依更新時間），前端不自己重排。
 */
export function usePinNote() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => api.patch<{ note: NoteItem }>(`/notes/${id}`, { pinned }),
		onSuccess: async ({ note }) => {
			qc.setQueryData(['note', note.id], note);
			toast.success(note.pinned ? '已釘選，會排在最前面' : '已取消釘選');
			await qc.invalidateQueries({ queryKey: QK.notes });
		},
		onError: (e) => toast.error(e instanceof Error ? `更改釘選沒有成功：${e.message}` : '更改釘選沒有成功，請再試一次'),
	});
}
