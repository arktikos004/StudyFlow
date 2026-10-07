import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import type { PublicUser } from '../../shared/api-types';
import type { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../../shared/schemas';
import { api, ApiError, type RequestOptions } from './api';
import { toastError } from './mutation';
import { ME_KEY } from './query-keys';

// 帳號：目前登入的使用者、登入、註冊、登出、變更密碼、個人資料與頭像。學習資料的 hook 在 queries.ts。

/** 目前登入的使用者；null = 沒有登入 */
export function useMe() {
	return useQuery({
		queryKey: ME_KEY,
		queryFn: async () => {
			try {
				return (await api.get<{ user: PublicUser }>('/auth/me')).user;
			} catch (e) {
				if (e instanceof ApiError && e.status === 401) return null;
				throw e;
			}
		},
		// 這台裝置上的變更都會直接寫進快取，平常不必重新取得；
		// 但別的裝置可能換了照片或暱稱（登入也可能過期）：切回分頁、重新連上網路時一律重新取得
		staleTime: Infinity,
		refetchOnWindowFocus: 'always',
		refetchOnReconnect: 'always',
	});
}

/** 已登入頁面使用：RequireAuth 保證 user 一定存在 */
export function useUser(): PublicUser {
	const { data } = useMe();
	return data!;
}

/**
 * 使用者資料的修改（個人資料、頭像）失敗或被中止時：請求可能已經在伺服器上完成（例如處理完才斷線、按了取消），
 * 重新取得使用者，畫面以伺服器為準；再顯示失敗的提示（中止的不提示）。
 */
function resyncMeAndToast(qc: QueryClient, e: unknown) {
	void qc.invalidateQueries({ queryKey: ME_KEY });
	toastError(e);
}

// 登入、註冊、變更密碼的失敗原因由表單顯示（欄位旁或按鈕上方），不跳 toast。
// networkMode: 'always'：離線時不要暫停到連線後才送（按鈕會一直轉圈），直接失敗、顯示「目前離線」。

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** 登入或註冊：成功後直接換掉 ME_KEY 的使用者 */
function useAuthMutation<TInput>(path: '/auth/login' | '/auth/register') {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: TInput) => api.post<{ user: PublicUser }>(path, input),
		onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
		networkMode: 'always',
	});
}
export const useLogin = () => useAuthMutation<LoginInput>('/auth/login');

/**
 * 送出登出：伺服器確認後才算登出，回傳 true。離線或伺服器錯誤時 cookie 仍然有效，不能假裝已經登出
 * （共用電腦上下一個人打開就會回到這個帳號），所以提示原因並回傳 false，由呼叫端留在原頁。
 * 不用 useMutation：登出後整個版面就要卸載，mutation 狀態更新會讓版面在使用者資料清掉後多 render 一次。
 */
export async function requestLogout(): Promise<boolean> {
	try {
		await api.post('/auth/logout');
		return true;
	} catch (e) {
		toast.error('登出沒有完成', { description: e instanceof Error ? e.message : '請稍後再試' });
		return false;
	}
}
export const useRegister = () => useAuthMutation<RegisterInput>('/auth/register');

/** 變更密碼：成功時提示（後端會登出其他裝置） */
export const useChangePassword = () =>
	useMutation({
		mutationFn: (input: ChangePasswordInput) => api.post('/auth/password', input),
		onSuccess: () => toast.success('密碼已更新，其他裝置已登出'),
		networkMode: 'always',
	});

/** 暱稱、時區、每日／每週目標；目標傳 null 代表清除 */
export type ProfileInput = z.input<typeof updateProfileSchema>;
/**
 * 更新個人資料：mutate({ ...欄位, signal? })；signal 可以中止請求，不會送給後端。
 * successMessage：成功時的提示（例如「已更新時區」）；省略就不提示，由呼叫端自己決定
 * （例如「編輯個人資料」一次存好照片與暱稱，只提示一次）。
 */
export const useUpdateProfile = (successMessage?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ signal, ...input }: ProfileInput & RequestOptions) => api.patch<{ user: PublicUser }>('/auth/me', input, { signal }),
		onSuccess: ({ user }, input) => {
			qc.setQueryData(ME_KEY, user);
			// 時區會改變「今天」，目標會改變總覽、統計與成就：其他資料都要重新取得。只改暱稱時不必
			const changed = Object.keys(input).filter((k) => k !== 'signal');
			if (changed.some((k) => k !== 'displayName')) qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
			if (successMessage) toast.success(successMessage);
		},
		onError: (e) => resyncMeAndToast(qc, e),
	});
};

/**
 * 頭像的上傳與移除：成功後直接換掉 ME_KEY 快取裡的使用者。avatarUpdatedAt 變了，avatarUrl() 就會換網址，
 * 用 useMe／useUser 的地方（側欄、「更多」選單、設定頁）都會跟著更新。
 * 成功不提示：只有「編輯個人資料」在用，存好整輪才提示一次。失敗時用 toast 顯示後端的錯誤訊息。
 */
function useAvatarMutation<TVars>(fn: (vars: TVars) => Promise<{ user: PublicUser }>) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
		onError: (e) => resyncMeAndToast(qc, e),
	});
}

/**
 * 上傳頭像：mutate({ file, signal? })。請先在前端裁成正方形並縮小；後端上限 AVATAR_MAX_BYTES（1MB），
 * 依檔案內容只接受 JPEG、PNG、WebP（AVATAR_TYPES）。signal 可以中止上傳。
 */
export const useUploadAvatar = () =>
	useAvatarMutation(({ file, signal }: { file: Blob } & RequestOptions) => {
		const form = new FormData();
		form.append('file', file, 'avatar');
		return api.put<{ user: PublicUser }>('/auth/avatar', form, { signal });
	});

/** 移除頭像：mutate({ signal? })；之後 avatarUpdatedAt 是 null，畫面改用暱稱首字 */
export const useDeleteAvatar = () =>
	useAvatarMutation(({ signal }: RequestOptions) => api.del<{ user: PublicUser }>('/auth/avatar', { signal }));
