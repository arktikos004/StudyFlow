// 暫時的資料層（s4/profile-ui 第一階段）：照 s4/profile-api 約定的契約先寫，介面才能用假的 API 回應完整操作與截圖。
// s4/profile-api 合併後：改用 lib/queries.ts 的 useProfileSummary、useUploadAvatar、useDeleteAvatar 與 lib/api.ts 的 avatarUrl，
// 並刪除這個檔案（呼叫端只有 components/settings/Profile*.tsx 與 components/Layout.tsx）。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '../../shared/api-types';
import { api } from './api';
import type { ProfileSummary } from './profile-format';

/** 本人的累積數字（GET /api/profile/summary） */
export function useProfileSummary() {
	return useQuery({ queryKey: ['profile-summary'], queryFn: () => api.get<ProfileSummary>('/profile/summary') });
}

/** 頭像網址：'/api/auth/avatar?v=<avatarUpdatedAt>'；沒有頭像回傳 null（契約：PublicUser.avatarUpdatedAt） */
export function avatarUrl(user: PublicUser): string | null {
	const v = (user as PublicUser & { avatarUpdatedAt?: number | null }).avatarUpdatedAt;
	return v ? `/api/auth/avatar?v=${v}` : null;
}

/** 上傳頭像（multipart 'file'）；成功後重新取得 /auth/me，三個地方的頭像一起換 */
export function useUploadAvatar() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (file: Blob) => {
			const form = new FormData();
			form.append('file', file, 'avatar.jpg');
			return api.put('/auth/avatar', form);
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
	});
}

/** 移除頭像；成功後重新取得 /auth/me */
export function useDeleteAvatar() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.del('/auth/avatar'),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
	});
}
