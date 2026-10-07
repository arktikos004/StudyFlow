import type { PublicUser } from '../../shared/api-types';

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

/** signal：呼叫端可以中止請求（例如對話框按了取消），瀏覽器會真的取消上傳 */
export type RequestOptions = { signal?: AbortSignal };

/** 這個錯誤是不是呼叫端自己中止請求造成的（不是連線問題，不必提示） */
export const isAbortError = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

async function request<T>(method: string, path: string, body?: unknown, { signal }: RequestOptions = {}): Promise<T> {
	const init: RequestInit = { method, credentials: 'same-origin', headers: {}, signal };
	if (body instanceof FormData) {
		init.body = body;
	} else if (body !== undefined) {
		init.body = JSON.stringify(body);
		(init.headers as Record<string, string>)['Content-Type'] = 'application/json';
	}

	let res: Response;
	try {
		res = await fetch(`/api${path}`, init);
	} catch (e) {
		// 呼叫端自己中止的：原樣丟出 AbortError，不包成「無法連線」
		if (signal?.aborted) throw e;
		throw new ApiError(navigator.onLine ? '無法連線到伺服器，請稍後再試' : '目前離線，請確認網路連線', 0);
	}
	const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
	if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `請求失敗（${res.status}）`, res.status);
	return data as T;
}

export const api = {
	get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
	post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
	patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
	put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
	del: <T = { ok: true }>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
};

export function qs(params: Record<string, string | number | undefined | null>) {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
	const s = sp.toString();
	return s ? `?${s}` : '';
}

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;

/**
 * 本人頭像的網址，給 <img src> 使用（同源，會帶登入 cookie）；沒有上傳時回 null，畫面改用暱稱首字。
 * 帶 ?v=<avatarUpdatedAt>：每次更換都會換網址，瀏覽器不會拿快取裡的舊圖（後端讓同一個網址快取一年）。
 */
export const avatarUrl = (user: Pick<PublicUser, 'avatarUpdatedAt'>): string | null =>
	user.avatarUpdatedAt ? `/api/auth/avatar?v=${user.avatarUpdatedAt}` : null;

export type ExportFile = 'backup.json' | 'sessions.csv' | 'tasks.csv' | 'calendar.ics';
/**
 * 匯出檔的下載網址，給 <a href={exportUrl(...)} download> 使用（同源，會帶登入 cookie）。
 * 例如 exportUrl('calendar.ics', { tasks: 1 }) → /api/export/calendar.ics?tasks=1
 */
export const exportUrl = (file: ExportFile, params: Record<string, string | number | undefined | null> = {}) =>
	`/api/export/${file}${qs(params)}`;
