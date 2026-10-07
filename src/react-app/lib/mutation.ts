import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isAbortError } from './api';
import { invalidateKeys } from './query-keys';

// 修改資料（mutation）共用的提示：成功、失敗的 toast，以及成功後要重新取得哪些資料（query-keys.ts）。

/** 失敗的提示：顯示後端回傳的錯誤訊息；呼叫端自己中止的請求（例如對話框按了取消）不提示 */
export function toastError(e: unknown) {
	if (!isAbortError(e)) toast.error(e instanceof Error ? e.message : '發生錯誤');
}

/**
 * 包裝 useMutation：成功後重新整理相關資料、顯示提示；失敗時顯示後端回傳的錯誤訊息。
 */
export function useApiMutation<TVars, TResult>(
	fn: (vars: TVars) => Promise<TResult>,
	invalidate: readonly QueryKey[],
	successMessage?: string,
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => {
			invalidateKeys(qc, invalidate);
			if (successMessage) toast.success(successMessage);
		},
		onError: toastError,
	});
}
